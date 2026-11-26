import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ActorsService } from '../actors/actors.service';
import { ProfilesService } from '../profiles/profiles.service';
import { TimelinesService } from '../timelines/timelines.service';
import {
  McpToolDefinition,
  SwaggerMcpSyncReport,
  syncToolsWithOpenApi,
  TIMELINES_MCP_INSTRUCTIONS,
  TIMELINES_MCP_TOOLS,
} from './timelines-mcp.contract';
import { executeTimelinesMcpTool, TimelinesMcpBackend } from './timelines-mcp.executor';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const SUPPORTED_MCP_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private tools: McpToolDefinition[] = TIMELINES_MCP_TOOLS;
  private syncReport: SwaggerMcpSyncReport | null = null;
  private readonly backend: TimelinesMcpBackend;

  constructor(
    private readonly timelinesService: TimelinesService,
    private readonly actorsService: ActorsService,
    private readonly profilesService: ProfilesService,
  ) {
    this.backend = {
      listBoards: ({ profileId, includeArchived }) =>
        this.timelinesService.getBoards(profileId, includeArchived),
      getBoard: (board, profileId) => this.timelinesService.getBoard(board, profileId),
      createBoard: (dto, profileId) => this.timelinesService.createBoard(dto as any, profileId),
      updateBoard: (board, dto, profileId) =>
        this.timelinesService.updateBoard(board, dto as any, profileId),
      getBoardMembers: (board, profileId) =>
        this.timelinesService.getBoardMembers(board, profileId),
      upsertBoardMember: (board, dto, profileId) =>
        this.timelinesService.addOrUpdateBoardMember(board, dto as any, profileId),
      removeBoardMember: (board, targetProfileId, profileId) =>
        this.timelinesService.removeBoardMember(board, targetProfileId, profileId),
      getNotes: (opts) => this.timelinesService.getNotes(opts),
      getNoteById: (noteId, profileId) => this.timelinesService.getNoteById(noteId, profileId),
      createNote: (dto, profileId) => this.timelinesService.createNote(dto, profileId),
      updateNote: (noteId, dto, profileId) =>
        this.timelinesService.updateNote(noteId, dto as any, profileId),
      pinNote: (noteId, isPinned, profileId) =>
        this.timelinesService.pinNote(noteId, isPinned, profileId),
      deleteNote: (noteId, profileId) => this.timelinesService.deleteNote(noteId, profileId),
      createCrossLink: (dto, profileId) =>
        this.timelinesService.createCrossLink(dto as any, profileId),
      postAgentSummary: (dto) => this.timelinesService.postAgentSummary(dto as any),
      listActors: (query) => this.actorsService.findAll(query),
      getActorStats: (opts) => this.timelinesService.getActorStats(opts),
      listProfiles: () => this.profilesService.findAll(),
      upsertProfile: (dto) => this.profilesService.create(dto as any),
    };
  }

  /** Synchronizes MCP tool input schemas against the live NestJS OpenAPI/Swagger document. */
  syncWithOpenApi(openApiDoc: OpenAPIObject): SwaggerMcpSyncReport {
    const { tools, report } = syncToolsWithOpenApi(TIMELINES_MCP_TOOLS, openApiDoc);
    this.tools = tools;
    this.syncReport = report;
    if (report.missingSchemas.length > 0) {
      this.logger.warn(
        `Swagger-MCP sync missing schemas: ${report.missingSchemas.join(', ')}`,
      );
    } else {
      this.logger.log(
        `Synchronized ${report.syncedTools.length} MCP tools with OpenAPI Swagger schemas (${this.tools.length} total tools).`,
      );
    }
    return report;
  }

  getTools(): McpToolDefinition[] {
    return this.tools;
  }

  getSyncStatus() {
    return {
      serverName: 'lemon-universe-timelines-mcp',
      version: '1.0.0',
      transport: 'streamable-http',
      toolsCount: this.tools.length,
      swaggerSync: this.syncReport,
    };
  }

  createSessionId(): string {
    return crypto.randomUUID();
  }

  async handleJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
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
          capabilities: {
            tools: { listChanged: false },
          },
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
          tools: this.tools.map(({ name, description, inputSchema }) => ({
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
        const result = await executeTimelinesMcpTool(this.backend, toolName, toolArgs);
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
        const message = err?.message || 'MCP tool execution failed';
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
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
}
