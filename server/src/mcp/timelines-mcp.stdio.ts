#!/usr/bin/env node
/**
 * Lemon Universe — TimeLines Model Context Protocol (MCP) Stdio Server
 *
 * Bridges stdio JSON-RPC 2.0 (Antigravity, Cursor, Claude Desktop, MCP Inspector)
 * to the Lemon Universe TimeLines REST API (default: http://192.168.1.100:3010/api).
 */

import * as readline from 'node:readline';
import {
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
} from './mcp.service';
import {
  TIMELINES_MCP_INSTRUCTIONS,
  TIMELINES_MCP_TOOLS,
} from './timelines-mcp.contract';
import { executeTimelinesMcpTool, TimelinesMcpBackend } from './timelines-mcp.executor';

const DEFAULT_API_URL = 'http://192.168.1.100:3010/api';

function getApiBaseUrl(): string {
  const raw =
    process.env.TIMELINES_API_URL ||
    process.env.LEMON_UNIVERSE_API_URL ||
    DEFAULT_API_URL;
  return raw.replace(/\/+$/, '');
}

async function callApi(
  path: string,
  method: string,
  opts: { body?: unknown; profileId?: string } = {},
): Promise<any> {
  const url = `${getApiBaseUrl()}/${path.replace(/^\//, '')}`;
  const effectiveProfileId =
    opts.profileId?.trim() || process.env.TIMELINES_DEFAULT_PROFILE_ID?.trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (effectiveProfileId) {
    headers['x-profile-id'] = effectiveProfileId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Keep plain text when response is non-JSON
  }

  if (!res.ok) {
    const errMsg =
      typeof parsed === 'object' && parsed?.message
        ? Array.isArray(parsed.message)
          ? parsed.message.join('; ')
          : String(parsed.message)
        : text || `HTTP ${res.status}`;
    throw new Error(`API ${method} ${path} failed (${res.status}): ${errMsg}`);
  }

  return parsed;
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export function createHttpTimelinesMcpBackend(): TimelinesMcpBackend {
  return {
    listBoards: ({ profileId, includeArchived }) =>
      callApi(
        `timelines/boards${buildQuery({ includeArchived: includeArchived ? 'true' : undefined })}`,
        'GET',
        { profileId },
      ),
    getBoard: (board, profileId) =>
      callApi(`timelines/boards/${encodeURIComponent(board)}`, 'GET', { profileId }),
    createBoard: (dto, profileId) =>
      callApi('timelines/boards', 'POST', { body: dto, profileId }),
    updateBoard: (board, dto, profileId) =>
      callApi(`timelines/boards/${encodeURIComponent(board)}`, 'PATCH', { body: dto, profileId }),
    getBoardMembers: (board, profileId) =>
      callApi(`timelines/boards/${encodeURIComponent(board)}/members`, 'GET', { profileId }),
    upsertBoardMember: (board, dto, profileId) =>
      callApi(`timelines/boards/${encodeURIComponent(board)}/members`, 'POST', {
        body: dto,
        profileId,
      }),
    removeBoardMember: (board, targetProfileId, profileId) =>
      callApi(
        `timelines/boards/${encodeURIComponent(board)}/members/${encodeURIComponent(targetProfileId)}`,
        'DELETE',
        { profileId },
      ),
    getNotes: (opts) => {
      const { boardId, profileId, ...rest } = opts;
      const query = buildQuery(rest);
      if (boardId) {
        return callApi(
          `timelines/boards/${encodeURIComponent(String(boardId))}/notes${query}`,
          'GET',
          { profileId },
        );
      }
      return callApi(`timelines/notes${query}`, 'GET', { profileId });
    },
    getNoteById: (noteId, profileId) =>
      callApi(`timelines/notes/${encodeURIComponent(noteId)}`, 'GET', { profileId }),
    createNote: (dto, profileId) =>
      callApi('timelines/notes', 'POST', { body: dto, profileId }),
    updateNote: (noteId, dto, profileId) =>
      callApi(`timelines/notes/${encodeURIComponent(noteId)}`, 'PATCH', {
        body: dto,
        profileId,
      }),
    pinNote: (noteId, isPinned, profileId) =>
      callApi(`timelines/notes/${encodeURIComponent(noteId)}/pin`, 'PATCH', {
        body: { isPinned },
        profileId,
      }),
    deleteNote: (noteId, profileId) =>
      callApi(`timelines/notes/${encodeURIComponent(noteId)}`, 'DELETE', { profileId }),
    createCrossLink: (dto, profileId) =>
      callApi('timelines/cross-links', 'POST', { body: dto, profileId }),
    postAgentSummary: (dto) =>
      callApi('timelines/agent/summary', 'POST', {
        body: dto,
        profileId: dto.agentProfileId,
      }),
    listActors: (query) => callApi(`actors${buildQuery(query)}`, 'GET'),
    getActorStats: ({ boardId, profileId }) =>
      callApi(`timelines/actors/stats${buildQuery({ boardId })}`, 'GET', { profileId }),
    listProfiles: () => callApi('profiles', 'GET'),
    upsertProfile: (dto) => callApi('profiles', 'POST', { body: dto }),
  };
}

export async function handleStdioRequest(
  backend: TimelinesMcpBackend,
  request: any,
): Promise<Record<string, unknown> | null> {
  if (!request || typeof request !== 'object' || typeof request.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid JSON-RPC request' },
    };
  }

  const isNotification = request.id === undefined;
  const id = request.id ?? null;

  if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') {
    return null;
  }

  if (request.method === 'initialize') {
    const requestedVersion = String(request.params?.protocolVersion || '');
    const protocolVersion = SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(requestedVersion as any)
      ? requestedVersion
      : SUPPORTED_MCP_PROTOCOL_VERSIONS[0];

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: 'lemon-universe-timelines-mcp',
          version: '1.0.0',
        },
        instructions: TIMELINES_MCP_INSTRUCTIONS,
      },
    };
  }

  if (request.method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (request.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TIMELINES_MCP_TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      },
    };
  }

  if (request.method === 'tools/call') {
    const toolName = request.params?.name;
    const toolArgs = (request.params?.arguments ?? {}) as Record<string, any>;
    if (!toolName || typeof toolName !== 'string') {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'Missing params.name for tools/call' },
      };
    }

    try {
      const result = await executeTimelinesMcpTool(backend, toolName, toolArgs);
      if (isNotification) return null;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        },
      };
    } catch (err: any) {
      if (isNotification) return null;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            { type: 'text', text: JSON.stringify({ error: err?.message || 'MCP error' }) },
          ],
        },
      };
    }
  }

  if (isNotification) return null;
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${request.method}` },
  };
}

export function startTimelinesStdioServer(): void {
  const backend = createHttpTimelinesMcpBackend();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let pending = Promise.resolve();
  let closed = false;

  const maybeExit = () => {
    if (closed) {
      pending.finally(() => process.exit(0));
    }
  };

  rl.on('line', (line) => {
    if (!line.trim()) return;
    pending = pending.then(async () => {
      try {
        const request = JSON.parse(line);
        const response = await handleStdioRequest(backend, request);
        if (response !== null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          }) + '\n',
        );
      }
    });
  });

  rl.on('close', () => {
    closed = true;
    maybeExit();
  });
}

if (require.main === module) {
  startTimelinesStdioServer();
}
