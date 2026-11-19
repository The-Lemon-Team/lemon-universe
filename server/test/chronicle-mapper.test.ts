import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeCursor,
  encodeCursor,
  noteToChronicleEvent,
  truncate,
  typeFromTags,
} from '../src/timelines/chronicle.mapper';

test('cursor roundtrip and rejects garbage', () => {
  const c = encodeCursor('2026-11-19T10:00:00.123456Z', 'note-1');
  assert.deepEqual(decodeCursor(c), { createdAt: '2026-11-19T10:00:00.123456Z', id: 'note-1' });
  assert.equal(decodeCursor('!!!'), null);
  assert.equal(decodeCursor(undefined), null);
});

test('type is derived from tags', () => {
  assert.equal(typeFromTags(['milestone']), 'MILESTONE');
  assert.equal(typeFromTags(['x', 'deploy']), 'DEPLOY');
  assert.equal(typeFromTags(['agent-summary']), 'NOTE');
});

test('note maps to event with app scope, truncation and default externalRef', () => {
  const ev = noteToChronicleEvent({
    id: 'n1',
    boardId: 'b1',
    createdAt: '2026-11-19T10:00:00.000000Z',
    text: 'x'.repeat(900),
    tags: ['app:web', 'deploy'],
    actorName: 'Antigravity Agent',
  });
  assert.equal(ev.scope, 'APP');
  assert.equal(ev.targetAppName, 'web');
  assert.equal(ev.type, 'DEPLOY');
  assert.equal(ev.description.length, 500);
  assert.equal(ev.origin, 'TIMELINES');
  assert.equal(ev.externalRef, 'timelines:note:n1');
});

test('truncate keeps short text', () => {
  assert.equal(truncate('  hi '), 'hi');
});
