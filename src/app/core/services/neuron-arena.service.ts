import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { mergeNoteTags } from '../utils/hashtag.utils';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaActorCategory,
  ArenaDeckAnalytics,
  ArenaDesireCard,
  ArenaDesireThread,
  ArenaParadoxField,
  ArenaPeriodSummary,
  ArenaVoiceEntry,
  ArenaVoiceIntent,
  ArenaVoiceSource,
  CombineActivitySuggestion,
  CombineHistoryCard,
  CombineIdeaOutcome,
  CombineTimeField,
  CloudDayNote,
  CloudItemType,
  FlowStatus,
  FlowType,
  NoteVisibility,
  Flow,
  NeuralTrainingSample,
  TimelineBoard,
  TimelineBoardKind,
  TimelineNodeCrossRef,
} from '../models/flow.models';
import { ApiService } from './api.service';
import {
  ArenaStateStore,
  buildTrainingSamples,
  computeCardDerivedStats,
  computeDeckAnalytics,
  createEmptyArenaStore,
  enrichActiveThreads,
} from './neuron-arena.helpers';
import {
  buildCombineHistoryCardFromStore,
  buildNewActorCard,
  createVoiceRecordInStore,
  replaceBoredSuggestionInStore,
  resolvePeriodInStore,
} from './neuron-arena.mutations';
import { buildArenaSelectors } from './neuron-arena.selectors';
import {
  buildCombineSuggestion,
  buildCombineTimeField,
  buildDesireCard,
  buildParadoxField,
  buildPersonaDraft,
  buildThreadFromCard,
} from './neuron-arena.builders';
import {
  buildArenaStatePayload,
  clearCachedArenaState,
  loadCachedArenaState,
  parseArenaFlows,
  readWithLegacyMigration,
  saveCachedArenaState,
} from './neuron-arena.storage';
import { cancelVoicePlayback, startVoicePlayback } from './neuron-arena.voice-player';
import { ProfileService } from './profile.service';
import { SeasonsTimelineBridgeService } from './seasons-timeline-bridge.service';
import { detectMentionedActors } from '../../components/neuron-arena/arena-ui.utils';

const STORAGE_NOTES_KEY = 'lemon-universe:cloud-notes-v8';
const LEGACY_SQUAD_NOTES_KEY = 'lemon-guild-squad:cloud-notes-v8';
const LEGACY_STORAGE_NOTES_KEY = 'lemon-party:cloud-notes-v8';
const STORAGE_BOARDS_KEY = 'lemon-universe:timeline-boards-v1';

const DEFAULT_TIMELINE_BOARDS: TimelineBoard[] = [
  {
    id: 'board-global-day',
    slug: 'global-day',
    title: '🌍 Глобальный Таймлайн Дня',
    description:
      'Главная лента дня всех персонажей Lemon Universe. Сводка автоматически транслируется в личный фид Lemon Seasons (feed-app).',
    icon: 'public',
    colorTheme: 'amber',
    vibeId: 'CHRONO_DAYFLOW',
    boardKind: 'GLOBAL_DAY',
    flowId: 'c0000001-0000-4000-8000-000000000001',
    flowType: FlowType.PROJECTION,
    flowStatus: FlowStatus.ACTIVE,
    activeSessionId: '55000001-0000-4000-8000-000000000001',
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-personal-feed',
    isDefault: true,
  },
  {
    id: 'board-coding-sessions',
    slug: 'coding-sessions',
    title: '💻 TimeLine Board: Сессии Кодинга',
    description:
      'Специализированный TimeLine для кодинг-сессий с участием Antigravity Agent, Программиста (Lemon Team) и ТимЛида Старлидера. Работает на потоке Core Combinator MUTEX и CodingMemoryAxon.',
    icon: 'terminal',
    colorTheme: 'violet',
    vibeId: 'SYNTHWAVE',
    boardKind: 'CODING_SESSIONS',
    flowId: 'c0000001-0000-4000-8000-000000000002',
    flowType: FlowType.MUTEX,
    flowStatus: FlowStatus.ACTIVE,
    activeSessionId: '55000001-0000-4000-8000-000000000002',
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-coding-sessions',
    isDefault: false,
  },
];

function loadStoredBoards(): TimelineBoard[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = readWithLegacyMigration(STORAGE_BOARDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TimelineBoard[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((b) => b.id));
          const missing = DEFAULT_TIMELINE_BOARDS.filter((d) => !existingIds.has(d.id));
          return [...parsed, ...missing];
        }
      }
    } catch {}
  }
  return DEFAULT_TIMELINE_BOARDS;
}

function saveStoredBoards(boards: TimelineBoard[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_BOARDS_KEY, JSON.stringify(boards));
    } catch {}
  }
}

function loadStoredNotes(): Record<string, CloudDayNote[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = readWithLegacyMigration(
        STORAGE_NOTES_KEY,
        LEGACY_SQUAD_NOTES_KEY,
        LEGACY_STORAGE_NOTES_KEY,
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
  }
  return {};
}

function saveStoredNotes(store: Record<string, CloudDayNote[]>): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(store));
    } catch {}
  }
}

@Injectable({ providedIn: 'root' })
export class NeuronArenaService {
  private readonly api = inject(ApiService);
  private readonly profileService = inject(ProfileService);
  private readonly seasonsBridge = inject(SeasonsTimelineBridgeService);
  private readonly http = inject(HttpClient);

  private loadPrivateNotesIfPresent(): void {
    if (typeof window === 'undefined') return;
    this.http
      .get<Record<string, CloudDayNote[]>>('/hero-notes.private.json')
      .pipe(catchError(() => of(null)))
      .subscribe((privateNotes) => {
        if (privateNotes && typeof privateNotes === 'object') {
          const current = this.notesSubject.value;
          const merged: Record<string, CloudDayNote[]> = { ...current };
          for (const [date, notes] of Object.entries(privateNotes)) {
            const existing = merged[date] || [];
            const map = new Map(notes.map((n) => [n.id, n]));
            const updated = existing.map((n) => map.get(n.id) ?? n);
            const existingIds = new Set(existing.map((n) => n.id));
            const missing = notes.filter((n) => !existingIds.has(n.id));
            merged[date] = [...updated, ...missing];
          }
          this.notesSubject.next(merged);
          saveStoredNotes(merged);
        }
      });
  }

  private stateFlowId: string | null = null;
  private loadedProfileId: string = this.profileService.currentProfileId;
  private readonly stateSubject = new BehaviorSubject<ArenaStateStore>(loadCachedArenaState(this.loadedProfileId));
  private readonly speakingVoiceIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedDesireCardIdSubject = new BehaviorSubject<string>('card-drink-beer');

  private _notesSubject: BehaviorSubject<Record<string, CloudDayNote[]>> | null = null;
  private get notesSubject(): BehaviorSubject<Record<string, CloudDayNote[]>> {
    if (!this._notesSubject) {
      this._notesSubject = new BehaviorSubject<Record<string, CloudDayNote[]>>(loadStoredNotes());
    }
    return this._notesSubject;
  }

  readonly notesMap$: Observable<Record<string, CloudDayNote[]>> = defer(() =>
    this.notesSubject.asObservable(),
  );

  readonly allNotes$: Observable<CloudDayNote[]> = this.notesMap$.pipe(
    map((m) => Object.values(m).flat()),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly boardsSubject = new BehaviorSubject<TimelineBoard[]>(loadStoredBoards());
  private readonly activeBoardIdSubject = new BehaviorSubject<string>('board-global-day');

  readonly timelineBoards$: Observable<TimelineBoard[]> = this.boardsSubject.asObservable();
  readonly activeBoardId$: Observable<string> = this.activeBoardIdSubject.asObservable();
  readonly activeBoard$: Observable<TimelineBoard> = combineLatest([
    this.timelineBoards$,
    this.activeBoardId$,
  ]).pipe(
    map(([boards, id]) => boards.find((b) => b.id === id) ?? boards[0]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly speakingVoiceId$: Observable<string | null> = this.speakingVoiceIdSubject.asObservable();
  readonly selectedDesireCardId$: Observable<string> = this.selectedDesireCardIdSubject.asObservable();

  private readonly selectors = buildArenaSelectors(this.stateSubject, this.selectedDesireCardId$);

  readonly combineTimeFields$ = this.selectors.combineTimeFields$;
  readonly activeCombineField$ = this.selectors.activeCombineField$;
  readonly activeCombineSuggestions$ = this.selectors.activeCombineSuggestions$;
  readonly pinnedCombineActivities$ = this.selectors.pinnedCombineActivities$;
  readonly proposedCombineActivities$ = this.selectors.proposedCombineActivities$;
  readonly replacedCombineActivities$ = this.selectors.replacedCombineActivities$;
  readonly combineHistoryCards$ = this.selectors.combineHistoryCards$;
  readonly actors$ = this.selectors.actors$;
  readonly leadActor$ = this.selectors.leadActor$;
  readonly paradoxes$ = this.selectors.paradoxes$;
  readonly activeParadox$ = this.selectors.activeParadox$;
  readonly desireCards$ = this.selectors.desireCards$;
  readonly inspectedDesireCard$ = this.selectors.inspectedDesireCard$;
  readonly deckAnalytics$ = this.selectors.deckAnalytics$;
  readonly activeThreads$ = this.selectors.activeThreads$;
  readonly activeVoices$ = this.selectors.activeVoices$;
  readonly trainingSamples$ = this.selectors.trainingSamples$;
  readonly arenaMetrics$ = this.selectors.arenaMetrics$;

  readonly showNewDesireCardModal = signal(false);
  readonly showNewActorModal = signal(false);
  readonly showNewParadoxModal = signal(false);

  openNewDesireCardModal(): void {
    this.showNewDesireCardModal.set(true);
  }

  closeNewDesireCardModal(): void {
    this.showNewDesireCardModal.set(false);
  }

  openNewActorModal(): void {
    this.showNewActorModal.set(true);
  }

  closeNewActorModal(): void {
    this.showNewActorModal.set(false);
  }

  openNewParadoxModal(): void {
    this.showNewParadoxModal.set(true);
  }

  closeNewParadoxModal(): void {
    this.showNewParadoxModal.set(false);
  }

  previewActorVoice(actor: ArenaActorCard, text?: string): void {
    const sampleText = text || actor.quote || actor.sampleVoices?.support || actor.sampleVoices?.paradox || '';
    const mockVoice: ArenaVoiceEntry = {
      id: `preview-${actor.id}-${Date.now()}`,
      actorId: actor.id,
      actorName: actor.name,
      actorTitle: actor.title,
      actorIcon: actor.avatarIcon,
      actorAccent: actor.accentColor,
      paradoxId: 'preview-paradox',
      threadId: 'preview-thread',
      intent: 'PARADOX_OPINION',
      sourceMode: 'AUDIO_VOICE',
      durationSec: 3,
      text: sampleText,
      activeNeuronSessions: [],
      createdAt: new Date().toISOString(),
    };
    this.playVoiceAudio(mockVoice);
  }

  constructor() {
    this.loadPrivateNotesIfPresent();
    this.hydrateTimelinesFromBackend();
    this.profileService.activeProfileId$
      .pipe(distinctUntilChanged())
      .subscribe((profileId) => {
        if (profileId !== this.loadedProfileId) {
          this.loadedProfileId = profileId;
          this.stateSubject.next(loadCachedArenaState(profileId));
        }
        this.hydrateFromBackend(profileId, false);
      });
  }

  selectLeadActor(actorId: string): void {
    const state = this.stateSubject.value;
    if (!state.actors.some((a) => a.id === actorId)) return;
    this.commitState({ ...state, leadActorId: actorId });
  }

  getActor(actorId: string): ArenaActorCard | undefined {
    return this.stateSubject.value.actors.find((a) => a.id === actorId);
  }

  getActors(): ArenaActorCard[] {
    return this.stateSubject.value.actors;
  }

  inspectDesireCard(cardId: string): void {
    this.selectedDesireCardIdSubject.next(cardId);
  }

  selectParadoxField(paradoxId: string): void {
    const state = this.stateSubject.value;
    if (!state.paradoxes.some((p) => p.id === paradoxId)) return;
    this.commitState({ ...state, activeParadoxId: paradoxId });
  }

  playDesireCardToField(
    desireCardId: string,
    customVoiceText?: string,
    sourceMode: ArenaVoiceSource = 'MANUAL_PUPPET',
    audioDataUrl?: string,
  ): void {
    const state = this.stateSubject.value;
    const card = state.desireCards.find((c) => c.id === desireCardId);
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!card || !actor || !paradox) return;

    this.selectedDesireCardIdSubject.next(card.id);

    const existingThread = state.threads.find(
      (t) =>
        t.paradoxId === paradox.id &&
        (t.desireCardId === card.id || t.title.toLowerCase() === card.title.toLowerCase()),
    );
    if (existingThread) {
      this.supportThread(existingThread.id, customVoiceText, sourceMode, audioDataUrl);
      return;
    }

    const voiceText =
      customVoiceText?.trim() ||
      `Достаю из колоды карточку желания «${card.title}» (${card.gamesPlayed} игр в истории, ${card.winsCount} побед) и вбрасываю её в Versus Mode! ${actor.sampleVoices.counter}`;

    const newThread = buildThreadFromCard(card, actor, paradox.id);

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      newThread.id,
      card.title,
      'COUNTER_PROPOSE',
      sourceMode,
      voiceText,
      card.id,
      audioDataUrl,
    );

    const updatedParadoxes = state.paradoxes.map((p) =>
      p.id === paradox.id ? { ...p, status: 'ACTIVE_BATTLE' as const } : p,
    );

    this.commitState({
      ...state,
      paradoxes: updatedParadoxes,
      threads: [...state.threads, newThread],
      voices: [newVoice, ...state.voices],
    });
  }

  createDesireCard(input: {
    title: string;
    category: string;
    description: string;
    icon: string;
    colorTheme: ArenaAccentColor;
    tagsRaw?: string;
    playImmediately?: boolean;
    initialVoiceText?: string;
    audioDataUrl?: string;
  }): ArenaDesireCard | null {
    if (!input.title.trim()) return null;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const newCard = buildDesireCard(input, actor);

    this.commitState({ ...state, desireCards: [newCard, ...state.desireCards] });
    this.selectedDesireCardIdSubject.next(newCard.id);
    if (input.playImmediately !== false) {
      this.playDesireCardToField(newCard.id, input.initialVoiceText, 'MANUAL_PUPPET', input.audioDataUrl);
    }
    return newCard;
  }

  voteForDesireCard(cardId: string, actorId?: string): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === (actorId || state.leadActorId)) ?? state.actors[0];
    const updatedCards = state.desireCards.map((c) => {
      if (c.id === cardId) {
        return {
          ...c,
          totalHistoricalVotes: c.totalHistoricalVotes + 1,
          winsCount: c.winsCount + 1,
        };
      }
      return c;
    });
    this.commitState({ ...state, desireCards: updatedCards });
  }

  supportThread(
    threadId: string,
    voiceText?: string,
    sourceMode: ArenaVoiceSource = 'MANUAL_PUPPET',
    audioDataUrl?: string,
  ): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const thread = state.threads.find((t) => t.id === threadId);
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!actor || !thread || !paradox) return;

    if (thread.desireCardId) {
      this.selectedDesireCardIdSubject.next(thread.desireCardId);
    }

    const alreadySupported = thread.supporterActorIds.includes(actor.id);
    const updatedThreads = state.threads.map((t) =>
      t.id !== threadId
        ? t
        : {
            ...t,
            supporterActorIds: alreadySupported
              ? t.supporterActorIds
              : [...t.supporterActorIds, actor.id],
          },
    );

    const cleanVoice =
      (voiceText ?? '').trim() ||
      (alreadySupported
        ? `Ещё раз усиливаю голосом карточку «${thread.title}»! ${actor.sampleVoices.support}`
        : `Зашёл в поле, увидел карточку «${thread.title}» и подтверждаю её! ${actor.sampleVoices.support}`);

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      thread.id,
      thread.title,
      'SUPPORT',
      sourceMode,
      cleanVoice,
      thread.desireCardId ?? thread.id,
      audioDataUrl,
    );

    this.commitState({
      ...state,
      threads: updatedThreads,
      voices: [newVoice, ...state.voices],
    });
  }

  proposeVersusThread(input: {
    title: string;
    subtitle?: string;
    icon?: string;
    colorTheme?: ArenaAccentColor;
    initialVoiceText?: string;
    sourceMode?: ArenaVoiceSource;
    audioDataUrl?: string;
  }): void {
    const title = input.title.trim();
    if (!title) return;

    const existingCard = this.stateSubject.value.desireCards.find(
      (c) => c.title.toLowerCase() === title.toLowerCase(),
    );
    if (existingCard) {
      this.playDesireCardToField(
        existingCard.id,
        input.initialVoiceText,
        input.sourceMode ?? 'MANUAL_PUPPET',
        input.audioDataUrl,
      );
      return;
    }

    this.createDesireCard({
      title,
      category: 'Versus-Импульс',
      description: input.subtitle?.trim() || `Альтернативная карточка желания «${title}»`,
      icon: input.icon || 'bolt',
      colorTheme: input.colorTheme || 'amber',
      playImmediately: true,
      initialVoiceText: input.initialVoiceText,
      audioDataUrl: input.audioDataUrl,
    });
  }

  postActorVoice(input: {
    text: string;
    intent: ArenaVoiceIntent;
    threadId?: string | null;
    sourceMode?: ArenaVoiceSource;
    audioDataUrl?: string;
  }): void {
    const cleanText = input.text.trim();
    if (!cleanText) return;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const paradox = state.paradoxes.find((p) => p.id === state.activeParadoxId);
    if (!actor || !paradox) return;

    const targetThread = input.threadId
      ? state.threads.find((t) => t.id === input.threadId)
      : undefined;

    const updatedThreads =
      input.intent === 'SUPPORT' && targetThread
        ? state.threads.map((t) =>
            t.id !== targetThread.id || t.supporterActorIds.includes(actor.id)
              ? t
              : { ...t, supporterActorIds: [...t.supporterActorIds, actor.id] },
          )
        : state.threads;

    const newVoice = createVoiceRecordInStore(
      state,
      actor,
      paradox.id,
      targetThread?.id ?? null,
      targetThread?.title ?? null,
      input.intent,
      input.sourceMode ?? 'MANUAL_PUPPET',
      cleanText,
      targetThread?.desireCardId ?? targetThread?.id ?? null,
      input.audioDataUrl,
    );

    this.commitState({
      ...state,
      threads: updatedThreads,
      voices: [newVoice, ...state.voices],
    });
  }

  generatePersonaDraft(intent: ArenaVoiceIntent, targetThreadId?: string | null): string {
    return buildPersonaDraft(this.stateSubject.value, intent, targetThreadId);
  }

  resolvePeriodWithSummary(): ArenaPeriodSummary | null {
    const res = resolvePeriodInStore(this.stateSubject.value);
    if (!res) return null;
    this.commitState(res.nextState);
    return res.summary;
  }

  reopenPeriod(): void {
    const state = this.stateSubject.value;
    this.commitState({
      ...state,
      paradoxes: state.paradoxes.map((p) =>
        p.id === state.activeParadoxId
          ? { ...p, status: 'ACTIVE_BATTLE' as const, periodLabel: 'Период открыт · Versus Mode активен' }
          : p,
      ),
    });
  }

  createActorCard(input: {
    name: string;
    title: string;
    category: ArenaActorCategory;
    avatarIcon: string;
    accentColor: ArenaAccentColor;
    quote: string;
    paradoxPhilosophy: string;
    favoriteDesire: string;
    affinitiesRaw?: string;
  }): ArenaActorCard {
    const newActor = buildNewActorCard(input);
    const state = this.stateSubject.value;
    this.commitState({
      ...state,
      actors: [newActor, ...state.actors],
      leadActorId: newActor.id,
    });
    return newActor;
  }

  createParadoxField(input: {
    title: string;
    occasionTag: string;
    contextStory: string;
    paradoxQuestion: string;
    starterDesireCardId?: string;
    initialThreadTitle?: string;
    initialThreadIcon?: string;
  }): void {
    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const newParadox = buildParadoxField(input);
    const starterCard = input.starterDesireCardId
      ? state.desireCards.find((c) => c.id === input.starterDesireCardId)
      : state.desireCards[0];

    this.commitState({
      ...state,
      paradoxes: [newParadox, ...state.paradoxes],
      activeParadoxId: newParadox.id,
      threads:
        starterCard && actor
          ? [...state.threads, buildThreadFromCard(starterCard, actor, newParadox.id, 100, true)]
          : state.threads,
    });
  }

  selectCombineTimeField(fieldId: string): void {
    const state = this.stateSubject.value;
    if (!state.combineTimeFields.some((f) => f.id === fieldId)) return;
    this.commitState({ ...state, activeCombineFieldId: fieldId });
  }

  togglePinCombineSuggestion(suggestionId: string): void {
    const state = this.stateSubject.value;
    const nowIso = new Date().toISOString();
    const updated = state.combineSuggestions.map((s) => {
      if (s.id !== suggestionId) return s;
      const nextPinned = !s.isPinned;
      return {
        ...s,
        isPinned: nextPinned,
        pinnedAt: nextPinned ? nowIso : null,
        outcome: nextPinned && s.outcome === 'BORED_REPLACED' ? ('PENDING' as const) : s.outcome,
      };
    });
    this.commitState({ ...state, combineSuggestions: updated });
  }

  replaceBoredSuggestionWithNewCard(
    boredSuggestionId: string,
    replacementTitle = 'Слушать подкаст',
    replacementReason = 'Наскучило в процессе — решили заняться чем-то поважнее и глубже',
  ): void {
    const state = this.stateSubject.value;
    const updatedSuggestions = replaceBoredSuggestionInStore(
      state,
      boredSuggestionId,
      replacementTitle,
      replacementReason,
    );
    if (!updatedSuggestions) return;
    this.commitState({ ...state, combineSuggestions: updatedSuggestions });
  }

  rateCombineSuggestion(suggestionId: string, outcome: CombineIdeaOutcome, note?: string): void {
    const state = this.stateSubject.value;
    const updated = state.combineSuggestions.map((s) =>
      s.id !== suggestionId
        ? s
        : {
            ...s,
            outcome,
            outcomeNote:
              note ??
              (outcome === 'HIT'
                ? 'Идея оказалась супер-удачной в этом поле времени!'
                : outcome === 'BORED_REPLACED'
                  ? 'Быстро наскучило в процессе.'
                  : 'Неплохое дополнение.'),
          },
    );
    this.commitState({ ...state, combineSuggestions: updated });
  }

  proposeNewCombineSuggestion(input: {
    title: string;
    subtitle?: string;
    icon?: string;
    pitchVoice?: string;
    pinImmediately?: boolean;
  }): void {
    if (!input.title.trim()) return;

    const state = this.stateSubject.value;
    const actor = state.actors.find((a) => a.id === state.leadActorId) ?? state.actors[0];
    const field =
      state.combineTimeFields.find((f) => f.id === state.activeCombineFieldId) ??
      state.combineTimeFields[0];
    if (!actor || !field) return;

    this.commitState({
      ...state,
      combineSuggestions: [buildCombineSuggestion(input, actor, field), ...state.combineSuggestions],
    });
  }

  saveActiveCombineFieldToHistory(): CombineHistoryCard | null {
    const state = this.stateSubject.value;
    const historyCard = buildCombineHistoryCardFromStore(state);
    if (!historyCard) return null;

    this.commitState({
      ...state,
      combineTimeFields: state.combineTimeFields.map((f) =>
        f.id === historyCard.timeFieldId ? { ...f, status: 'SAVED_TO_HISTORY' as const } : f,
      ),
      combineHistoryCards: [historyCard, ...(state.combineHistoryCards ?? [])],
    });
    return historyCard;
  }

  createCombineTimeField(input: {
    title: string;
    baseActivity: string;
    baseIcon: string;
    durationLabel: string;
    contextDescription?: string;
  }): void {
    if (!input.baseActivity.trim()) return;
    const state = this.stateSubject.value;
    const newField = buildCombineTimeField(input);
    this.commitState({
      ...state,
      combineTimeFields: [newField, ...state.combineTimeFields],
      activeCombineFieldId: newField.id,
    });
  }

  playVoiceAudio(voice: ArenaVoiceEntry): void {
    if (this.speakingVoiceIdSubject.value === voice.id) {
      this.stopVoiceAudio();
      return;
    }
    this.stopVoiceAudio();
    this.speakingVoiceIdSubject.next(voice.id);

    const actor = this.stateSubject.value.actors.find((a) => a.id === voice.actorId);
    startVoicePlayback(voice, actor, () => {
      if (this.speakingVoiceIdSubject.value === voice.id) this.speakingVoiceIdSubject.next(null);
    });
  }

  stopVoiceAudio(): void {
    cancelVoicePlayback();
    this.speakingVoiceIdSubject.next(null);
  }

  /* ================== HYBRID HERO NOTES & CLOUD PINNING SYSTEM ================== */

  /** Текущий статус модерации: Хост-Администратор / GM (Мастер Арены) */
  readonly isAdminMode = signal<boolean>(true);
  private readonly heroNotesCache = new Map<string, Observable<CloudDayNote[]>>();

  getHeroNotes(actorId: string): Observable<CloudDayNote[]> {
    const cached = this.heroNotesCache.get(actorId);
    if (cached) {
      return cached;
    }
    const stream$ = combineLatest([this.allNotes$, this.profileService.activeProfileId$]).pipe(
      map(([notes, activeProfileId]) => {
        const isAdmin = this.isAdminMode();
        return notes
          .filter(
            (n) =>
              (n.actorId === actorId ||
                n.subActorId === actorId ||
                (n.partyActorIds?.includes(actorId) ?? false)) &&
              (n.visibility === 'PUBLIC' ||
                !n.visibility ||
                n.authorProfileId === activeProfileId ||
                (n.visibility === 'GM_ONLY' && isAdmin)),
          )
          .sort((a, b) => {
            if (Boolean(a.isPinnedToHero) !== Boolean(b.isPinnedToHero)) {
              return a.isPinnedToHero ? -1 : 1;
            }
            return b.createdAt.localeCompare(a.createdAt);
          });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.heroNotesCache.set(actorId, stream$);
    return stream$;
  }

  getPinnedHeroNotes(actorId: string): Observable<CloudDayNote[]> {
    return this.getHeroNotes(actorId).pipe(
      map((notes) => notes.filter((n) => Boolean(n.isPinnedToHero))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  addHeroNote(input: {
    actorId: string;
    text: string;
    title?: string;
    type?: CloudItemType;
    visibility?: NoteVisibility;
    isPinnedToHero?: boolean;
    isPinnedToCloud?: boolean;
    tags?: string[];
    partyActorIds?: string[];
    subActorId?: string;
    replyToNoteId?: string;
    replyToAuthorName?: string;
    replyToTextSnippet?: string;
  }): CloudDayNote {
    const allActors = this.stateSubject.value.actors;
    const actor = allActors.find((a) => a.id === input.actorId);
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const nowTime = nowIso.substring(11, 16);
    const [h, m] = nowTime.split(':').map(Number);
    const timeMinutes = (h || 0) * 60 + (m || 0);

    const currentProfile = this.profileService.currentProfileId;
    const authorName = 'Вы (' + currentProfile.substring(0, 5) + ')';

    // Auto-detect party actors mentioned in text and merge with explicitly selected party actors
    const detected = detectMentionedActors(input.text, allActors, input.actorId);
    
    // Resolve sub-character (either explicitly specified or first detected from text)
    const explicitSubActor = input.subActorId ? allActors.find((a) => a.id === input.subActorId) : undefined;
    const subActor = explicitSubActor || (detected.length > 0 ? detected[0] : undefined);

    const initialPartyIds = [...(input.partyActorIds || []), ...detected.map((a) => a.id)];
    if (subActor && !initialPartyIds.includes(subActor.id)) {
      initialPartyIds.push(subActor.id);
    }
    const combinedPartyIds = Array.from(new Set(initialPartyIds));

    const partyActors = allActors.filter((a) => combinedPartyIds.includes(a.id));
    const partyActorNames = partyActors.map((a) => a.name);

    // Random slight tilt and delay for organic floating animation
    const tilts = [-1.4, -0.9, 0, 0.8, 1.2, 1.5];
    const randomTilt = tilts[Math.floor(Math.random() * tilts.length)];
    const randomDelay = Math.round(Math.random() * 20) / 10; // 0..2.0s

    const initialSupporters = [input.actorId];
    if (subActor && !initialSupporters.includes(subActor.id)) {
      initialSupporters.push(subActor.id);
    }

    const newNote: CloudDayNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dateKey: today,
      time: nowTime,
      timeMinutes,
      type: input.type || 'thought',
      actorId: input.actorId,
      actorName: actor?.name || 'Герой',
      actorAvatar: actor?.avatarIcon || 'person',
      actorAccent: actor?.accentColor || 'amber',
      actorTitle: actor?.title || '',
      subActorId: subActor?.id,
      subActorName: subActor?.name,
      subActorAvatar: subActor?.avatarIcon,
      subActorAccent: subActor?.accentColor,
      replyToNoteId: input.replyToNoteId,
      replyToAuthorName: input.replyToAuthorName,
      replyToTextSnippet: input.replyToTextSnippet,
      title: input.title?.trim() || undefined,
      text: input.text.trim(),
      tags: input.tags || [],
      supporters: initialSupporters,
      votesCount: initialSupporters.length,
      createdAt: nowIso,
      authorProfileId: currentProfile,
      authorProfileName: authorName,
      visibility: input.visibility || 'PUBLIC',
      isPinnedToHero: Boolean(input.isPinnedToHero),
      isPinnedToCloud: Boolean(input.isPinnedToCloud),
      partyActorIds: combinedPartyIds,
      partyActorNames,
      likedByActors: partyActors.map((pa) => ({
        actorId: pa.id,
        actorName: pa.name,
        avatarIcon: pa.avatarIcon,
        moodEmoji: '🤝',
      })),
      floatingTilt: randomTilt,
      floatingDelay: randomDelay,
    };

    const currentMap = { ...this.notesSubject.value };
    const dayNotes = currentMap[today] ? [newNote, ...currentMap[today]] : [newNote];
    currentMap[today] = dayNotes;

    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);
    return newNote;
  }

  togglePinToHero(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const nextPinned = !note.isPinnedToHero;
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, isPinnedToHero: nextPinned },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        modified = true;
        break;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  togglePinToCloud(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const nextPinned = !note.isPinnedToCloud;
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, isPinnedToCloud: nextPinned },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        modified = true;
        break;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  /**
   * Забрать себе из Общего облака / Публичного хаба:
   * Создает изолированную личную копию (PRIVATE) в профиле текущего игрока
   * с авто-прикреплением к карточке этого героя (isPinnedToHero: true).
   */
  adoptNoteToPrivate(noteId: string): CloudDayNote | null {
    const all = Object.values(this.notesSubject.value).flat();
    const original = all.find((n) => n.id === noteId);
    if (!original) return null;

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const nowTime = nowIso.substring(11, 16);
    const [h, m] = nowTime.split(':').map(Number);
    const timeMinutes = (h || 0) * 60 + (m || 0);

    const currentProfile = this.profileService.currentProfileId;
    const authorName = 'Вы (' + currentProfile.substring(0, 5) + ')';

    const adoptedNote: CloudDayNote = {
      ...original,
      id: `fork-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dateKey: today,
      time: nowTime,
      timeMinutes,
      createdAt: nowIso,
      authorProfileId: currentProfile,
      authorProfileName: authorName,
      visibility: 'PRIVATE',
      isPinnedToHero: true,
      isPinnedToCloud: false,
      forkedFromNoteId: original.id,
      forkedFromAuthorName: original.actorName || original.authorProfileName || 'Общий Хаб',
    };

    const currentMap = { ...this.notesSubject.value };
    const dayNotes = currentMap[today] ? [adoptedNote, ...currentMap[today]] : [adoptedNote];
    currentMap[today] = dayNotes;

    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);
    return adoptedNote;
  }

  deleteNote(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    let modified = false;

    for (const dateKey of Object.keys(currentMap)) {
      const filtered = currentMap[dateKey].filter((n) => n.id !== noteId);
      if (filtered.length !== currentMap[dateKey].length) {
        currentMap[dateKey] = filtered;
        modified = true;
      }
    }

    if (modified) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
    }
  }

  voteForNote(noteId: string): void {
    const currentMap = { ...this.notesSubject.value };
    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          { ...note, votesCount: (note.votesCount || 0) + 1 },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        this.notesSubject.next(currentMap);
        saveStoredNotes(currentMap);
        break;
      }
    }
  }

  toggleNoteLike(noteId: string, actorId?: string): void {
    const currentMap = { ...this.notesSubject.value };
    const allActors = this.stateSubject.value.actors;
    const targetActorId = actorId || this.stateSubject.value.leadActorId || allActors[0]?.id;
    const actor = allActors.find((a) => a.id === targetActorId) ?? allActors[0];
    if (!actor) return;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const existingLikes = note.likedByActors ? [...note.likedByActors] : [];
        const hasLikedIndex = existingLikes.findIndex((l) => l.actorId === actor.id);

        let updatedLikes: typeof existingLikes;
        if (hasLikedIndex !== -1) {
          updatedLikes = existingLikes.filter((_, i) => i !== hasLikedIndex);
        } else {
          updatedLikes = [
            ...existingLikes,
            {
              actorId: actor.id,
              actorName: actor.name,
              avatarIcon: actor.avatarIcon,
              moodEmoji: '❤️',
              accentColor: actor.accentColor,
            },
          ];
        }

        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          {
            ...note,
            likedByActors: updatedLikes,
            votesCount: updatedLikes.length,
          },
          ...currentMap[dateKey].slice(idx + 1),
        ];
        this.notesSubject.next(currentMap);
        saveStoredNotes(currentMap);
        break;
      }
    }
  }

  addCloudNote(note: CloudDayNote): CloudDayNote {
    const boardId = note.boardId || this.activeBoardIdSubject.value || 'board-global-day';
    const board = this.getBoardById(boardId);
    const enrichedNote: CloudDayNote = {
      ...note,
      boardId,
      tags: mergeNoteTags(note.text || '', note.tags),
      seasonsFeedSlug: note.seasonsFeedSlug || board.seasonsFeedSlug,
      activeFlowSessionIds:
        note.activeFlowSessionIds ??
        (board.flowStatus === FlowStatus.ACTIVE && board.activeSessionId
          ? [board.activeSessionId]
          : []),
    };

    const currentMap = { ...this.notesSubject.value };
    const dateKey = enrichedNote.dateKey || '2026-11-06';
    const list = currentMap[dateKey] ? [...currentMap[dateKey], enrichedNote] : [enrichedNote];
    currentMap[dateKey] = list;
    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);

    // Sync to PostgreSQL API (non-blocking) & Lemon Seasons personal feed via lemon-seasons-neurons
    this.api
      .createTimelineNote(enrichedNote)
      .pipe(catchError(() => of(null)))
      .subscribe();
    this.seasonsBridge.recordTimelineNoteToFeed(enrichedNote, board);

    return enrichedNote;
  }

  getBoardById(boardId: string): TimelineBoard {
    const boards = this.boardsSubject.value;
    return boards.find((b) => b.id === boardId) ?? boards[0];
  }

  getActiveBoard(): TimelineBoard {
    return this.getBoardById(this.activeBoardIdSubject.value);
  }

  selectTimelineBoard(boardId: string): void {
    const boards = this.boardsSubject.value;
    if (!boards.some((b) => b.id === boardId)) return;
    this.activeBoardIdSubject.next(boardId);
  }

  createTimelineBoard(input: {
    title: string;
    description?: string;
    icon?: string;
    colorTheme?: ArenaAccentColor;
    vibeId?: string;
    boardKind?: TimelineBoardKind;
    flowType?: FlowType;
    seasonsFeedSlug?: string;
  }): TimelineBoard {
    const cleanTitle = input.title.trim() || 'Новый TimeLine Board';
    const slugBase = cleanTitle
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || `board-${Date.now()}`;
    const id = `board-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const flowId = `flow-${id}`;
    const newBoard: TimelineBoard = {
      id,
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 5)}`,
      title: cleanTitle,
      description: input.description?.trim() || 'Параллельная TimeLine-лента в Lemon Universe',
      icon: input.icon || 'timeline',
      colorTheme: input.colorTheme || 'indigo',
      vibeId: input.vibeId || 'CHRONO_DAYFLOW',
      boardKind: input.boardKind || 'CUSTOM_PROJECT',
      flowId,
      flowType: input.flowType || FlowType.CONTEXT,
      flowStatus: FlowStatus.ACTIVE,
      activeSessionId: `session-${Date.now()}`,
      seasonsStreamSlug: 'lemon-universe',
      seasonsFeedSlug: input.seasonsFeedSlug?.trim() || `universe-${slugBase}`,
      isDefault: false,
    };

    const next = [...this.boardsSubject.value, newBoard];
    this.boardsSubject.next(next);
    saveStoredBoards(next);
    this.activeBoardIdSubject.next(newBoard.id);

    this.api
      .createTimelineBoard(newBoard)
      .pipe(catchError(() => of(null)))
      .subscribe();

    return newBoard;
  }

  toggleBoardFlowSession(boardId: string): TimelineBoard {
    const boards = this.boardsSubject.value;
    const next = boards.map((b) => {
      if (b.id !== boardId) return b;
      const isRunning = b.flowStatus === FlowStatus.ACTIVE;
      return {
        ...b,
        flowStatus: isRunning ? FlowStatus.PAUSED : FlowStatus.ACTIVE,
        activeSessionId: isRunning ? null : `session-${Date.now()}`,
      };
    });
    this.boardsSubject.next(next);
    saveStoredBoards(next);
    return this.getBoardById(boardId);
  }

  attachCrossLinkToNote(
    sourceNoteId: string,
    crossRef: TimelineNodeCrossRef,
  ): CloudDayNote | null {
    const currentMap = { ...this.notesSubject.value };
    let updatedNote: CloudDayNote | null = null;

    for (const dateKey of Object.keys(currentMap)) {
      const idx = currentMap[dateKey].findIndex((n) => n.id === sourceNoteId);
      if (idx !== -1) {
        const note = currentMap[dateKey][idx];
        const existingRefs = note.crossRefs || [];
        const deduped = [
          ...existingRefs.filter((r) => r.targetNoteId !== crossRef.targetNoteId),
          crossRef,
        ];
        updatedNote = { ...note, crossRefs: deduped };
        currentMap[dateKey] = [
          ...currentMap[dateKey].slice(0, idx),
          updatedNote,
          ...currentMap[dateKey].slice(idx + 1),
        ];
        break;
      }
    }

    if (updatedNote) {
      this.notesSubject.next(currentMap);
      saveStoredNotes(currentMap);
      this.api
        .createTimelineNote(updatedNote)
        .pipe(catchError(() => of(null)))
        .subscribe();
      const board = this.getBoardById(updatedNote.boardId || 'board-global-day');
      this.seasonsBridge.recordTimelineNoteToFeed(updatedNote, board);
    }

    return updatedNote;
  }

  private hydrateTimelinesFromBackend(): void {
    this.api
      .getTimelineBoards()
      .pipe(catchError(() => of([] as TimelineBoard[])))
      .subscribe((boards) => {
        if (boards && boards.length > 0) {
          const current = this.boardsSubject.value;
          const mapById = new Map(current.map((b) => [b.id, b]));
          for (const b of boards) {
            mapById.set(b.id, { ...mapById.get(b.id), ...b });
          }
          const merged = Array.from(mapById.values());
          this.boardsSubject.next(merged);
          saveStoredBoards(merged);
        }
      });

    this.api
      .getTimelineNotes()
      .pipe(catchError(() => of([] as CloudDayNote[])))
      .subscribe((remoteNotes) => {
        if (!remoteNotes || remoteNotes.length === 0) return;
        const currentMap = { ...this.notesSubject.value };
        for (const rn of remoteNotes) {
          const dk = rn.dateKey || '2026-11-06';
          const dayList = currentMap[dk] || [];
          if (!dayList.some((existing) => existing.id === rn.id)) {
            currentMap[dk] = [...dayList, rn];
          }
        }
        this.notesSubject.next(currentMap);
        saveStoredNotes(currentMap);
      });
  }

  clearNotesForDate(dateKey: string): void {
    const currentMap = { ...this.notesSubject.value };
    currentMap[dateKey] = [];
    this.notesSubject.next(currentMap);
    saveStoredNotes(currentMap);
  }

  clearTodayNotes(): void {
    this.clearNotesForDate('2026-11-06');
    const nowKey = new Date().toISOString().split('T')[0];
    if (nowKey !== '2026-11-06') {
      this.clearNotesForDate(nowKey);
    }
  }

  resetDemoArena(): void {
    clearCachedArenaState(this.profileService.currentProfileId);
    this.hydrateFromBackend(this.profileService.currentProfileId, true);
  }

  private hydrateFromBackend(profileId: string, forceOverwrite: boolean): void {
    this.api
      .getFlows({ profileId, scope: 'arena' })
      .pipe(catchError(() => of([] as Flow[])))
      .subscribe((flows) => {
        const { store, stateFlowId } = parseArenaFlows(flows);
        if (stateFlowId) this.stateFlowId = stateFlowId;
        if (!store) return;

        const current = this.stateSubject.value;
        if (!forceOverwrite && current.actors.length >= 30 && current.paradoxes.length > 0) return;
        this.commitState(store, false);
      });
  }

  private commitState(next: ArenaStateStore, syncBackend = true): void {
    this.stateSubject.next(next);
    saveCachedArenaState(this.profileService.currentProfileId, next);

    if (syncBackend && this.stateFlowId) {
      this.api
        .updateFlow(this.stateFlowId, { config: { arenaState: buildArenaStatePayload(next) } })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }
}
