export type ChronicleEventType = 'NOTE' | 'MILESTONE' | 'DEPLOY';
export type ChronicleScope = 'PROJECT' | 'APP';

export const CHRONICLE_DESCRIPTION_MAX = 500;
export const CHRONICLE_ORIGIN_PROJECTARIUM = 'PROJECTARIUM';
export const CHRONICLE_ORIGIN_TIMELINES = 'TIMELINES';

export interface ChronicleEvent {
  id: string;
  boardId: string;
  timestamp: string;
  type: ChronicleEventType;
  scope: ChronicleScope;
  targetAppName?: string;
  author: string;
  title?: string;
  description: string;
  tags: string[];
  origin: string;
  externalRef: string;
  cursor: string;
}

export interface ChronicleNoteRow {
  id: string;
  boardId: string;
  createdAt: string; // ISO with microseconds, from DB
  title?: string | null;
  text: string;
  tags?: string[] | null;
  actorName?: string | null;
  origin?: string | null;
  externalRef?: string | null;
}

export function typeFromTags(tags: string[] = []): ChronicleEventType {
  if (tags.includes('milestone')) return 'MILESTONE';
  if (tags.includes('deploy')) return 'DEPLOY';
  return 'NOTE';
}

export function tagsFromType(type?: string): string[] {
  if (type === 'MILESTONE') return ['milestone'];
  if (type === 'DEPLOY') return ['deploy'];
  return [];
}

export function truncate(text: string, max = CHRONICLE_DESCRIPTION_MAX): string {
  const t = (text || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string | null): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const i = raw.lastIndexOf('|');
    if (i <= 0) return null;
    const createdAt = raw.slice(0, i);
    if (Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

export function noteToChronicleEvent(row: ChronicleNoteRow): ChronicleEvent {
  const tags = row.tags ?? [];
  const appTag = tags.find((t) => t.startsWith('app:'));
  return {
    id: row.id,
    boardId: row.boardId,
    timestamp: new Date(row.createdAt).toISOString(),
    type: typeFromTags(tags),
    scope: appTag ? 'APP' : 'PROJECT',
    targetAppName: appTag ? appTag.slice(4) : undefined,
    author: row.actorName || 'Unknown',
    title: row.title || undefined,
    description: truncate(row.text),
    tags,
    origin: row.origin || CHRONICLE_ORIGIN_TIMELINES,
    // For notes that came from Projectarium keep its own ref so it can match its record.
    externalRef: row.externalRef || `timelines:note:${row.id}`,
    cursor: encodeCursor(row.createdAt, row.id),
  };
}
