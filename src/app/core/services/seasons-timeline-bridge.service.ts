import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of } from 'rxjs';
import {
  CloudDayNote,
  CloudItemType,
  PlayerType,
  SeasonsPersonalFeedEntry,
  TimelineBoard,
} from '../models/flow.models';
import { ApiService } from './api.service';
import { ProfileService } from './profile.service';

const CLOUD_TYPE_TO_SEASON_TYPE: Record<CloudItemType, 'SINGLE' | 'EVENT' | 'DONE'> = {
  thought: 'SINGLE',
  proposal: 'EVENT',
  action: 'DONE',
};

/**
 * Мост интеграции с пакетом `lemon-seasons-neurons` (CharacterDialogueAxon, CodingMemoryAxon, FeedNeuron).
 * Транслирует узлы из TimeLine-досок Lemon Universe в личный фид Lemon Seasons (`feed-app`),
 * сохраняя структуру кросс-ссылок и происхождение события (`NEURON_PARTY` / `CODING_AGENT`).
 */
@Injectable({ providedIn: 'root' })
export class SeasonsTimelineBridgeService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);

  private readonly feedEntriesSubject = new BehaviorSubject<SeasonsPersonalFeedEntry[]>([]);
  private readonly remoteFeedNotesSubject = new BehaviorSubject<any[]>([]);
  private readonly remoteFeedAccountSubject = new BehaviorSubject<string | null>(null);
  private readonly lastSyncStatusSubject = new BehaviorSubject<'SYNCED' | 'LOCAL_QUEUE'>('SYNCED');
  private readonly streamInfoSubject = new BehaviorSubject<any | null>(null);
  private readonly isEnsuringStreamSubject = new BehaviorSubject<boolean>(false);

  readonly personalFeedEntries$: Observable<SeasonsPersonalFeedEntry[]> =
    this.feedEntriesSubject.asObservable();
  readonly remoteFeedNotes$: Observable<any[]> = this.remoteFeedNotesSubject.asObservable();
  readonly remoteFeedAccount$: Observable<string | null> = this.remoteFeedAccountSubject.asObservable();
  readonly syncStatus$: Observable<'SYNCED' | 'LOCAL_QUEUE'> =
    this.lastSyncStatusSubject.asObservable();
  readonly streamInfo$: Observable<any | null> = this.streamInfoSubject.asObservable();
  readonly isEnsuringStream$: Observable<boolean> = this.isEnsuringStreamSubject.asObservable();

  /**
   * Формирует совместимый с `lemon-seasons-neurons` payload (cloudDayNoteToIngestInput / CodingMemoryAxon)
   * и записывает его в локальный журнал UI. Удалённая отправка через `ingestSeasonsNote` выполняется только
   * если backend `/api/timelines/notes` не синхронизировал запись сам (skipRemoteIngest = false).
   */
  recordTimelineNoteToFeed(
    note: CloudDayNote,
    board: TimelineBoard,
    opts?: { skipRemoteIngest?: boolean; syncedToRemote?: boolean },
  ): SeasonsPersonalFeedEntry {
    const isCodingBoard = board.boardKind === 'CODING_SESSIONS';
    const origin: 'NEURON_PARTY' | 'CODING_AGENT' = isCodingBoard
      ? 'CODING_AGENT'
      : 'NEURON_PARTY';
    const feedSlug = board.seasonsFeedSlug || 'universe-personal-feed';
    const streamSlug = board.seasonsStreamSlug || 'lemon-universe';

    const resolvedProfileId = note.authorProfileId || this.profileService.currentProfileId;
    const resolvedProfileName = note.authorProfileName || '👤 Мой Дом (Игрок)';
    const resolvedPlayerType: PlayerType =
      resolvedProfileId === 'a7e49c10-9100-4b22-a811-9000a6e17001' ? 'AGENT' : 'HUMAN';

    const title =
      note.title?.trim() ||
      `${note.actorName}: ${note.text.replace(/\s+/g, ' ').trim().slice(0, 64)}`;

    const entry: SeasonsPersonalFeedEntry = {
      id: `seasons-feed-${note.id}`,
      externalId: isCodingBoard ? `coding-session:${note.id}` : `universe-timeline:${note.id}`,
      boardId: board.id,
      boardTitle: board.title,
      boardIcon: board.icon,
      feedSlug,
      streamSlug,
      origin,
      noteType: CLOUD_TYPE_TO_SEASON_TYPE[note.type] || 'SINGLE',
      title,
      summary: note.text.replace(/\s+/g, ' ').trim().slice(0, 180),
      content: note.text,
      actorId: note.actorId,
      actorName: note.actorName,
      actorAvatar: note.actorAvatar,
      authorProfileId: resolvedProfileId,
      authorProfileName: resolvedProfileName,
      playerType: resolvedPlayerType,
      dateKey: note.dateKey,
      time: note.time,
      createdAt: note.createdAt,
      tags: Array.from(
        new Set([
          ...(note.tags || []),
          'lemon-universe',
          `board:${board.slug}`,
          `actor:${note.actorId}`,
          `player:${resolvedProfileId}`,
          isCodingBoard ? 'coding-memory' : 'personal-summary',
        ]),
      ),
      crossRefs: note.crossRefs,
      syncedToRemote: Boolean(opts?.syncedToRemote),
    };

    const current = this.feedEntriesSubject.value;
    const nextList = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 120);
    this.feedEntriesSubject.next(nextList);

    if (opts?.syncedToRemote) {
      this.lastSyncStatusSubject.next('SYNCED');
    }

    if (!opts?.skipRemoteIngest) {
      const ingestPayload = this.buildIngestSeasonNoteInput(entry, note, board);
      this.api
        .ingestSeasonsNote(ingestPayload)
        .pipe(catchError(() => of({ synced: false, queuedInPersonalFeed: true })))
        .subscribe((res) => {
          const isRemoteSynced = Boolean(res?.synced);
          this.markNoteSynced(note.id, isRemoteSynced);
        });
    }

    return entry;
  }

  markNoteSynced(noteId: string, syncedToRemote: boolean): void {
    const entryId = `seasons-feed-${noteId}`;
    this.lastSyncStatusSubject.next(syncedToRemote ? 'SYNCED' : 'LOCAL_QUEUE');
    const updated = this.feedEntriesSubject.value.map((e) =>
      e.id === entryId ? { ...e, syncedToRemote } : e,
    );
    this.feedEntriesSubject.next(updated);
  }

  fetchRemoteFeedNotes(feedSlug?: string, profileId?: string): void {
    this.api
      .getSeasonsFeedNotes({
        feedSlug,
        profileId: profileId || this.profileService.currentProfileId,
        limit: 40,
      })
      .pipe(catchError(() => of({ synced: false, items: [], seasonsAccountId: undefined })))
      .subscribe((res) => {
        if (res.seasonsAccountId) {
          this.remoteFeedAccountSubject.next(res.seasonsAccountId);
        }
        if (Array.isArray(res.items)) {
          this.remoteFeedNotesSubject.next(res.items);
        }
      });
  }

  fetchStreamInfo(streamSlug = 'lemon-universe', profileId?: string): void {
    this.api
      .getSeasonsStream({
        streamSlug,
        profileId: profileId || this.profileService.currentProfileId,
      })
      .pipe(catchError(() => of({ connected: false, stream: undefined, error: 'Network error' })))
      .subscribe((res) => {
        if (res.connected && res.stream) {
          this.streamInfoSubject.next(res.stream);
        }
      });
  }

  ensureTimelinesStream(streamSlug = 'lemon-universe', profileId?: string): Observable<any> {
    this.isEnsuringStreamSubject.next(true);
    return new Observable((subscriber) => {
      this.api
        .ensureSeasonsStream({
          streamSlug,
          profileId: profileId || this.profileService.currentProfileId,
        })
        .pipe(
          catchError((err) =>
            of({
              success: false,
              stream: undefined,
              streamSlug,
              attachedFeedsCount: 0,
              feeds: [],
              error: err?.message || String(err),
            }),
          ),
        )
        .subscribe({
          next: (res) => {
            this.isEnsuringStreamSubject.next(false);
            if (res.success && res.stream) {
              this.streamInfoSubject.next(res.stream);
            }
            subscriber.next(res);
            subscriber.complete();
          },
          error: (err) => {
            this.isEnsuringStreamSubject.next(false);
            subscriber.error(err);
          },
        });
    });
  }

  private buildIngestSeasonNoteInput(
    entry: SeasonsPersonalFeedEntry,
    note: CloudDayNote,
    board?: TimelineBoard,
  ): Record<string, unknown> {
    const mediaAttachments = note.mediaAttachments || [];
    const mediaAssetIds = mediaAttachments
      .map((m) => m.mediaAssetId)
      .filter((id): id is string => Boolean(id));
    const binaryPrivacy =
      board?.privacy === 'PRIVATE' || note.visibility !== 'PUBLIC' ? 'private' : 'public';

    return {
      externalId: entry.externalId,
      title: entry.title,
      content: entry.content,
      summary: entry.summary,
      type: entry.noteType,
      privacy: binaryPrivacy,
      status: 'PUBLISHED',
      feedSlug: entry.feedSlug,
      personalSummaryFeedSlug: 'universe-personal-feed',
      streamSlug: entry.streamSlug,
      author: note.actorId,
      parentNoteId: note.replyToNoteId || undefined,
      startDate: `${note.dateKey}T${note.time.length === 5 ? `${note.time}:00` : note.time}Z`,
      icon: note.moodEmoji || '🍋',
      tags: entry.tags,
      origin: board?.boardMode === 'DIARY' ? 'TIMELINE_DIARY' : entry.origin,
      images: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      mediaAssetIds: mediaAssetIds.length > 0 ? mediaAssetIds : undefined,
      metadata: {
        lemonUniverseKind: 'CloudDayNote',
        boardId: entry.boardId,
        boardTitle: entry.boardTitle,
        boardMode: board?.boardMode || 'TIMELINE',
        boardPrivacy: board?.privacy || 'PUBLIC',
        partyNoteId: note.id,
        dateKey: note.dateKey,
        time: note.time,
        actorId: note.actorId,
        actorName: note.actorName,
        actorAvatar: note.actorAvatar,
        subActorId: note.subActorId ?? null,
        authorProfileId: entry.authorProfileId,
        authorProfileName: entry.authorProfileName,
        playerType: entry.playerType,
        crossRefs: note.crossRefs || [],
        activeFlowSessionIds: note.activeFlowSessionIds || [],
      },
    };
  }
}
