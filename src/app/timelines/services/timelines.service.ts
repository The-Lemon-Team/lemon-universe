import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  distinctUntilChanged,
  map,
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
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ProfileService } from '../../core/services/profile.service';
import { SeasonsTimelineBridgeService } from '../../core/services/seasons-timeline-bridge.service';
import {
  canManageBoardMembers,
  canPostToBoard,
  canViewBoard,
  getBoardPrivacy,
  validateCrossLinkAccess,
} from '../timelines.privacy';

const AGENT_DEFAULT_ID = 'a7e49c10-9100-4b22-a811-9000a6e17001';

@Injectable({ providedIn: 'root' })
export class TimelinesService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly arena = inject(NeuronArenaService);
  private readonly seasonsBridge = inject(SeasonsTimelineBridgeService);

  private readonly boardsSubject = new BehaviorSubject<TimelineBoard[]>([]);
  private readonly notesSubject = new BehaviorSubject<CloudDayNote[]>([]);
  private readonly activeBoardIdSubject = new BehaviorSubject<string>('board-global-day');
  private readonly statusMessageSubject = new BehaviorSubject<string | null>(null);
  private pendingBoardIdOrSlug: string | null = null;

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

  private formatApiError(err: unknown, fallback: string): string {
    const anyErr = err as { error?: { message?: string | string[] }; message?: string } | null;
    const msg = anyErr?.error?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('; ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (typeof anyErr?.message === 'string' && anyErr.message.trim()) return anyErr.message;
    return fallback;
  }

  refreshFromBackend(profileId = this.profileService.currentProfileId): void {
    this.api.getTimelineBoards(profileId).subscribe({
      next: (remoteBoards) => {
        const boards = Array.isArray(remoteBoards) ? remoteBoards : [];
        this.boardsSubject.next(boards);

        const visible = boards.filter((b) => !b.isArchived && canViewBoard(b, profileId));
        if (this.pendingBoardIdOrSlug) {
          const pending = visible.find(
            (b) => b.id === this.pendingBoardIdOrSlug || b.slug === this.pendingBoardIdOrSlug,
          );
          if (pending) {
            this.activeBoardIdSubject.next(pending.id);
            return;
          }
        }

        const active = this.activeBoardIdSubject.value;
        if (visible.length > 0 && !visible.some((b) => b.id === active)) {
          this.activeBoardIdSubject.next(visible[0].id);
        }
      },
      error: (err) => {
        this.setStatus(this.formatApiError(err, 'Не удалось загрузить доски TimeLines с сервера.'));
      },
    });

    this.api.getTimelineNotes({ profileId }).subscribe({
      next: (remoteNotes) => {
        this.notesSubject.next(Array.isArray(remoteNotes) ? remoteNotes : []);
      },
      error: (err) => {
        this.setStatus(this.formatApiError(err, 'Не удалось загрузить заметки TimeLines с сервера.'));
      },
    });
  }

  selectBoard(boardIdOrSlug: string): void {
    this.pendingBoardIdOrSlug = boardIdOrSlug;
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

    const prevBoards = this.boardsSubject.value;
    const prevActiveId = this.activeBoardIdSubject.value;
    const next = [...prevBoards, newBoard];
    this.boardsSubject.next(next);
    this.pendingBoardIdOrSlug = newBoard.id;
    this.activeBoardIdSubject.next(newBoard.id);

    this.api
      .createTimelineBoard(
        { ...newBoard, memberProfileIds: input.memberProfileIds },
        ownerProfileId,
      )
      .subscribe({
        next: (saved) => {
          const updated = this.boardsSubject.value.map((b) => (b.id === newBoard.id ? saved : b));
          this.boardsSubject.next(updated);
          if (this.activeBoardIdSubject.value === newBoard.id) {
            this.pendingBoardIdOrSlug = saved.id;
            this.activeBoardIdSubject.next(saved.id);
          }
        },
        error: (err) => {
          this.boardsSubject.next(this.boardsSubject.value.filter((b) => b.id !== newBoard.id));
          if (this.activeBoardIdSubject.value === newBoard.id) {
            this.activeBoardIdSubject.next(prevActiveId);
          }
          this.setStatus(this.formatApiError(err, 'Не удалось создать доску на сервере.'));
        },
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
    const prevBoards = this.boardsSubject.value;
    const next = prevBoards.map((b) =>
      b.id === boardId ? { ...b, ...patch, defaultActorId: patch.defaultActorId ?? b.defaultActorId } : b,
    );
    this.boardsSubject.next(next);

    this.api.updateTimelineBoard(boardId, patch, profileId).subscribe({
      next: (saved) => {
        const synced = this.boardsSubject.value.map((b) => (b.id === boardId ? saved : b));
        this.boardsSubject.next(synced);
      },
      error: (err) => {
        this.boardsSubject.next(prevBoards);
        this.setStatus(this.formatApiError(err, 'Не удалось обновить настройки доски на сервере.'));
      },
    });
  }

  upsertMember(
    boardId: string,
    dto: { profileId: string; role: BoardMemberRole; canPost: boolean; canCrossLink: boolean },
  ): void {
    const callerId = this.profileService.currentProfileId;
    const prevBoards = this.boardsSubject.value;
    const next = prevBoards.map((b) => {
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

    this.api.upsertBoardMember(boardId, dto, callerId).subscribe({
      next: (members) => {
        const synced = this.boardsSubject.value.map((b) =>
          b.id === boardId ? { ...b, members } : b,
        );
        this.boardsSubject.next(synced);
      },
      error: (err) => {
        this.boardsSubject.next(prevBoards);
        this.setStatus(this.formatApiError(err, 'Не удалось обновить участника доски на сервере.'));
      },
    });
  }

  removeMember(boardId: string, targetProfileId: string): void {
    const callerId = this.profileService.currentProfileId;
    const prevBoards = this.boardsSubject.value;
    const next = prevBoards.map((b) =>
      b.id === boardId
        ? { ...b, members: (b.members || []).filter((m) => m.profileId !== targetProfileId) }
        : b,
    );
    this.boardsSubject.next(next);

    this.api.removeBoardMember(boardId, targetProfileId, callerId).subscribe({
      next: (members) => {
        const synced = this.boardsSubject.value.map((b) =>
          b.id === boardId ? { ...b, members } : b,
        );
        this.boardsSubject.next(synced);
      },
      error: (err) => {
        this.boardsSubject.next(prevBoards);
        this.setStatus(this.formatApiError(err, 'Не удалось удалить участника доски на сервере.'));
      },
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

    const prevNotes = this.notesSubject.value;
    const next = [newNote, ...prevNotes];
    this.notesSubject.next(next);

    // Записываем в UI-ленту сразу без дублирующего remote ingest — backend `POST /timelines/notes` сам вызовет `SeasonsBridgeService`.
    this.seasonsBridge.recordTimelineNoteToFeed(newNote, input.board, { skipRemoteIngest: true });

    this.api.createTimelineNote(newNote, profileId).subscribe({
      next: (saved) => {
        const synced = this.notesSubject.value.map((n) =>
          n.id === newNote.id ? { ...n, ...saved } : n,
        );
        this.notesSubject.next(synced);
        this.seasonsBridge.markNoteSynced(
          newNote.id,
          Boolean(saved.seasonsSynced ?? saved.seasonsNoteId),
        );
      },
      error: (err) => {
        this.notesSubject.next(this.notesSubject.value.filter((n) => n.id !== newNote.id));
        this.setStatus(this.formatApiError(err, 'Не удалось сохранить запись на сервере.'));
      },
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
    const prevNotes = this.notesSubject.value;
    const optimistic = prevNotes.map((n) =>
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

    this.api.updateTimelineNote(noteId, dto, profileId).subscribe({
      next: (saved) => {
        const synced = this.notesSubject.value.map((n) =>
          n.id === noteId ? { ...n, ...saved } : n,
        );
        this.notesSubject.next(synced);
        const board = this.boardsSubject.value.find((b) => b.id === saved.boardId);
        if (board) {
          this.seasonsBridge.recordTimelineNoteToFeed(saved, board, {
            skipRemoteIngest: true,
            syncedToRemote: Boolean(saved.seasonsSynced ?? saved.seasonsNoteId),
          });
        }
      },
      error: (err) => {
        this.notesSubject.next(prevNotes);
        this.setStatus(this.formatApiError(err, 'Не удалось обновить запись на сервере.'));
      },
    });
  }

  retrySyncSeasons(noteId: string): void {
    const profileId = this.profileService.currentProfileId;
    this.api.syncNoteToSeasons(noteId, profileId).subscribe({
      next: (res) => {
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
        this.seasonsBridge.markNoteSynced(noteId, res.synced);
        if (res.synced) {
          this.setStatus('Запись успешно синхронизирована с Lemon Seasons.');
        } else if (res.error) {
          this.setStatus(`Seasons sync error: ${res.error}`);
        }
      },
      error: (err) => {
        this.setStatus(
          this.formatApiError(err, 'Не удалось связаться с backend для синхронизации Seasons.'),
        );
      },
    });
  }

  shareNoteWithGroup(noteId: string, shared: boolean): void {
    const profileId = this.profileService.currentProfileId;
    const prevNotes = this.notesSubject.value;
    const optimistic = prevNotes.map((n) =>
      n.id === noteId ? { ...n, sharedWithGroup: shared } : n,
    );
    this.notesSubject.next(optimistic);

    this.api.shareNoteWithBoardGroup(noteId, { shared }, profileId).subscribe({
      next: (res) => {
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
        this.setStatus(
          res.sharedWithGroup
            ? `NoteShare включён для участников группы (${res.sharedCount} расшарено).`
            : 'Доступ NoteShare для группы отозван.',
        );
      },
      error: (err) => {
        this.notesSubject.next(prevNotes);
        this.setStatus(this.formatApiError(err, 'Не удалось изменить доступ NoteShare на сервере.'));
      },
    });
  }

  deleteNote(noteId: string): void {
    const profileId = this.profileService.currentProfileId;
    const prevNotes = this.notesSubject.value;
    const next = prevNotes.filter((n) => n.id !== noteId);
    this.notesSubject.next(next);

    this.api.deleteTimelineNote(noteId, profileId).subscribe({
      error: (err) => {
        this.notesSubject.next(prevNotes);
        this.setStatus(this.formatApiError(err, 'Не удалось удалить запись на сервере.'));
      },
    });
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

    const prevNotes = this.notesSubject.value;
    const next = prevNotes.map((n) => {
      if (n.id !== sourceNote.id) return n;
      const existing = n.crossRefs || [];
      return {
        ...n,
        crossRefs: [...existing.filter((r) => r.targetNoteId !== targetNote.id), crossRef],
      };
    });
    this.notesSubject.next(next);

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
      .subscribe({
        error: (err) => {
          this.notesSubject.next(prevNotes);
          this.setStatus(this.formatApiError(err, 'Не удалось сохранить кросс-ссылку на сервере.'));
        },
      });

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

    return new Promise((resolve, reject) => {
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
        .subscribe({
          next: (res) => {
            resolve(res.attachment);
          },
          error: (err) => {
            const msg = this.formatApiError(err, 'Не удалось загрузить медиафайл на сервер.');
            this.setStatus(msg);
            reject(new Error(msg));
          },
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

    const prevNotes = this.notesSubject.value;
    const nextNotes = [summaryNote, ...prevNotes];

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
      .subscribe({
        next: () => {
          this.seasonsBridge.markNoteSynced(summaryNote.id, true);
        },
        error: (err) => {
          this.notesSubject.next(prevNotes);
          this.setStatus(this.formatApiError(err, 'Не удалось сохранить сводку агента на сервере.'));
        },
      });

    return { ok: true };
  }
}
