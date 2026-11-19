import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearer,
  generateLinkToken,
  hashLinkToken,
  linkAllows,
  normalizeScopes,
  verifyLinkToken,
} from '../src/timelines/projectarium-link.token';

test('token verifies only against its own hash', () => {
  const a = generateLinkToken();
  const b = generateLinkToken();
  assert.ok(a.token.startsWith('lmt_'));
  assert.equal(a.tokenHash, hashLinkToken(a.token));
  assert.ok(verifyLinkToken(a.token, a.tokenHash));
  assert.ok(!verifyLinkToken(b.token, a.tokenHash));
  assert.ok(!verifyLinkToken('', a.tokenHash));
});

test('extractBearer parses header', () => {
  assert.equal(extractBearer('Bearer abc'), 'abc');
  assert.equal(extractBearer('Basic abc'), null);
  assert.equal(extractBearer(undefined), null);
});

test('normalizeScopes drops unknown, defaults to read', () => {
  assert.deepEqual(normalizeScopes(undefined), ['chronicle:read']);
  assert.deepEqual(normalizeScopes(['chronicle:write', 'x', 'chronicle:write']), ['chronicle:write']);
});

test('linkAllows enforces board, scope and revocation', () => {
  const link = { boardIds: ['b1', 'b2'], scopes: ['chronicle:read' as const] };
  assert.ok(linkAllows(link, 'b1', 'chronicle:read'));
  assert.ok(!linkAllows(link, 'b3', 'chronicle:read'));
  assert.ok(!linkAllows(link, 'b1', 'chronicle:write'));
  assert.ok(!linkAllows({ ...link, revokedAt: new Date() }, 'b1', 'chronicle:read'));
});
