import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TimelinesService } from '../src/timelines/timelines.service';

const OWNER_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

function createServiceWithMockDb(opts: {
  noteRow?: Record<string, unknown> | null;
  boardRow?: Record<string, unknown> | null;
  membersRows?: Array<Record<string, unknown>>;
}) {
  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM timeline_boards b')) {
        return { rows: opts.boardRow ? [opts.boardRow] : [] };
      }
      if (sql.includes('FROM timeline_notes n')) {
        return { rows: opts.noteRow ? [opts.noteRow] : [] };
      }
      if (sql.includes('FROM timeline_board_members')) {
        return { rows: opts.membersRows ?? [] };
      }
      return { rows: [] };
    },
  };
  return new TimelinesService(db as any, {} as any);
}

test('getNoteById returns note with boardSlug when caller can view board', async () => {
  const service = createServiceWithMockDb({
    noteRow: {
      id: 'note-easy-1',
      boardId: 'board-private',
      dateKey: '2026-11-23',
      time: '21:15',
      text: 'Роутинг сообщений готов',
    },
    boardRow: {
      id: 'board-private',
      slug: 'easy-routing-board',
      title: 'Easy Board',
      privacy: 'PRIVATE',
      ownerProfileId: OWNER_ID,
    },
  });

  const result = await service.getNoteById('note-easy-1', OWNER_ID);
  assert.equal(result.id, 'note-easy-1');
  assert.equal(result.boardSlug, 'easy-routing-board');
});

test('getNoteById throws ForbiddenException for private board non-member', async () => {
  const service = createServiceWithMockDb({
    noteRow: {
      id: 'note-secret',
      boardId: 'board-private',
    },
    boardRow: {
      id: 'board-private',
      slug: 'secret-board',
      title: 'Secret Board',
      privacy: 'PRIVATE',
      ownerProfileId: OWNER_ID,
    },
  });

  await assert.rejects(() => service.getNoteById('note-secret', STRANGER_ID), ForbiddenException);
});

test('getNoteById throws NotFoundException when note does not exist', async () => {
  const service = createServiceWithMockDb({ noteRow: null });
  await assert.rejects(() => service.getNoteById('missing-note', OWNER_ID), NotFoundException);
});

test('getNoteById throws BadRequestException for blank noteId', async () => {
  const service = createServiceWithMockDb({});
  await assert.rejects(() => service.getNoteById('   ', OWNER_ID), BadRequestException);
});
