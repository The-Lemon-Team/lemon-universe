import { CloudDayNote, FlowStatus, FlowType, TimelineBoard } from '../../core/models/flow.models';
import {
  buildTimelineNoteCommands,
  buildTimelineNotePath,
  buildTimelineNoteUrl,
  planFilterClearForNote,
  resolveNoteDeepLink,
} from './timeline-note-routing.utils';

function makeBoard(partial: Partial<TimelineBoard>): TimelineBoard {
  return {
    id: partial.id ?? 'board-1',
    slug: partial.slug ?? 'personal-diary',
    title: partial.title ?? 'Личный Дневник',
    description: partial.description ?? 'Описание борда',
    icon: partial.icon ?? 'menu_book',
    colorTheme: partial.colorTheme ?? 'emerald',
    boardKind: partial.boardKind ?? 'CUSTOM_PROJECT',
    boardMode: partial.boardMode ?? 'DIARY',
    privacy: partial.privacy ?? 'PRIVATE',
    flowId: partial.flowId ?? 'flow-1',
    flowType: partial.flowType ?? FlowType.CONTEXT,
    flowStatus: partial.flowStatus ?? FlowStatus.ACTIVE,
    seasonsStreamSlug: partial.seasonsStreamSlug ?? 'lemon-universe',
    seasonsFeedSlug: partial.seasonsFeedSlug ?? 'universe-personal-diary',
    ...partial,
  };
}

function makeNote(partial: Partial<CloudDayNote>): CloudDayNote {
  return {
    id: partial.id ?? 'note-1',
    boardId: partial.boardId ?? 'board-1',
    dateKey: partial.dateKey ?? '2026-11-23',
    time: partial.time ?? '12:00',
    timeMinutes: partial.timeMinutes ?? 720,
    actorId: partial.actorId ?? 'actor-easy',
    actorName: partial.actorName ?? 'Easy (Изи)',
    actorAvatar: partial.actorAvatar ?? 'easy',
    actorAccent: partial.actorAccent ?? 'cyan',
    type: partial.type ?? 'thought',
    text: partial.text ?? 'Архитектура роутинга #routing',
    tags: partial.tags ?? ['routing'],
    votesCount: partial.votesCount ?? 1,
    supporters: partial.supporters ?? [],
    createdAt: partial.createdAt ?? '2026-11-23T12:00:00.000Z',
    ...partial,
  };
}

describe('timeline-note-routing.utils', () => {
  it('builds router commands, paths, and shareable URLs for notes', () => {
    expect(buildTimelineNoteCommands('personal-diary', 'note-42')).toEqual([
      '/timelines',
      'personal-diary',
      'notes',
      'note-42',
    ]);
    expect(buildTimelineNotePath('personal-diary', 'note-42')).toBe(
      '/timelines/personal-diary/notes/note-42',
    );
    expect(buildTimelineNotePath(null, 'note-42')).toBe('/timelines/notes/note-42');
    expect(buildTimelineNoteUrl('personal-diary', 'note-42', 'http://localhost:4210')).toBe(
      'http://localhost:4210/timelines/personal-diary/notes/note-42',
    );
  });

  it('resolves deep-links and detects canonical redirect needs', () => {
    const board = makeBoard({ id: 'board-1', slug: 'personal-diary' });
    const note = makeNote({ id: 'note-42', boardId: 'board-1' });

    expect(
      resolveNoteDeepLink({
        noteId: 'note-42',
        routeBoardSlug: 'personal-diary',
        boards: [board],
        notes: [note],
      }),
    ).toEqual({
      status: 'FOUND',
      note,
      board,
      needsCanonicalRedirect: false,
    });

    expect(
      resolveNoteDeepLink({
        noteId: 'note-42',
        routeBoardSlug: null,
        boards: [board],
        notes: [note],
      }),
    ).toEqual({
      status: 'FOUND',
      note,
      board,
      needsCanonicalRedirect: true,
    });

    expect(
      resolveNoteDeepLink({
        noteId: 'note-42',
        routeBoardSlug: null,
        boards: [],
        notes: [note],
      }),
    ).toEqual({
      status: 'BOARD_NOT_ACCESSIBLE',
      note,
    });

    expect(
      resolveNoteDeepLink({
        noteId: 'missing',
        routeBoardSlug: 'personal-diary',
        boards: [board],
        notes: [note],
      }),
    ).toEqual({
      status: 'NOT_FOUND',
    });
  });

  it('plans clearing only the filters that hide a targeted note', () => {
    const note = makeNote({
      actorId: 'actor-easy',
      text: 'Тестовое сообщение про #routing',
      tags: ['routing'],
    });

    expect(
      planFilterClearForNote(note, {
        actorFilter: 'actor-easy',
        tagFilter: 'routing',
        searchQuery: 'роутинг',
      }),
    ).toEqual({
      clearActor: false,
      clearTag: false,
      clearSearch: true,
    });

    expect(
      planFilterClearForNote(note, {
        actorFilter: 'actor-alexey',
        tagFilter: 'другое',
        searchQuery: '#routing',
      }),
    ).toEqual({
      clearActor: true,
      clearTag: true,
      clearSearch: false,
    });
  });
});
