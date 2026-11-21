export interface TextHashtagSegment {
  kind: 'text' | 'hashtag';
  value: string;
  tag?: string;
}

export interface HashtagCountItem {
  tag: string;
  count: number;
}

const INLINE_HASHTAG_RE =
  /(^|[\s(\[«"'])#([\p{L}\p{N}_](?:[\p{L}\p{N}_-]{0,47}[\p{L}\p{N}_])?)/gu;

/** Normalizes a tag string by trimming, stripping leading `#`, and lowercasing. */
export function normalizeTag(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  return /^[\p{L}\p{N}_][\p{L}\p{N}_:-]{0,48}$/u.test(cleaned) ? cleaned : '';
}

/** Extracts unique normalized `#hashtags` from message text in order of appearance. */
export function extractHashtagsFromText(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  INLINE_HASHTAG_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_HASHTAG_RE.exec(text)) !== null) {
    const tag = normalizeTag(match[2]);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** Parses manual tags input separated by commas, semicolons, or whitespace. */
export function parseTagsInput(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const tag = normalizeTag(part);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** Merges inline `#hashtags` from text with explicit tags (array or raw string), deduplicated. */
export function mergeNoteTags(text: string, explicitTags?: string[] | string): string[] {
  const inline = extractHashtagsFromText(text);
  const manual =
    typeof explicitTags === 'string'
      ? parseTagsInput(explicitTags)
      : Array.isArray(explicitTags)
        ? explicitTags.map((t) => normalizeTag(t)).filter(Boolean)
        : [];

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...inline, ...manual]) {
    if (!seen.has(tag)) {
      seen.add(tag);
      merged.push(tag);
    }
  }
  return merged;
}

/** Returns tags that are not already written inline as `#tag` inside `text`. */
export function getExtraTagsNotInText(text: string, tags?: string[]): string[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  const inlineSet = new Set(extractHashtagsFromText(text));
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag && !inlineSet.has(tag) && !seen.has(tag)) {
      seen.add(tag);
      extra.push(tag);
    }
  }
  return extra;
}

/**
 * Syncs tags when message text is edited without an explicit tag field:
 * preserves non-inline tags, removes deleted inline hashtags, and adds new inline hashtags.
 */
export function syncTagsOnTextEdit(
  oldText: string,
  newText: string,
  existingTags: string[] = [],
): string[] {
  const extraTags = getExtraTagsNotInText(oldText, existingTags);
  return mergeNoteTags(newText, extraTags);
}

/** Splits message text into plain-text and `#hashtag` segments for safe Angular rendering. */
export function tokenizeTextWithHashtags(text: string): TextHashtagSegment[] {
  if (!text) return [];
  const segments: TextHashtagSegment[] = [];
  INLINE_HASHTAG_RE.lastIndex = 0;

  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_HASHTAG_RE.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    const tagBody = match[2];
    const normalized = normalizeTag(tagBody);
    const hashStart = match.index + prefix.length;

    if (!normalized) continue;

    if (hashStart > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, hashStart) });
    }

    const tokenText = `#${tagBody}`;
    segments.push({
      kind: 'hashtag',
      value: tokenText,
      tag: normalized,
    });
    cursor = hashStart + tokenText.length;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }

  return segments;
}

/** Checks if a note has the given tag in either `note.tags` or inline `#hashtags` in `note.text`. */
export function noteHasTag(
  note: { text?: string | null; tags?: string[] | null },
  targetTag: string,
): boolean {
  const normalizedTarget = normalizeTag(targetTag);
  if (!normalizedTarget) return true;
  const all = mergeNoteTags(note.text || '', note.tags || []);
  return all.includes(normalizedTarget);
}

/** Aggregates unique tags across notes with frequency counts (sorted by count desc, then name). */
export function collectHashtagCounts(
  notes: ReadonlyArray<{ text?: string | null; tags?: string[] | null }>,
): HashtagCountItem[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const noteTags = mergeNoteTags(note.text || '', note.tags || []);
    for (const tag of noteTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ru'));
}

/** Appends `#tag` to message text if not already present inline; otherwise returns text unchanged. */
export function appendHashtagToText(text: string, rawTag: string): string {
  const tag = normalizeTag(rawTag);
  if (!tag) return text;
  const existing = extractHashtagsFromText(text);
  if (existing.includes(tag)) return text;
  const trimmedRight = text.replace(/\s+$/, '');
  return trimmedRight ? `${trimmedRight} #${tag}` : `#${tag}`;
}

/** Detects if text currently ends with an incomplete `#prefix` token for live autocomplete. */
export function getTrailingHashtagPrefix(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:^|[\s(\[«"'])#([\p{L}\p{N}_-]{0,30})$/u);
  return match ? match[1].toLowerCase() : null;
}

/** Replaces the trailing `#prefix` token in `text` with `#fullTag `. */
export function applyHashtagAutocomplete(text: string, rawTag: string): string {
  const tag = normalizeTag(rawTag);
  if (!tag) return text;
  return text.replace(/(^|[\s(\[«"'])#[\p{L}\p{N}_-]{0,30}$/u, `$1#${tag} `);
}
