import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { McpService } from '../src/mcp/mcp.service';
import { TIMELINES_MCP_TOOLS } from '../src/mcp/timelines-mcp.contract';
import { createTimelinesMcpHttpServer } from '../src/mcp/timelines-mcp.http';
import { handleStdioRequest } from '../src/mcp/timelines-mcp.stdio';

// Compiled dist artifacts retain TypeScript design:paramtypes required by @nestjs/swagger
const { ActorsController } = require('../dist/actors/actors.controller');
const { ActorsService } = require('../dist/actors/actors.service');
const { McpController: DistMcpController } = require('../dist/mcp/mcp.controller');
const { McpService: DistMcpService } = require('../dist/mcp/mcp.service');
const { ProfilesController } = require('../dist/profiles/profiles.controller');
const { ProfilesService } = require('../dist/profiles/profiles.service');
const { buildSwaggerDocument } = require('../dist/swagger');
const { TimelinesController } = require('../dist/timelines/timelines.controller');
const { TimelinesService } = require('../dist/timelines/timelines.service');

@Module({
  controllers: [TimelinesController, ActorsController, ProfilesController, DistMcpController],
  providers: [
    { provide: TimelinesService, useValue: {} },
    { provide: ActorsService, useValue: {} },
    { provide: ProfilesService, useValue: {} },
    DistMcpService,
  ],
})
class SwaggerSyncTestModule {}

test('Swagger OpenAPI document and MCP tool definitions stay in sync with zero missing DTOs and no weather fields', async () => {
  const app = await NestFactory.create(SwaggerSyncTestModule, { logger: false });
  app.setGlobalPrefix('api');

  try {
    const openApiDoc = buildSwaggerDocument(app);
    assert.ok(openApiDoc.paths['/api/timelines/boards/{boardIdOrSlug}/notes']);
    assert.ok(openApiDoc.paths['/api/timelines/notes']);
    assert.ok(openApiDoc.paths['/api/timelines/actors/stats']);

    const mcpService = app.get(DistMcpService);
    const report = mcpService.syncWithOpenApi(openApiDoc);

    assert.deepEqual(report.missingSchemas, []);
    assert.ok(report.syncedTools.includes('post_note'));
    assert.ok(report.syncedTools.includes('post_agent_summary'));
    assert.ok(report.syncedTools.includes('create_board'));

    // Weather must be excluded from MCP tools at this stage
    const tools = mcpService.getTools();
    assert.ok(!tools.some((t: any) => t.name.toLowerCase().includes('weather')));
    for (const tool of tools) {
      assert.equal(tool.inputSchema.properties.weather, undefined);
      assert.equal(tool.inputSchema.properties.worldMoment, undefined);
    }
  } finally {
    await app.close();
  }
});

test('McpService handles JSON-RPC initialize, tools/list, and tools/call for timeline notes', async () => {
  const calls: Array<{ fn: string; arg: any }> = [];
  const fakeTimelinesService = {
    getNotes: async (opts: any) => {
      calls.push({ fn: 'getNotes', arg: opts });
      return [{ id: 'note-1', boardId: 'board-coding-sessions', text: 'OK' }];
    },
    getNoteById: async (noteId: string) => ({ id: noteId, text: 'Single' }),
    createNote: async (dto: any, profileId?: string) => {
      calls.push({ fn: 'createNote', arg: { dto, profileId } });
      return { id: 'note-new', ...dto };
    },
  };

  const mcp = new McpService(fakeTimelinesService as any, {} as any, {} as any);

  const initRes = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26' },
  });
  assert.equal((initRes?.result as any)?.protocolVersion, '2025-03-26');
  assert.equal((initRes?.result as any)?.serverInfo?.name, 'lemon-universe-timelines-mcp');

  const notifRes = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  assert.equal(notifRes, null);

  const listRes = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  });
  const listedTools = (listRes?.result as any)?.tools ?? [];
  assert.equal(listedTools.length, TIMELINES_MCP_TOOLS.length);
  assert.ok(listedTools.some((t: any) => t.name === 'get_timeline_notes'));
  assert.ok(listedTools.some((t: any) => t.name === 'get_latest_timeline_notes'));

  const notesCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_latest_timeline_notes',
      arguments: { board: 'tower-fire', limit: 5, actorId: 'actor-hades' },
    },
  });
  assert.equal((notesCall?.result as any)?.isError, undefined);
  assert.deepEqual(calls[0], {
    fn: 'getNotes',
    arg: {
      boardId: 'tower-fire',
      profileId: undefined,
      actorId: 'actor-hades',
      tag: undefined,
      limit: 5,
      offset: 0,
      order: 'latest',
      compact: true,
    },
  });
  // Verify compact JSON serialization (no pretty indentation or duplicate structuredContent)
  assert.equal((notesCall?.result as any)?.structuredContent, undefined);
  assert.ok(!String((notesCall?.result as any)?.content?.[0]?.text).includes('\n  '));

  // Invalid dateKey returns clean MCP isError payload
  const badDateCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'post_note',
      arguments: { boardId: 'tower-fire', text: 'Test', dateKey: '26.11.2026' },
    },
  });
  assert.equal((badDateCall?.result as any)?.isError, true);
  assert.match((badDateCall?.result as any)?.content?.[0]?.text, /YYYY-MM-DD/);

  // Valid post_note fills Moscow defaults automatically
  const okPost = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'post_note',
      arguments: { boardId: 'tower-fire', actorId: 'actor-hades', text: 'Report ready' },
    },
  });
  assert.equal((okPost?.result as any)?.isError, undefined);
  assert.match(calls[1].arg.dto.dateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(calls[1].arg.dto.time, /^\d{2}:\d{2}$/);
  assert.equal(calls[1].arg.profileId, undefined);

  // post_note on coding-sessions or by actor-antigravity-agent defaults profileId to AI Guild agent profile
  const agentPost = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'post_note',
      arguments: { boardId: 'coding-sessions', text: 'Agent session note' },
    },
  });
  assert.equal((agentPost?.result as any)?.isError, undefined);
  assert.equal(calls[2].arg.profileId, 'a7e49c10-9100-4b22-a811-9000a6e17001');
});

test('Stdio MCP handler routes tools/list and get_timeline_notes cleanly', async () => {
  const captured: any[] = [];
  const fakeBackend: any = {
    getNotes: async (opts: any) => {
      captured.push(opts);
      return [{ id: 'note-stdio-1', boardId: 'board-global-day' }];
    },
  };

  const res = await handleStdioRequest(fakeBackend, {
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'get_timeline_notes',
      arguments: { board: 'global-day', fromDate: '2026-11-25', toDate: '2026-11-26', limit: 20 },
    },
  });

  assert.equal((res?.result as any)?.isError, undefined);
  assert.equal(captured[0].boardId, 'global-day');
  assert.equal(captured[0].fromDate, '2026-11-25');
  assert.equal(captured[0].toDate, '2026-11-26');
  assert.equal(captured[0].limit, 20);
  assert.equal(captured[0].order, 'latest');
});

test('Standalone Streamable HTTP MCP server serves /health and /mcp JSON-RPC', async () => {
  const srv = createTimelinesMcpHttpServer();
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const addr = srv.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as any;
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.toolsCount, TIMELINES_MCP_TOOLS.length);

    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(initRes.status, 200);
    assert.ok(initRes.headers.get('mcp-session-id'));
    const initJson = (await initRes.json()) as any;
    assert.equal(initJson.result.serverInfo.name, 'lemon-universe-timelines-mcp');

    const sseGetRes = await fetch(`${baseUrl}/mcp`, {
      headers: { Accept: 'text/event-stream' },
    });
    assert.equal(sseGetRes.status, 405);
  } finally {
    await new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
  }
});
