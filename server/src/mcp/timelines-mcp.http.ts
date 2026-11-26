#!/usr/bin/env node
/**
 * Lemon Universe — TimeLines Model Context Protocol (MCP) Standalone Streamable HTTP Server
 *
 * Designed to run as a dedicated service/container with its own Projectarium-allocated port,
 * forwarding tool executions to the Lemon Universe NestJS API (TIMELINES_API_URL).
 */

import crypto from 'node:crypto';
import * as http from 'node:http';
import { TIMELINES_MCP_TOOLS } from './timelines-mcp.contract';
import {
  createHttpTimelinesMcpBackend,
  handleStdioRequest,
} from './timelines-mcp.stdio';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-profile-id, Mcp-Session-Id, Accept',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createTimelinesMcpHttpServer(): http.Server {
  const backend = createHttpTimelinesMcpBackend();

  return http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    const method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if ((urlPath === '/' || urlPath === '/health') && method === 'GET') {
      writeJson(res, 200, {
        status: 'ok',
        service: 'lemon-universe-timelines-mcp',
        version: '1.0.0',
        transport: 'streamable-http',
        toolsCount: TIMELINES_MCP_TOOLS.length,
        mcpEndpoint: '/mcp',
      });
      return;
    }

    if (urlPath === '/mcp') {
      if (method === 'GET') {
        const accept = String(req.headers['accept'] || '');
        if (accept.includes('text/event-stream')) {
          writeJson(
            res,
            405,
            { error: 'Server-initiated SSE stream is not enabled; use POST /mcp for JSON-RPC.' },
            { Allow: 'POST, DELETE' },
          );
          return;
        }
        writeJson(res, 200, {
          status: 'ok',
          serverName: 'lemon-universe-timelines-mcp',
          version: '1.0.0',
          transport: 'streamable-http',
          toolsCount: TIMELINES_MCP_TOOLS.length,
        });
        return;
      }

      if (method === 'DELETE') {
        writeJson(res, 200, { ok: true });
        return;
      }

      if (method === 'POST') {
        let payload: any;
        try {
          payload = await readJsonBody(req);
        } catch {
          writeJson(res, 400, {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          });
          return;
        }

        const isBatch = Array.isArray(payload);
        const requests = isBatch ? payload : [payload];
        const incomingSession = String(req.headers['mcp-session-id'] || '').trim();
        const hasInitialize = requests.some((r) => r?.method === 'initialize');
        const sessionId = incomingSession || (hasInitialize ? crypto.randomUUID() : '');

        const responses: Record<string, unknown>[] = [];
        for (const item of requests) {
          const response = await handleStdioRequest(backend, item);
          if (response !== null) {
            responses.push(response);
          }
        }

        const sessionHeaders: Record<string, string> = sessionId ? { 'Mcp-Session-Id': sessionId } : {};
        if (responses.length === 0) {
          res.writeHead(202, { ...CORS_HEADERS, ...sessionHeaders });
          res.end();
          return;
        }

        writeJson(res, 200, isBatch ? responses : responses[0], sessionHeaders);
        return;
      }
    }

    writeJson(res, 404, { error: `Not found: ${method} ${urlPath}` });
  });
}

if (require.main === module) {
  const port = Number(process.env.MCP_PORT || process.env.PORT || 3000);
  const server = createTimelinesMcpHttpServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`🔌 TimeLines Standalone MCP (Streamable HTTP) listening on http://0.0.0.0:${port}/mcp`);
  });
}
