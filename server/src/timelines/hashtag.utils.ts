const INLINE_HASHTAG_RE =
  /(^|[\s(\[«"'])#([\p{L}\p{N}_](?:[\p{L}\p{N}_-]{0,47}[\p{L}\p{N}_])?)/gu;

/** Normalizes a tag string by trimming, stripping leading `#`, and lowercasing. */
export function normalizeTag(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  return /^[\p{L}\p{N}_][\p{L}\p{N}_:-]{0,48}$/u.test(cleaned) ? cleaned : '';
}

/** Extracts unique normalized `#hashtags` from note text in order of appearance. */
export function extractHashtagsFromText(text?: string | null): string[] {
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

/** Merges inline `#hashtags` from text with explicit tags array, normalized and deduplicated. */
export function mergeNoteTags(text?: string | null, explicitTags?: unknown): string[] {
  const inline = extractHashtagsFromText(text);
  const manual = Array.isArray(explicitTags)
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

/**
 * Syncs tags when message text is updated without an explicit tags array:
 * keeps non-inline tags, drops inline hashtags removed from text, adds newly added inline hashtags.
 */
export function syncTagsOnTextEdit(
  oldText: string,
  newText: string,
  existingTags: unknown = [],
): string[] {
  const oldInline = new Set(extractHashtagsFromText(oldText));
  const extraTags = Array.isArray(existingTags)
    ? existingTags
        .map((t) => normalizeTag(t))
        .filter((t) => Boolean(t) && !oldInline.has(t))
    : [];
  return mergeNoteTags(newText, extraTags);
}
