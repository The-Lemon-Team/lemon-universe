import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  ArenaAccentColor,
  ArenaActorCard,
  BoardMemberRole,
  BoardPrivacy,
  CloudDayNote,
  CloudItemType,
  FlowStatus,
  FlowType,
  TimelineBoard,
  TimelineBoardKind,
  TimelineBoardMember,
  TimelineBoardMode,
  TimelineMediaAttachment,
  TimelineNodeCrossRef,
} from '../../core/models/flow.models';
import { ApiService } from '../../core/services/api.service';
import { SEED_HERO_CLOUD_NOTES } from '../../core/services/hero-notes.seeds';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { readWithLegacyMigration } from '../../core/services/neuron-arena.storage';
import { ProfileService } from '../../core/services/profile.service';
import { SeasonsTimelineBridgeService } from '../../core/services/seasons-timeline-bridge.service';
import {
  canManageBoardMembers,
  canPostToBoard,
  canViewBoard,
  getBoardPrivacy,
  validateCrossLinkAccess,
} from '../timelines.privacy';

const STORAGE_BOARDS_KEY = 'lemon-universe:timelines-boards-v2';
const LEGACY_BOARDS_KEY = 'lemon-universe:timeline-boards-v1';
const STORAGE_NOTES_KEY = 'lemon-universe:cloud-notes-v8';

const HUMAN_DEFAULT_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
const AGENT_DEFAULT_ID = 'a7e49c10-9100-4b22-a811-9000a6e17001';

const DEFAULT_BOARDS: TimelineBoard[] = [
  {
    id: 'board-global-day',
    slug: 'global-day',
    title: '🌍 Глобальный Таймлайн Дня',
    description:
      'Главная публичная лента дня персонажей Lemon Universe. Поддерживает кросс-ссылки от участников и агентов в публичном контуре.',
    icon: 'public',
    colorTheme: 'amber',
    vibeId: 'CHRONO_DAYFLOW',
    boardKind: 'GLOBAL_DAY',
    boardMode: 'PARTY_CLOUD',
    privacy: 'PUBLIC',
    ownerProfileId: HUMAN_DEFAULT_ID,
    defaultActorId: 'actor-alexey',
    flowId: 'c0000001-0000-4000-8000-000000000001',
    flowType: FlowType.PROJECTION,
    flowStatus: FlowStatus.ACTIVE,
    activeSessionId: '55000001-0000-4000-8000-000000000001',
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-personal-feed',
    isDefault: true,
    members: [
      {
        id: 'm0000001-0000-4000-8000-000000000001',
        boardId: 'board-global-day',
        profileId: HUMAN_DEFAULT_ID,
        role: 'OWNER',
        canPost: true,
        canCrossLink: true,
        profileDisplayName: '👤 Мой Дом (Игрок)',
        profileHandle: 'default',
        profilePlayerType: 'HUMAN',
      },
      {
        id: 'm0000001-0000-4000-8000-000000000002',
        boardId: 'board-global-day',
        profileId: AGENT_DEFAULT_ID,
        role: 'AGENT',
        canPost: true,
        canCrossLink: true,
        profileDisplayName: '🤖 Игрок-Агент (AI Guild)',
        profileHandle: 'ai_agents',
        profilePlayerType: 'AGENT',
      },
    ],
  },
  {
    id: 'board-coding-sessions',
    slug: 'coding-sessions',
    title: '💻 TimeLine Board: Сессии Кодинга',
    description:
      'Сводка кодинг-сессий от лица Antigravity Agent и команды разработки. Синхронизируется через lemon-seasons-neurons.',
    icon: 'terminal',
    colorTheme: 'violet',
    vibeId: 'SYNTHWAVE',
    boardKind: 'CODING_SESSIONS',
    boardMode: 'AGENT_SUMMARY',
    privacy: 'PUBLIC',
    ownerProfileId: AGENT_DEFAULT_ID,
    defaultActorId: 'actor-antigravity-agent',
    flowId: 'c0000001-0000-4000-8000-000000000002',
    flowType: FlowType.MUTEX,
    flowStatus: FlowStatus.ACTIVE,
    activeSessionId: '55000001-0000-4000-8000-000000000002',
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-coding-sessions',
    isDefault: false,
    members: [
      {
        id: 'm0000001-0000-4000-8000-000000000003',
        boardId: 'board-coding-sessions',
        profileId: AGENT_DEFAULT_ID,
        role: 'OWNER',
        canPost: true,
        canCrossLink: true,
        profileDisplayName: '🤖 Игрок-Агент (AI Guild)',
        profileHandle: 'ai_agents',
        profilePlayerType: 'AGENT',
      },
      {
        id: 'm0000001-0000-4000-8000-000000000004',
        boardId: 'board-coding-sessions',
        profileId: HUMAN_DEFAULT_ID,
        role: 'EDITOR',
        canPost: true,
        canCrossLink: true,
        profileDisplayName: '👤 Мой Дом (Игрок)',
        profileHandle: 'default',
        profilePlayerType: 'HUMAN',
      },
    ],
  },
  {
    id: 'board-personal-diary',
    slug: 'personal-diary',
    title: '📓 Личный Дневник (Private)',
    description:
      'Приватный дневник мыслей, медиа и итогов дня от имени персонажа. Доступен владельцу и приглашённым участникам.',
    icon: 'menu_book',
    colorTheme: 'emerald',
    vibeId: 'NATURE_ZEN',
    boardKind: 'CUSTOM_PROJECT',
    boardMode: 'DIARY',
    privacy: 'PRIVATE',
    ownerProfileId: HUMAN_DEFAULT_ID,
    defaultActorId: 'actor-alexey',
    flowId: 'c0000001-0000-4000-8000-000000000009',
    flowType: FlowType.CONTEXT,
    flowStatus: FlowStatus.ACTIVE,
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-personal-diary',
    isDefault: false,
    members: [
      {
        id: 'm0000001-0000-4000-8000-000000000005',
        boardId: 'board-personal-diary',
        profileId: HUMAN_DEFAULT_ID,
        role: 'OWNER',
        canPost: true,
        canCrossLink: true,
        profileDisplayName: '👤 Мой Дом (Игрок)',
        profileHandle: 'default',
        profilePlayerType: 'HUMAN',
      },
    ],
  },
];

function loadLocalBoards(): TimelineBoard[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = readWithLegacyMigration(STORAGE_BOARDS_KEY, LEGACY_BOARDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TimelineBoard[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, TimelineBoard>();
          for (const d of DEFAULT_BOARDS) map.set(d.id, d);
          for (const b of parsed) {
            const existing = map.get(b.id);
            map.set(b.id, {
              ...existing,
              ...b,
              privacy: b.privacy || existing?.privacy || 'PUBLIC',
              boardMode: b.boardMode || existing?.boardMode || 'TIMELINE',
              members: b.members && b.members.length > 0 ? b.members : existing?.members || [],
            });
          }
          return Array.from(map.values());
        }
      }
    } catch {}
  }
  return DEFAULT_BOARDS;
}

function saveLocalBoards(boards: TimelineBoard[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(boards));
    } catch {}
  }
}

function loadLocalNotes(): CloudDayNote[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = readWithLegacyMigration(STORAGE_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CloudDayNote[]>;
        if (parsed && typeof parsed === 'object') {
          return Object.values(parsed).flat();
        }
      }
    } catch {}
  }
  return Object.values(SEED_HERO_CLOUD_NOTES).flat();
}

function saveLocalNotes(notes: CloudDayNote[]): void {
  if (typeof window !== 'undefined') {
    try {
      const byDate: Record<string, CloudDayNote[]> = {};
      for (const n of notes) {
        const dk = n.dateKey || '2026-11-06';
        if (!byDate[dk]) byDate[dk] = [];
        byDate[dk].push(n);
      }
      localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(byDate));
    } catch {}
  }
}

@Injectable({ providedIn: 'root' })
export class TimelinesService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly arena = inject(NeuronArenaService);
  private readonly seasonsBridge = inject(SeasonsTimelineBridgeService);

  private readonly boardsSubject = new BehaviorSubject<TimelineBoard[]>(loadLocalBoards());
  private readonly notesSubject = new BehaviorSubject<CloudDayNote[]>(loadLocalNotes());
  private readonly activeBoardIdSubject = new BehaviorSubject<string>('board-global-day');
  private readonly statusMessageSubject = new BehaviorSubject<string | null>(null);

  readonly allBoards$: Observable<TimelineBoard[]> = this.boardsSubject.asObservable();
  readonly allNotes$: Observable<CloudDayNote[]> = this.notesSubject.asObservable();
  readonly activeBoardId$: Observable<string> = this.activeBoardIdSubject.asObservable();
  readonly statusMessage$: Observable<string | null> = this.statusMessageSubject.asObservable();
  readonly actors$: Observable<ArenaActorCard[]> = this.arena.actors$;

  readonly visibleBoards$: Observable<TimelineBoard[]> = combineLatest([
    this.allBoards$,
    this.profileService.activeProfileId$,
  ]).pipe(
    map(([boards, profileId]) => boards.filter((b) => !b.isArchived && canViewBoard(b, profileId))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly activeBoard$: Observable<TimelineBoard | null> = combineLatest([
    this.visibleBoards$,
    this.activeBoardId$,
  ]).pipe(
    map(([boards, id]) => boards.find((b) => b.id === id) ?? boards[0] ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.profileService.activeProfileId$
      .pipe(distinctUntilChanged())
      .subscribe((profileId) => {
        this.refreshFromBackend(profileId);
      });
  }

  clearStatus(): void {
    this.statusMessageSubject.next(null);
  }

  setStatus(msg: string): void {
    this.statusMessageSubject.next(msg);
  }

  refreshFromBackend(profileId = this.profileService.currentProfileId): void {
    this.api
      .getTimelineBoards(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((remoteBoards) => {
        if (remoteBoards && remoteBoards.length > 0) {
          const mapById = new Map<string, TimelineBoard>();
          // Keep locally created private boards only if accessible, prefer backend truth for remote IDs
          for (const lb of this.boardsSubject.value) {
            if (!remoteBoards.some((rb) => rb.id === lb.id)) {
              mapById.set(lb.id, lb);
            }
          }
          for (const rb of remoteBoards) {
            mapById.set(rb.id, rb);
          }
          const merged = Array.from(mapById.values());
          this.boardsSubject.next(merged);
          saveLocalBoards(merged);

          const active = this.activeBoardIdSubject.value;
          const visible = merged.filter((b) => !b.isArchived && canViewBoard(b, profileId));
          if (visible.length > 0 && !visible.some((b) => b.id === active)) {
            this.activeBoardIdSubject.next(visible[0].id);
          }
        }
      });

    this.api
      .getTimelineNotes({ profileId })
      .pipe(catchError(() => of(null)))
      .subscribe((remoteNotes) => {
        if (remoteNotes && remoteNotes.length > 0) {
          const mapById = new Map<string, CloudDayNote>();
          for (const ln of this.notesSubject.value) mapById.set(ln.id, ln);
          for (const rn of remoteNotes) mapById.set(rn.id, rn);
          const merged = Array.from(mapById.values());
          this.notesSubject.next(merged);
          saveLocalNotes(merged);
        }
      });
  }

  selectBoard(boardIdOrSlug: string): void {
    const found = this.boardsSubject.value.find(
      (b) => b.id === boardIdOrSlug || b.slug === boardIdOrSlug,
    );
    if (found && canViewBoard(found, this.profileService.currentProfileId)) {
      this.activeBoardIdSubject.next(found.id);
    }
  }

  canPost(board: TimelineBoard): boolean {
    return canPostToBoard(board, this.profileService.currentProfileId);
  }

  canManageMembers(board: TimelineBoard): boolean {
    return canManageBoardMembers(board, this.profileService.currentProfileId);
  }

  createBoard(input: {
    title: string;
    description?: string;
    icon?: string;
    colorTheme?: ArenaAccentColor;
    boardKind?: TimelineBoardKind;
    boardMode?: TimelineBoardMode;
    privacy?: BoardPrivacy;
    defaultActorId?: string;
    seasonsFeedSlug?: string;
    memberProfileIds?: string[];
  }): TimelineBoard {
    const ownerProfileId = this.profileService.currentProfileId;
    const cleanTitle = input.title.trim() || 'Новый TimeLine';
    const slugBase =
      cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_-]+/gi, '-')
        .replace(/^-+|-+$/g, '') || `timeline-${Date.now()}`;
    const id = `board-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 5)}`;
    const mode: TimelineBoardMode = input.boardMode || 'DIARY';
    const privacy: BoardPrivacy = input.privacy || 'PRIVATE';

    const members: TimelineBoardMember[] = [
      {
        id: `m-${Date.now()}-owner`,
        boardId: id,
        profileId: ownerProfileId,
        role: 'OWNER',
        canPost: true,
        canCrossLink: true,
      },
      ...(input.memberProfileIds || [])
        .filter((pid) => pid && pid !== ownerProfileId)
        .map((pid, idx) => ({
          id: `m-${Date.now()}-${idx}`,
          boardId: id,
          profileId: pid,
          role: (pid === AGENT_DEFAULT_ID ? 'AGENT' : 'MEMBER') as BoardMemberRole,
          canPost: true,
          canCrossLink: true,
        })),
    ];

    const newBoard: TimelineBoard = {
      id,
      slug,
      title: cleanTitle,
      description: input.description?.trim() || '',
      icon: input.icon || (mode === 'DIARY' ? 'menu_book' : mode === 'AGENT_SUMMARY' ? 'smart_toy' : 'timeline'),
      colorTheme: input.colorTheme || (mode === 'DIARY' ? 'emerald' : mode === 'AGENT_SUMMARY' ? 'violet' : 'amber'),
      vibeId: mode === 'AGENT_SUMMARY' ? 'SYNTHWAVE' : mode === 'DIARY' ? 'NATURE_ZEN' : 'CHRONO_DAYFLOW',
      boardKind: input.boardKind || (mode === 'AGENT_SUMMARY' ? 'CODING_SESSIONS' : 'CUSTOM_PROJECT'),
      boardMode: mode,
      privacy,
      ownerProfileId,
      defaultActorId: input.defaultActorId || undefined,
      members,
      flowId: `flow-${id}`,
      flowType: FlowType.CONTEXT,
      flowStatus: FlowStatus.ACTIVE,
      seasonsStreamSlug: 'lemon-universe',
      seasonsFeedSlug: input.seasonsFeedSlug?.trim() || `universe-${slugBase}`,
      isDefault: false,
    };

    const next = [...this.boardsSubject.value, newBoard];
    this.boardsSubject.next(next);
    saveLocalBoards(next);
    this.activeBoardIdSubject.next(newBoard.id);

    this.api
      .createTimelineBoard(
        { ...newBoard, memberProfileIds: input.memberProfileIds },
        ownerProfileId,
      )
      .pipe(catchError(() => of(null)))
      .subscribe((saved) => {
        if (saved) {
          const updated = this.boardsSubject.value.map((b) => (b.id === newBoard.id ? saved : b));
          this.boardsSubject.next(updated);
          saveLocalBoards(updated);
        }
      });

    return newBoard;
  }

  updateBoard(
    boardId: string,
    patch: {
      title?: string;
      description?: string;
      boardMode?: TimelineBoardMode;
      privacy?: BoardPrivacy;
      defaultActorId?: string | null;
      isArchived?: boolean;
    },
  ): void {
    const profileId = this.profileService.currentProfileId;
    const next = this.boardsSubject.value.map((b) =>
      b.id === boardId ? { ...b, ...patch, defaultActorId: patch.defaultActorId ?? b.defaultActorId } : b,
    );
    this.boardsSubject.next(next);
    saveLocalBoards(next);

    this.api
      .updateTimelineBoard(boardId, patch, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((saved) => {
        if (saved) {
          const synced = this.boardsSubject.value.map((b) => (b.id === boardId ? saved : b));
          this.boardsSubject.next(synced);
          saveLocalBoards(synced);
        }
      });
  }

  upsertMember(
    boardId: string,
    dto: { profileId: string; role: BoardMemberRole; canPost: boolean; canCrossLink: boolean },
  ): void {
    const callerId = this.profileService.currentProfileId;
    const next = this.boardsSubject.value.map((b) => {
      if (b.id !== boardId) return b;
      const existing = b.members || [];
      const idx = existing.findIndex((m) => m.profileId === dto.profileId);
      const updatedMember: TimelineBoardMember = {
        id: idx >= 0 ? existing[idx].id : `m-${Date.now()}`,
        boardId,
        profileId: dto.profileId,
        role: dto.role,
        canPost: dto.role === 'VIEWER' ? false : dto.canPost,
        canCrossLink: dto.role === 'VIEWER' ? false : dto.canCrossLink,
      };
      const members =
        idx >= 0
          ? [...existing.slice(0, idx), { ...existing[idx], ...updatedMember }, ...existing.slice(idx + 1)]
          : [...existing, updatedMember];
      return { ...b, members };
    });
    this.boardsSubject.next(next);
    saveLocalBoards(next);

    this.api
      .upsertBoardMember(boardId, dto, callerId)
      .pipe(catchError(() => of(null)))
      .subscribe((members) => {
        if (members) {
          const synced = this.boardsSubject.value.map((b) =>
            b.id === boardId ? { ...b, members } : b,
          );
          this.boardsSubject.next(synced);
          saveLocalBoards(synced);
        }
      });
  }

  removeMember(boardId: string, targetProfileId: string): void {
    const callerId = this.profileService.currentProfileId;
    const next = this.boardsSubject.value.map((b) =>
      b.id === boardId
        ? { ...b, members: (b.members || []).filter((m) => m.profileId !== targetProfileId) }
        : b,
    );
    this.boardsSubject.next(next);
    saveLocalBoards(next);

    this.api
      .removeBoardMember(boardId, targetProfileId, callerId)
      .pipe(catchError(() => of(null)))
      .subscribe((members) => {
        if (members) {
          const synced = this.boardsSubject.value.map((b) =>
            b.id === boardId ? { ...b, members } : b,
          );
          this.boardsSubject.next(synced);
          saveLocalBoards(synced);
        }
      });
  }

  addNote(input: {
    board: TimelineBoard;
    actor: ArenaActorCard;
    dateKey: string;
    time: string;
    type: CloudItemType;
    title?: string;
    text: string;
    tags?: string[];
    mediaAttachments?: TimelineMediaAttachment[];
    replyToNote?: CloudDayNote | null;
    sharedWithGroup?: boolean;
  }): CloudDayNote | null {
    const profileId = this.profileService.currentProfileId;
    if (!canPostToBoard(input.board, profileId)) {
      this.setStatus('Нет прав на добавление записей в этот приватный TimeLine.');
      return null;
    }

    const [hh, mm] = (input.time || '12:00').split(':').map(Number);
    const timeMinutes = (hh || 0) * 60 + (mm || 0);
    const profileName = this.profileService.currentProfile?.displayName || 'Пользователь';

    const privacy = getBoardPrivacy(input.board);
    const newNote: CloudDayNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      boardId: input.board.id,
      dateKey: input.dateKey,
      time: input.time,
      timeMinutes,
      type: input.type,
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorAvatar: input.actor.avatarIcon,
      actorAccent: input.actor.accentColor,
      actorTitle: input.actor.title,
      authorProfileId: profileId,
      authorProfileName: profileName,
      title: input.title?.trim() || undefined,
      text: input.text.trim(),
      tags: input.tags || [],
      mediaAttachments: input.mediaAttachments || [],
      supporters: [input.actor.id],
      votesCount: 1,
      moodEmoji: input.type === 'thought' ? '💭' : input.type === 'proposal' ? '💡' : '⚡',
      createdAt: new Date().toISOString(),
      visibility: privacy,
      replyToNoteId: input.replyToNote?.id,
      replyToAuthorName: input.replyToNote?.actorName,
      replyToTextSnippet: input.replyToNote?.text.slice(0, 60),
      seasonsFeedSlug: input.board.seasonsFeedSlug,
      sharedWithGroup: Boolean(input.sharedWithGroup),
    };

    const next = [newNote, ...this.notesSubject.value];
    this.notesSubject.next(next);
    saveLocalNotes(next);

    // Записываем локально сразу без дублирующего remote ingest — backend `POST /timelines/notes` сам вызовет `SeasonsBridgeService`.
    this.seasonsBridge.recordTimelineNoteToFeed(newNote, input.board, { skipRemoteIngest: true });

    this.api
      .createTimelineNote(newNote, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((saved) => {
        if (saved) {
          const synced = this.notesSubject.value.map((n) =>
            n.id === newNote.id ? { ...n, ...saved } : n,
          );
          this.notesSubject.next(synced);
          saveLocalNotes(synced);
          this.seasonsBridge.markNoteSynced(
            newNote.id,
            Boolean(saved.seasonsSynced ?? saved.seasonsNoteId),
          );
        } else {
          // Offline fallback: если API недоступен, отправляем через seasons-bridge напрямую.
          this.seasonsBridge.recordTimelineNoteToFeed(newNote, input.board, {
            skipRemoteIngest: false,
          });
        }
      });

    return newNote;
  }

  updateNote(
    noteId: string,
    dto: {
      title?: string;
      text?: string;
      type?: CloudItemType;
      moodEmoji?: string;
      tags?: string[];
      mediaAttachments?: TimelineMediaAttachment[];
    },
  ): void {
    const profileId = this.profileService.currentProfileId;
    const optimistic = this.notesSubject.value.map((n) =>
      n.id === noteId
        ? {
            ...n,
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.text !== undefined ? { text: dto.text } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.moodEmoji !== undefined ? { moodEmoji: dto.moodEmoji } : {}),
            ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
            ...(dto.mediaAttachments !== undefined ? { mediaAttachments: dto.mediaAttachments } : {}),
          }
        : n,
    );
    this.notesSubject.next(optimistic);
    saveLocalNotes(optimistic);

    this.api
      .updateTimelineNote(noteId, dto, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((saved) => {
        if (saved) {
          const synced = this.notesSubject.value.map((n) =>
            n.id === noteId ? { ...n, ...saved } : n,
          );
          this.notesSubject.next(synced);
          saveLocalNotes(synced);
          const board = this.boardsSubject.value.find((b) => b.id === saved.boardId);
          if (board) {
            this.seasonsBridge.recordTimelineNoteToFeed(saved, board, {
              skipRemoteIngest: true,
              syncedToRemote: Boolean(saved.seasonsSynced ?? saved.seasonsNoteId),
            });
          }
        }
      });
  }

  retrySyncSeasons(noteId: string): void {
    const profileId = this.profileService.currentProfileId;
    this.api
      .syncNoteToSeasons(noteId, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) {
          this.setStatus('Не удалось связаться с backend для синхронизации Seasons.');
          return;
        }
        const updated = this.notesSubject.value.map((n) =>
          n.id === noteId
            ? {
                ...n,
                seasonsNoteId: res.seasonsNoteId || n.seasonsNoteId,
                seasonsExternalId: res.seasonsExternalId || n.seasonsExternalId,
                seasonsAccountId: res.seasonsAccountId || n.seasonsAccountId,
                seasonsSyncedAt: res.seasonsSyncedAt || n.seasonsSyncedAt,
                seasonsSynced: res.synced,
                seasonsSyncError: res.error,
              }
            : n,
        );
        this.notesSubject.next(updated);
        saveLocalNotes(updated);
        this.seasonsBridge.markNoteSynced(noteId, res.synced);
        if (res.synced) {
          this.setStatus('Запись успешно синхронизирована с Lemon Seasons.');
        } else if (res.error) {
          this.setStatus(`Seasons sync error: ${res.error}`);
        }
      });
  }

  shareNoteWithGroup(noteId: string, shared: boolean): void {
    const profileId = this.profileService.currentProfileId;
    const optimistic = this.notesSubject.value.map((n) =>
      n.id === noteId ? { ...n, sharedWithGroup: shared } : n,
    );
    this.notesSubject.next(optimistic);
    saveLocalNotes(optimistic);

    this.api
      .shareNoteWithBoardGroup(noteId, { shared }, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          const updated = this.notesSubject.value.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  sharedWithGroup: res.sharedWithGroup,
                  seasonsNoteId: res.seasonsNoteId || n.seasonsNoteId,
                }
              : n,
          );
          this.notesSubject.next(updated);
          saveLocalNotes(updated);
          this.setStatus(
            res.sharedWithGroup
              ? `NoteShare включён для участников группы (${res.sharedCount} расшарено).`
              : 'Доступ NoteShare для группы отозван.',
          );
        }
      });
  }

  deleteNote(noteId: string): void {
    const profileId = this.profileService.currentProfileId;
    const next = this.notesSubject.value.filter((n) => n.id !== noteId);
    this.notesSubject.next(next);
    saveLocalNotes(next);

    this.api
      .deleteTimelineNote(noteId, profileId)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  getCompatibleCrossLinkCandidates(sourceBoard: TimelineBoard): CloudDayNote[] {
    const profileId = this.profileService.currentProfileId;
    const srcPrivacy = getBoardPrivacy(sourceBoard);
    const compatibleBoards = new Set(
      this.boardsSubject.value
        .filter(
          (b) =>
            !b.isArchived &&
            b.id !== sourceBoard.id &&
            getBoardPrivacy(b) === srcPrivacy &&
            canViewBoard(b, profileId),
        )
        .map((b) => b.id),
    );

    return this.notesSubject.value
      .filter((n) => compatibleBoards.has(n.boardId || 'board-global-day'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  attachCrossLink(
    sourceBoard: TimelineBoard,
    sourceNote: CloudDayNote,
    targetBoard: TimelineBoard,
    targetNote: CloudDayNote,
    relationLabel?: string,
  ): { ok: boolean; reason?: string } {
    const profileId = this.profileService.currentProfileId;
    const check = validateCrossLinkAccess(sourceBoard, targetBoard, profileId);
    if (!check.allowed) {
      this.setStatus(check.reason || 'Кросс-ссылка запрещена правилами приватности.');
      return { ok: false, reason: check.reason };
    }

    const crossRef: TimelineNodeCrossRef = {
      id: `crosslink-${sourceNote.id}-${targetNote.id}`,
      targetBoardId: targetBoard.id,
      targetBoardTitle: targetBoard.title,
      targetBoardIcon: targetBoard.icon,
      targetNoteId: targetNote.id,
      targetDateKey: targetNote.dateKey,
      targetTime: targetNote.time,
      targetActorId: targetNote.actorId,
      targetActorName: targetNote.actorName,
      targetActorAvatar: targetNote.actorAvatar,
      targetTitle: targetNote.title,
      targetSnippet: targetNote.text.slice(0, 140),
      relationLabel: relationLabel || `Ссылка · ${targetBoard.title}`,
      sessionStatus: targetBoard.flowStatus === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
    };

    const next = this.notesSubject.value.map((n) => {
      if (n.id !== sourceNote.id) return n;
      const existing = n.crossRefs || [];
      return {
        ...n,
        crossRefs: [...existing.filter((r) => r.targetNoteId !== targetNote.id), crossRef],
      };
    });
    this.notesSubject.next(next);
    saveLocalNotes(next);

    this.api
      .createCrossLink(
        {
          sourceBoardId: sourceBoard.id,
          sourceNoteId: sourceNote.id,
          targetBoardId: targetBoard.id,
          targetNoteId: targetNote.id,
          relationLabel: crossRef.relationLabel,
          previewCache: crossRef,
        },
        profileId,
      )
      .pipe(catchError(() => of(null)))
      .subscribe();

    return { ok: true };
  }

  async uploadMediaFile(
    file: File,
    boardPrivacy: BoardPrivacy,
    caption?: string,
  ): Promise<TimelineMediaAttachment> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    return new Promise((resolve) => {
      this.api
        .uploadSeasonsMedia({
          filename: file.name,
          mimeType: file.type || 'image/png',
          dataBase64: dataUrl,
          caption: caption || file.name,
          boardPrivacy,
          authorProfileId: this.profileService.currentProfileId,
          folderPath: 'universe/timelines',
        })
        .pipe(
          catchError(() =>
            of({
              uploadedToHub: false,
              attachment: {
                url: dataUrl,
                thumbnailUrl: dataUrl,
                filename: file.name,
                mimeType: file.type || 'image/png',
                sizeBytes: file.size,
                caption: caption || file.name,
                isMain: true,
              },
            }),
          ),
        )
        .subscribe((res) => {
          resolve(res.attachment);
        });
    });
  }

  runAgentSummaryFlow(input: {
    agentProfileId: string;
    sourceBoard: TimelineBoard;
    targetBoard?: TimelineBoard | null;
    actor: ArenaActorCard;
    title: string;
    text: string;
    tags?: string[];
  }): { ok: boolean; reason?: string } {
    if (input.targetBoard) {
      const check = validateCrossLinkAccess(
        input.targetBoard,
        input.sourceBoard,
        input.agentProfileId,
      );
      if (!check.allowed) {
        return { ok: false, reason: check.reason };
      }
    }

    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const timeMinutes = now.getHours() * 60 + now.getMinutes();

    const summaryNote: CloudDayNote = {
      id: `note-agent-${Date.now()}`,
      boardId: input.sourceBoard.id,
      dateKey,
      time,
      timeMinutes,
      type: 'action',
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorAvatar: input.actor.avatarIcon,
      actorAccent: input.actor.accentColor,
      actorTitle: input.actor.title,
      authorProfileId: input.agentProfileId,
      authorProfileName: '🤖 Игрок-Агент (AI Guild)',
      title: input.title.trim() || 'Сводка Агента',
      text: input.text.trim(),
      tags: Array.from(new Set(['agent-summary', ...(input.tags || [])])),
      supporters: [input.actor.id],
      votesCount: 1,
      moodEmoji: '🤖',
      createdAt: now.toISOString(),
      visibility: getBoardPrivacy(input.sourceBoard),
      seasonsFeedSlug: input.sourceBoard.seasonsFeedSlug,
    };

    const nextNotes = [summaryNote, ...this.notesSubject.value];

    if (input.targetBoard) {
      const anchorNote: CloudDayNote = {
        ...summaryNote,
        id: `note-anchor-${Date.now()}`,
        boardId: input.targetBoard.id,
        visibility: getBoardPrivacy(input.targetBoard),
        seasonsFeedSlug: input.targetBoard.seasonsFeedSlug,
        moodEmoji: '🔗',
        text: input.text.trim().slice(0, 220),
        crossRefs: [
          {
            id: `crosslink-agent-${Date.now()}`,
            targetBoardId: input.sourceBoard.id,
            targetBoardTitle: input.sourceBoard.title,
            targetBoardIcon: input.sourceBoard.icon,
            targetNoteId: summaryNote.id,
            targetDateKey: dateKey,
            targetTime: time,
            targetActorId: summaryNote.actorId,
            targetActorName: summaryNote.actorName,
            targetActorAvatar: summaryNote.actorAvatar,
            targetTitle: summaryNote.title,
            targetSnippet: summaryNote.text.slice(0, 140),
            relationLabel: `Сводка агента · ${input.sourceBoard.title}`,
            sessionStatus: 'ACTIVE',
          },
        ],
      };
      nextNotes.unshift(anchorNote);
      this.seasonsBridge.recordTimelineNoteToFeed(anchorNote, input.targetBoard, {
        skipRemoteIngest: true,
      });
    }

    this.notesSubject.next(nextNotes);
    saveLocalNotes(nextNotes);
    this.seasonsBridge.recordTimelineNoteToFeed(summaryNote, input.sourceBoard, {
      skipRemoteIngest: true,
    });

    this.api
      .postAgentSummary({
        agentProfileId: input.agentProfileId,
        sourceBoardId: input.sourceBoard.id,
        targetBoardId: input.targetBoard?.id,
        actorId: input.actor.id,
        title: input.title,
        text: input.text,
        dateKey,
        time,
        tags: input.tags,
      })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          this.seasonsBridge.markNoteSynced(summaryNote.id, true);
        }
      });

    return { ok: true };
  }
}
