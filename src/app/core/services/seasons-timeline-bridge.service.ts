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
import { readWithLegacyMigration } from './neuron-arena.storage';
import { ProfileService } from './profile.service';

const PERSONAL_FEED_STORAGE_KEY = 'lemon-universe:seasons-personal-feed-v1';

const CLOUD_TYPE_TO_SEASON_TYPE: Record<CloudItemType, 'SINGLE' | 'EVENT' | 'DONE'> = {
  thought: 'SINGLE',
  proposal: 'EVENT',
  action: 'DONE',
};

const DEFAULT_SEED_FEED_ENTRIES: SeasonsPersonalFeedEntry[] = [
  {
    id: 'seasons-feed-seed-global-1',
    externalId: 'universe-timeline:note-global-coding-summary-1',
    boardId: 'board-global-day',
    boardTitle: '🌍 Глобальный Таймлайн Дня',
    boardIcon: 'public',
    feedSlug: 'universe-personal-feed',
    streamSlug: 'lemon-universe',
    origin: 'NEURON_PARTY',
    noteType: 'DONE',
    title: 'Провели кодинг-сессию по Lemon Universe',
    summary:
      'Мы провели мощную кодинг-сессию с Antigravity Agent и ТимЛидом Старлидером! Подняли PostgreSQL и настроили сводку в личный фид.',
    content:
      'Мы провели мощную кодинг-сессию с Antigravity Agent и ТимЛидом Старлидером! Переименовали проект в Lemon Universe, подняли свою БД PostgreSQL и настроили сводку в личный фид Lemon Seasons.',
    actorId: 'actor-lemon-coder',
    actorName: 'Программист (Lemon Team)',
    actorAvatar: 'lemon-coder',
    dateKey: '2026-11-06',
    time: '14:35',
    createdAt: '2026-11-06T14:35:00Z',
    tags: ['lemon-universe', 'coding-session', 'cross-timeline', 'personal-summary'],
    syncedToRemote: true,
    crossRefs: [
      {
        targetBoardId: 'board-coding-sessions',
        targetBoardTitle: '💻 TimeLine Board: Сессии Кодинга',
        targetBoardIcon: 'terminal',
        targetNoteId: 'note-coding-child-session-1',
        targetDateKey: '2026-11-06',
        targetTime: '14:30',
        targetActorId: 'actor-antigravity-agent',
        targetActorName: 'Antigravity Agent & Программист',
        targetActorAvatar: 'antigravity-agent',
        targetTitle: 'Кодинг-сессия #1: PostgreSQL + Core Combinator + Multi-TimeLines',
        targetSnippet:
          'Развернули базу lemon_universe_db в Docker с расширением ltree, подключили потоки Core Combinator (PROJECTION + MUTEX)...',
        relationLabel: 'Дочерний узел · Сессия Кодинга',
        sessionStatus: 'ACTIVE',
      },
    ],
  },
  {
    id: 'seasons-feed-seed-coding-1',
    externalId: 'coding-session:note-coding-child-session-1',
    boardId: 'board-coding-sessions',
    boardTitle: '💻 TimeLine Board: Сессии Кодинга',
    boardIcon: 'terminal',
    feedSlug: 'universe-coding-sessions',
    streamSlug: 'lemon-universe',
    origin: 'CODING_AGENT',
    noteType: 'DONE',
    title: 'Кодинг-сессия #1: PostgreSQL + Core Combinator + Multi-TimeLines',
    summary:
      'Развернули базу lemon_universe_db в Docker с расширением ltree, подключили потоки Core Combinator и мост lemon-seasons-neurons.',
    content:
      'Развернули базу lemon_universe_db в Docker с расширением ltree, подключили потоки Core Combinator (PROJECTION + MUTEX) и мост lemon-seasons-neurons для синхронизации сводки в личный фид feed-app!',
    actorId: 'actor-antigravity-agent',
    actorName: 'Antigravity Agent',
    actorAvatar: 'antigravity-agent',
    dateKey: '2026-11-06',
    time: '14:30',
    createdAt: '2026-11-06T14:30:00Z',
    tags: ['coding-memory', 'postgresql', 'core-combinator', 'antigravity-agent'],
    syncedToRemote: true,
  },
];

function loadInitialFeedEntries(): SeasonsPersonalFeedEntry[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = readWithLegacyMigration(PERSONAL_FEED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return DEFAULT_SEED_FEED_ENTRIES;
}

function saveFeedEntries(entries: SeasonsPersonalFeedEntry[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERSONAL_FEED_STORAGE_KEY, JSON.stringify(entries.slice(0, 120)));
    } catch {}
  }
}

/**
 * Мост интеграции с пакетом `lemon-seasons-neurons` (CharacterDialogueAxon, CodingMemoryAxon, FeedNeuron).
 * Транслирует узлы из TimeLine-досок Lemon Universe в личный фид Lemon Seasons (`feed-app`),
 * сохраняя структуру кросс-ссылок и происхождение события (`NEURON_PARTY` / `CODING_AGENT`).
 */
@Injectable({ providedIn: 'root' })
export class SeasonsTimelineBridgeService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);

  private readonly feedEntriesSubject = new BehaviorSubject<SeasonsPersonalFeedEntry[]>(
    loadInitialFeedEntries(),
  );
  private readonly lastSyncStatusSubject = new BehaviorSubject<'SYNCED' | 'LOCAL_QUEUE'>('SYNCED');

  readonly personalFeedEntries$: Observable<SeasonsPersonalFeedEntry[]> =
    this.feedEntriesSubject.asObservable();
  readonly syncStatus$: Observable<'SYNCED' | 'LOCAL_QUEUE'> =
    this.lastSyncStatusSubject.asObservable();

  /**
   * Формирует совместимый с `lemon-seasons-neurons` payload (cloudDayNoteToIngestInput / CodingMemoryAxon)
   * и отправляет сводку в личный feed Lemon Seasons для отображения в `feed-app`.
   */
  recordTimelineNoteToFeed(note: CloudDayNote, board: TimelineBoard): SeasonsPersonalFeedEntry {
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
      syncedToRemote: false,
    };

    const current = this.feedEntriesSubject.value;
    const nextList = [entry, ...current.filter((item) => item.id !== entry.id)];
    this.feedEntriesSubject.next(nextList);
    saveFeedEntries(nextList);

    const ingestPayload = this.buildIngestSeasonNoteInput(entry, note);
    this.api
      .ingestSeasonsNote(ingestPayload)
      .pipe(catchError(() => of({ synced: false, queuedInPersonalFeed: true })))
      .subscribe((res) => {
        const isRemoteSynced = Boolean(res?.synced);
        this.lastSyncStatusSubject.next(isRemoteSynced ? 'SYNCED' : 'LOCAL_QUEUE');
        if (isRemoteSynced) {
          const updated = this.feedEntriesSubject.value.map((e) =>
            e.id === entry.id ? { ...e, syncedToRemote: true } : e,
          );
          this.feedEntriesSubject.next(updated);
          saveFeedEntries(updated);
        }
      });

    return entry;
  }

  private buildIngestSeasonNoteInput(
    entry: SeasonsPersonalFeedEntry,
    note: CloudDayNote,
  ): Record<string, unknown> {
    return {
      externalId: entry.externalId,
      title: entry.title,
      content: entry.content,
      summary: entry.summary,
      type: entry.noteType,
      privacy: note.visibility === 'PUBLIC' ? 'public' : 'private',
      status: 'PUBLISHED',
      feedSlug: entry.feedSlug,
      personalSummaryFeedSlug: 'universe-personal-feed',
      streamSlug: entry.streamSlug,
      author: note.actorId,
      parentNoteId: note.replyToNoteId || undefined,
      startDate: `${note.dateKey}T${note.time.length === 5 ? `${note.time}:00` : note.time}Z`,
      icon: note.moodEmoji || '🍋',
      tags: entry.tags,
      origin: entry.origin,
      metadata: {
        lemonUniverseKind: 'CloudDayNote',
        boardId: entry.boardId,
        boardTitle: entry.boardTitle,
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
