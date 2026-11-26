import { Body, Controller, Delete, Get, Headers, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { JsonRpcRequest, JsonRpcResponse, McpService } from './mcp.service';

/**
 * Streamable HTTP MCP transport endpoint (/mcp) compatible with Antigravity and MCP Inspector.
 */
@ApiExcludeController()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handlePost(
    @Body() payload: JsonRpcRequest | JsonRpcRequest[],
    @Headers('mcp-session-id') sessionIdHeader: string | undefined,
    @Res() res: Response,
  ) {
    const isBatch = Array.isArray(payload);
    const requests = isBatch ? payload : [payload];
    const hasInitialize = requests.some((req) => req?.method === 'initialize');
    const sessionId = sessionIdHeader?.trim() || (hasInitialize ? this.mcpService.createSessionId() : undefined);

    if (sessionId) {
      res.setHeader('Mcp-Session-Id', sessionId);
    }

    const responses: JsonRpcResponse[] = [];
    for (const req of requests) {
      const response = await this.mcpService.handleJsonRpc(req);
      if (response !== null) {
        responses.push(response);
      }
    }

    if (responses.length === 0) {
      return res.status(202).send();
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(isBatch ? responses : responses[0]);
  }

  @Get()
  handleGet(@Headers('accept') acceptHeader: string | undefined, @Res() res: Response) {
    // Per MCP Streamable HTTP spec, return 405 when SSE server-to-client stream is not opened
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
      res.setHeader('Allow', 'POST, DELETE');
      return res.status(405).json({
        error: 'Server-initiated SSE stream is not enabled; use POST /mcp for JSON-RPC.',
      });
    }
    return res.status(200).json(this.mcpService.getSyncStatus());
  }

  @Delete()
  handleDelete(@Res() res: Response) {
    return res.status(200).json({ ok: true });
  }
}
