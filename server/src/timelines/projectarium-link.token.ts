import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type LinkScope = 'chronicle:read' | 'chronicle:write';
export const LINK_SCOPES: LinkScope[] = ['chronicle:read', 'chronicle:write'];
export const LINK_TOKEN_PREFIX = 'lmt_';

export interface LinkSubject {
  boardIds: string[];
  scopes: LinkScope[];
  revokedAt?: Date | string | null;
}

/** Generates an opaque token. Shown to the owner once; only its hash is stored. */
export function generateLinkToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const token = LINK_TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return { token, tokenHash: hashLinkToken(token), tokenPrefix: token.slice(0, 8) };
}

export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyLinkToken(token: string, storedHash: string): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashLinkToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function extractBearer(header?: string): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header || '').trim());
  return m ? m[1] : null;
}

export function normalizeScopes(input: unknown): LinkScope[] {
  const list = Array.isArray(input) ? input : ['chronicle:read'];
  const valid = list.filter((s): s is LinkScope => LINK_SCOPES.includes(s as LinkScope));
  return Array.from(new Set(valid));
}

export function linkAllows(link: LinkSubject, boardId: string, scope: LinkScope): boolean {
  if (link.revokedAt) return false;
  return link.scopes.includes(scope) && link.boardIds.includes(boardId);
}
