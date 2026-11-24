import test from 'node:test';
import assert from 'node:assert/strict';
import { SeasonsBridgeService } from '../src/seasons/seasons-bridge.service';

function createMockDb(profileRow: { seasonsUserId: string | null; seasonsUserKey: string | null } | null) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    queries,
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (sql.includes('FROM profiles')) {
        return { rows: profileRow ? [profileRow] : [] };
      }
      return { rows: [] };
    },
  };
}

test('resolveAccountId returns undefined when profile has no mapped seasons_user_id', async () => {
  const db = createMockDb({ seasonsUserId: null, seasonsUserKey: null });
  const svc = new SeasonsBridgeService(db as any);
  try {
    const accountId = await svc.resolveAccountId('1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b');
    assert.equal(accountId, undefined);
  } finally {
    (svc as any).mediaAxon?.stop();
  }
});

test('syncTimelineNote omits ownerUserId when profile has no seasons_user_id mapped', async () => {
  const db = createMockDb({ seasonsUserId: null, seasonsUserKey: null });
  const svc = new SeasonsBridgeService(db as any);
  try {
    let capturedIngestPayload: any = null;
    (svc as any).ensureBoardTopology = async () => undefined;
    (svc as any).defaultBridge = {
      ingestNote: async (input: any) => {
        capturedIngestPayload = input;
        return { noteId: 'seasons-note-1', action: 'CREATED' };
      },
    };

    const res = await svc.syncTimelineNote(
      {
        id: 'note-1',
        boardId: 'board-lemon-space',
        dateKey: '2026-11-24',
        time: '22:42',
        type: 'action',
        actorId: 'actor-master-ai',
        actorName: 'Мастер-АИ',
        actorAvatar: 'military_tech',
        authorProfileId: '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8',
        text: 'Test bounty note',
      },
      {
        id: 'board-lemon-space',
        slug: 'lemon-space',
        title: 'Lemon Space',
        privacy: 'PUBLIC',
        boardKind: 'CUSTOM_PROJECT',
        boardMode: 'TIMELINE',
        ownerProfileId: '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8',
        seasonsStreamSlug: 'lemon-universe',
        seasonsFeedSlug: 'universe-lemon-space',
      },
    );

    assert.equal(res.synced, true);
    assert.equal(res.noteId, 'seasons-note-1');
    assert.equal(capturedIngestPayload.privacy, 'private');
    assert.equal('ownerUserId' in capturedIngestPayload, false);
    assert.equal(capturedIngestPayload.metadata.authorProfileId, '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8');
    assert.equal(capturedIngestPayload.metadata.seasonsAccountId, null);
  } finally {
    (svc as any).mediaAxon?.stop();
  }
});

test('syncTimelineNote passes ownerUserId when profile has explicit seasons_user_id', async () => {
  const db = createMockDb({ seasonsUserId: 'usr-linked-123', seasonsUserKey: null });
  const svc = new SeasonsBridgeService(db as any);
  try {
    let capturedIngestPayload: any = null;
    (svc as any).ensureBoardTopology = async () => undefined;
    (svc as any).defaultBridge = {
      ingestNote: async (input: any) => {
        capturedIngestPayload = input;
        return { noteId: 'seasons-note-2', action: 'CREATED' };
      },
    };

    const res = await svc.syncTimelineNote(
      {
        id: 'note-2',
        boardId: 'board-lemon-space',
        dateKey: '2026-11-24',
        time: '22:45',
        type: 'action',
        actorId: 'actor-master-ai',
        actorName: 'Мастер-АИ',
        actorAvatar: 'military_tech',
        authorProfileId: '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8',
        text: 'Linked user note',
      },
      {
        id: 'board-lemon-space',
        slug: 'lemon-space',
        title: 'Lemon Space',
        privacy: 'PUBLIC',
        boardKind: 'CUSTOM_PROJECT',
        boardMode: 'TIMELINE',
        ownerProfileId: '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8',
        seasonsStreamSlug: 'lemon-universe',
        seasonsFeedSlug: 'universe-lemon-space',
      },
    );

    assert.equal(res.synced, true);
    assert.equal(res.seasonsAccountId, 'usr-linked-123');
    assert.equal(capturedIngestPayload.ownerUserId, 'usr-linked-123');
  } finally {
    (svc as any).mediaAxon?.stop();
  }
});

test('syncTimelineNote does not split surrogate-pair emojis at summary boundary 180', async () => {
  const db = createMockDb({ seasonsUserId: null, seasonsUserKey: null });
  const svc = new SeasonsBridgeService(db as any);
  try {
    let capturedIngestPayload: any = null;
    (svc as any).ensureBoardTopology = async () => undefined;
    (svc as any).defaultBridge = {
      ingestNote: async (input: any) => {
        capturedIngestPayload = input;
        return { noteId: 'seasons-note-3', action: 'CREATED' };
      },
    };

    const textWithBoundaryEmoji = `${'a'.repeat(179)}🟢 trailing`;
    await svc.syncTimelineNote(
      {
        id: 'note-emoji',
        boardId: 'board-lemon-space',
        dateKey: '2026-11-24',
        time: '22:45',
        type: 'action',
        actorId: 'actor-master-ai',
        actorName: 'Мастер-АИ',
        actorAvatar: 'military_tech',
        text: textWithBoundaryEmoji,
      },
      {
        id: 'board-lemon-space',
        slug: 'lemon-space',
        title: 'Lemon Space',
        privacy: 'PUBLIC',
        boardKind: 'CUSTOM_PROJECT',
        boardMode: 'TIMELINE',
        ownerProfileId: '3e8c4fb3-a50d-4ee9-b740-c6f8b2ffe4d8',
        seasonsStreamSlug: 'lemon-universe',
        seasonsFeedSlug: 'universe-lemon-space',
      },
    );

    assert.equal(capturedIngestPayload.summary.endsWith('🟢'), true);
    assert.equal(capturedIngestPayload.summary.isWellFormed(), true);
  } finally {
    (svc as any).mediaAxon?.stop();
  }
});
