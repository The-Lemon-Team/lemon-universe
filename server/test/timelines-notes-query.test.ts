import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorsService } from '../src/actors/actors.service';
import { TimelinesService } from '../src/timelines/timelines.service';

const OWNER_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

interface MockDbCapture {
  queries: Array<{ sql: string; params: unknown[] }>;
}

function createMockService(opts: {
  boards?: any[];
  notes?: any[];
  members?: any[];
  statsRows?: any[];
}) {
  const capture: MockDbCapture = { queries: [] };
  const boards = opts.boards ?? [];
  const members = opts.members ?? [];

  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      capture.queries.push({ sql, params });
      if (sql.includes('FROM timeline_board_members')) {
        return { rows: members };
      }
      if (sql.includes('FROM timeline_boards b') && sql.includes('WHERE b.id = $1 OR b.slug = $1')) {
        const ref = params[0];
        const found = boards.find((b) => b.id === ref || b.slug === ref);
        return { rows: found ? [found] : [] };
      }
      if (sql.includes('FROM timeline_boards b')) {
        return { rows: boards };
      }
      if (sql.includes('GROUP BY n.actor_id')) {
        return { rows: opts.statsRows ?? [] };
      }
      if (sql.includes('FROM timeline_notes n')) {
        return { rows: opts.notes ?? [] };
      }
      if (sql.includes('FROM profiles WHERE id')) {
        return { rows: [{ displayName: 'Алексей' }] };
      }
      return { rows: [] };
    },
  };

  const seasonsBridge = {
    syncTimelineNote: async () => ({ synced: false }),
    ensureBoardTopology: async () => {},
  };

  const actorsService = new ActorsService({
    query: async () => {
      throw new Error('DB offline');
    },
  } as any);

  const service = new TimelinesService(db as any, seasonsBridge as any, actorsService);
  return { service, capture };
}

test('getNotes resolves board by slug and applies latest ordering, date range, and limit/offset', async () => {
  const { service, capture } = createMockService({
    boards: [
      {
        id: 'board-coding-sessions',
        slug: 'coding-sessions',
        title: 'Сессии Кодинга',
        privacy: 'PUBLIC',
        ownerProfileId: OWNER_ID,
      },
    ],
    notes: [{ id: 'n-1', boardId: 'board-coding-sessions', text: 'Latest note' }],
  });

  const rows = await service.getNotes({
    boardId: 'coding-sessions',
    fromDate: '2026-11-20',
    toDate: '2026-11-26',
    limit: 15,
    offset: 5,
    order: 'latest',
  });

  assert.equal(rows.length, 1);
  const noteQuery = capture.queries.find((q) => q.sql.includes('n.board_id AS "boardId"'));
  assert.ok(noteQuery, 'Expected SQL query against timeline_notes');
  assert.ok(noteQuery.sql.includes('n.board_id = $1'));
  assert.ok(noteQuery.sql.includes('n.date_key >= $2'));
  assert.ok(noteQuery.sql.includes('n.date_key <= $3'));
  assert.ok(noteQuery.sql.includes('ORDER BY n.date_key DESC, n.time_minutes DESC, n.created_at DESC'));
  assert.ok(noteQuery.sql.includes('LIMIT $4 OFFSET $5'));
  assert.deepEqual(noteQuery.params, ['board-coding-sessions', '2026-11-20', '2026-11-26', 15, 5]);
});

test('getNotes throws NotFoundException for unknown board and ForbiddenException for private board', async () => {
  const { service } = createMockService({
    boards: [
      {
        id: 'board-secret',
        slug: 'secret-diary',
        title: 'Secret',
        privacy: 'PRIVATE',
        ownerProfileId: OWNER_ID,
      },
    ],
  });

  await assert.rejects(
    () => service.getNotes({ boardId: 'non-existent-board', profileId: STRANGER_ID }),
    NotFoundException,
  );

  await assert.rejects(
    () => service.getNotes({ boardId: 'secret-diary', profileId: STRANGER_ID }),
    ForbiddenException,
  );
});

test('getNotes validates date filters and limit bounds', async () => {
  const { service } = createMockService({
    boards: [{ id: 'b-1', slug: 'b-1', privacy: 'PUBLIC', ownerProfileId: OWNER_ID }],
  });

  await assert.rejects(
    () => service.getNotes({ boardId: 'b-1', fromDate: '26-11-2026' }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.getNotes({ boardId: 'b-1', limit: 0 }),
    BadRequestException,
  );
});

test('createNote auto-resolves canonical actor metadata by actorId', async () => {
  const { service, capture } = createMockService({
    boards: [
      {
        id: 'board-tower-fire',
        slug: 'tower-fire',
        title: 'Башня Огня',
        privacy: 'PUBLIC',
        ownerProfileId: OWNER_ID,
      },
    ],
  });

  const created = await service.createNote(
    {
      boardId: 'tower-fire',
      actorId: 'actor-hades',
      title: 'MCP тест',
      text: 'Проверка авто-резолва персонажа #mcp',
    },
    OWNER_ID,
  );

  assert.equal(created.boardId, 'board-tower-fire');
  assert.equal(created.actorId, 'actor-hades');
  assert.equal(created.actorName, 'Аид');
  assert.equal(created.actorAvatar, 'hades');
  assert.equal(created.actorAccent, 'cyan');
  assert.match(created.dateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(created.time, /^\d{2}:\d{2}$/);

  const insertQuery = capture.queries.find((q) => q.sql.includes('INSERT INTO timeline_notes'));
  assert.ok(insertQuery);
  assert.equal(insertQuery.params[1], 'board-tower-fire');
  assert.equal(insertQuery.params[8], 'Аид');
});

test('getActorStats aggregates note counts for a specific board', async () => {
  const { service, capture } = createMockService({
    boards: [
      {
        id: 'board-tower-fire',
        slug: 'tower-fire',
        title: 'Башня Огня',
        privacy: 'PUBLIC',
        ownerProfileId: OWNER_ID,
      },
    ],
    statsRows: [
      { actorId: 'actor-hades', actorName: 'Аид', notesCount: 3, lastDateKey: '2026-11-26' },
      { actorId: 'actor-akin', actorName: 'Акин', notesCount: 2, lastDateKey: '2026-11-25' },
    ],
  });

  const stats = await service.getActorStats({ boardId: 'tower-fire' });
  assert.equal(stats.boardId, 'board-tower-fire');
  assert.equal(stats.totalNotes, 5);
  assert.equal(stats.actors.length, 2);
  const statsQuery = capture.queries.find((q) => q.sql.includes('GROUP BY n.actor_id'));
  assert.deepEqual(statsQuery?.params, [['board-tower-fire']]);
});

test('getNotes with compact=true omits heavy metadata and empty optional fields', async () => {
  const { service, capture } = createMockService({
    boards: [
      {
        id: 'board-coding-sessions',
        slug: 'coding-sessions',
        privacy: 'PUBLIC',
        ownerProfileId: OWNER_ID,
      },
    ],
    notes: [
      {
        id: 'note-c1',
        boardId: 'board-coding-sessions',
        dateKey: '2026-11-26',
        time: '18:00',
        type: 'action',
        actorId: 'actor-hades',
        actorName: 'Аид',
        subActorId: null,
        title: null,
        text: 'Компактная запись',
        tags: [],
        isPinned: false,
        replyToNoteId: null,
        crossRefs: [
          {
            id: 'cl-1',
            targetBoardId: 'board-tower-fire',
            targetNoteId: 'note-f1',
            targetSnippet: 'very long ignored snippet',
            relationLabel: 'Башня Огня',
          },
        ],
      },
    ],
  });

  const rows = await service.getNotes({
    boardId: 'coding-sessions',
    compact: true,
    limit: 5,
    order: 'latest',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'note-c1');
  assert.equal('subActorId' in rows[0], false);
  assert.equal('title' in rows[0], false);
  assert.equal('tags' in rows[0], false);
  assert.equal('isPinned' in rows[0], false);
  assert.equal('mediaAttachments' in rows[0], false);
  assert.deepEqual(rows[0].crossRefs, [
    { targetBoardId: 'board-tower-fire', targetNoteId: 'note-f1', relationLabel: 'Башня Огня' },
  ]);

  const noteQuery = capture.queries.find((q) => q.sql.includes('n.board_id AS "boardId"'));
  assert.ok(noteQuery && !noteQuery.sql.includes('media_attachments'));
});
