import { CloudDayNote, TimelineBoard } from '../../core/models/flow.models';
import { mergeNoteTags, noteHasTag } from '../../core/utils/hashtag.utils';

export type NoteDeepLinkResolution =
  | {
      status: 'FOUND';
      note: CloudDayNote;
      board: TimelineBoard;
      needsCanonicalRedirect: boolean;
    }
  | {
      status: 'BOARD_NOT_ACCESSIBLE';
      note: CloudDayNote;
    }
  | {
      status: 'NOT_FOUND';
    };

export interface NoteFilterState {
  actorFilter: string | null;
  tagFilter: string | null;
  searchQuery: string;
}

export interface NoteFilterClearPlan {
  clearActor: boolean;
  clearTag: boolean;
  clearSearch: boolean;
}

/** Builds Angular router commands for a canonical board + note deep-link. */
export function buildTimelineNoteCommands(boardSlug: string, noteId: string): string[] {
  return ['/timelines', boardSlug, 'notes', noteId];
}

/** Builds a relative path for a timeline message, falling back to `/timelines/notes/:noteId`. */
export function buildTimelineNotePath(
  boardSlug: string | null | undefined,
  noteId: string,
): string {
  const encodedId = encodeURIComponent(noteId);
  if (boardSlug && boardSlug.trim()) {
    return `/timelines/${encodeURIComponent(boardSlug.trim())}/notes/${encodedId}`;
  }
  return `/timelines/notes/${encodedId}`;
}

/** Builds an absolute shareable URL for a timeline message. */
export function buildTimelineNoteUrl(
  boardSlug: string | null | undefined,
  noteId: string,
  origin?: string,
): string {
  const base =
    origin ?? (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  return `${base}${buildTimelineNotePath(boardSlug, noteId)}`;
}

/**
 * Resolves a note deep-link against the currently visible boards and loaded notes,
 * indicating whether the URL should be canonicalized to `/timelines/:boardSlug/notes/:noteId`.
 */
export function resolveNoteDeepLink(input: {
  noteId: string;
  routeBoardSlug: string | null;
  boards: TimelineBoard[];
  notes: CloudDayNote[];
}): NoteDeepLinkResolution {
  const note = input.notes.find((n) => n.id === input.noteId);
  if (!note) {
    return { status: 'NOT_FOUND' };
  }

  const noteBoardId = note.boardId || 'board-global-day';
  const board = input.boards.find((b) => b.id === noteBoardId);
  if (!board) {
    return { status: 'BOARD_NOT_ACCESSIBLE', note };
  }

  const needsCanonicalRedirect = input.routeBoardSlug !== board.slug;
  return {
    status: 'FOUND',
    note,
    board,
    needsCanonicalRedirect,
  };
}

/** Determines which active workspace filters would hide a targeted note and must be cleared. */
export function planFilterClearForNote(
  note: CloudDayNote,
  filters: NoteFilterState,
): NoteFilterClearPlan {
  const clearActor = Boolean(
    filters.actorFilter &&
      note.actorId !== filters.actorFilter &&
      note.subActorId !== filters.actorFilter,
  );
  const clearTag = Boolean(filters.tagFilter && !noteHasTag(note, filters.tagFilter));

  const q = filters.searchQuery.trim().toLowerCase();
  let clearSearch = false;
  if (q) {
    const tagNeedle = q.replace(/^#+/, '');
    const matchesSearch =
      note.text.toLowerCase().includes(q) ||
      (note.title || '').toLowerCase().includes(q) ||
      note.actorName.toLowerCase().includes(q) ||
      mergeNoteTags(note.text, note.tags).some((t) => t.includes(tagNeedle));
    clearSearch = !matchesSearch;
  }

  return { clearActor, clearTag, clearSearch };
}

/** Copies text to clipboard when available, returning true on success. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
