import { AsyncPipe, DatePipe, SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  NgZone,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { HashtagTextComponent } from '../../core/components/hashtag-text.component';
import {
  appendHashtagToText,
  applyHashtagAutocomplete,
  collectHashtagCounts,
  getTrailingHashtagPrefix,
  mergeNoteTags,
  noteHasTag,
} from '../../core/utils/hashtag.utils';
import {
  ArenaAccentColor,
  ArenaActorCard,
  ArenaDesireCard,
  CloudDateTab,
  CloudDayNote,
  CloudItemType,
  FlowStatus,
  FlowType,
  NoteActorLike,
  Profile,
  SeasonsPersonalFeedEntry,
  TimelineBoard,
  TimelineBoardKind,
  TimelineNodeCrossRef,
} from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { readWithLegacyMigration } from '../../core/services/neuron-arena.storage';
import { PartyRealtimeService } from '../../core/services/party-realtime.service';
import { ProfileService } from '../../core/services/profile.service';
import { SeasonsTimelineBridgeService } from '../../core/services/seasons-timeline-bridge.service';
import { PartySoundService } from '../../party-game/party-sound.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaHeroNotesModalComponent } from './arena-hero-notes-modal.component';
import {
  CloudSelectOption,
  CloudThemedSelectComponent,
} from './cloud-themed-select.component';
import {
  CLOUD_DAY_VIBES,
  CLOUD_LANDSCAPES,
  CloudDayVibe,
  CloudDayVibeId,
  CloudLandscapeId,
  CloudLandscapeOption,
  DEFAULT_CLOUD_LANDSCAPE_ID,
  getAccentGlowClasses,
  getAccentStemClasses,
  getCloudLandscape,
  getCloudTypeEmoji,
  getCloudTypeLabel,
  getClusterPinClasses,
  getLikesWord,
  getNoteBorderClass,
  getNoteStemHeight,
  getTimelinePercent,
} from './cloud-timeline.utils';
import {
  detectMentionedActors,
  getAccentAvatarClasses,
  getAccentPillClasses,
} from './arena-ui.utils';

export type CloudViewMode = 'CLOUD_TIMELINE' | 'DAY_FEED' | 'ORBIT' | 'CALENDAR_TIMELINE';
export type CloudFilterLayer =
  | 'ALL'
  | 'THOUGHTS'
  | 'PROPOSALS'
  | 'ACTIONS'
  | 'CHARACTERS'
  | 'ACTIVITIES';

export interface CalendarCoordinateSlot {
  id: string;
  dateKey: string;
  dayLabel: string;
  dateNumber: string;
  timeSlot: string;
  title: string;
  isToday: boolean;
  assignedCards: string[];
  assignedActors: string[];
}

export interface IdeaPitchPreset {
  title: string;
  icon: string;
  category: string;
  colorTheme: ArenaAccentColor;
}

export type { CloudDayVibeId, CloudDayVibe };
export { CLOUD_DAY_VIBES };

export interface TimelineCluster {
  id: string;
  timeMinutes: number;
  time: string;
  timeSpanLabel?: string;
  notes: CloudDayNote[];
  isCluster: boolean;
}

const STORAGE_NOTES_KEY = 'lemon-universe:cloud-notes-v8';
const LEGACY_SQUAD_NOTES_KEY = 'lemon-guild-squad:cloud-notes-v8';
const LEGACY_STORAGE_NOTES_KEY = 'lemon-party:cloud-notes-v8';
const STORAGE_DAY_VIBE_KEY = 'lemon-universe:day-vibe';
const LEGACY_SQUAD_DAY_VIBE_KEY = 'lemon-guild-squad:day-vibe';
const LEGACY_STORAGE_DAY_VIBE_KEY = 'lemon-party:day-vibe';





@Component({
  selector: 'app-party-cloud',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    SlicePipe,
    FormsModule,
    RouterLink,
    ActorAvatarComponent,
    ModalOverlayDirective,
    ArenaHeroNotesModalComponent,
    CloudThemedSelectComponent,
    HashtagMultiselectComponent,
    HashtagTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes thoughtPopIn {
        0% {
          transform: scale(0.92) translateY(6px);
          opacity: 0;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }

      @keyframes pulseGlowRing {
        0%,
        100% {
          opacity: 0.55;
          transform: scale(1);
        }
        50% {
          opacity: 0.95;
          transform: scale(1.05);
        }
      }

      .thought-pop {
        animation: thoughtPopIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .now-sun-glow {
        animation: pulseGlowRing 2.8s ease-in-out infinite;
        will-change: transform, opacity;
      }

      .cloud-sky-canvas {
        contain: layout paint;
      }
    `,
  ],
  templateUrl: './party-cloud.component.html'
})
export class PartyCloudComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly realtime = inject(PartyRealtimeService);
  protected readonly profileService = inject(ProfileService);
  protected readonly seasonsBridge = inject(SeasonsTimelineBridgeService);
  protected readonly sound = inject(PartySoundService);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  // Multi-TimeLine Boards, Player Profiles & Lemon Seasons Personal Feed
  readonly timelineBoards = signal<TimelineBoard[]>([]);
  readonly activeBoardId = signal<string>('board-global-day');
  readonly activeBoard = computed<TimelineBoard | null>(() => {
    const id = this.activeBoardId();
    return this.timelineBoards().find((b) => b.id === id) ?? this.timelineBoards()[0] ?? null;
  });
  readonly allProfiles = signal<Profile[]>([]);
  readonly activeProfile = signal<Profile | null>(null);
  readonly personalFeedEntries = signal<SeasonsPersonalFeedEntry[]>([]);

  readonly isCreateBoardModalOpen = signal<boolean>(false);
  readonly newBoardTitle = signal<string>('');
  readonly newBoardDescription = signal<string>('');
  readonly newBoardKind = signal<TimelineBoardKind>('CUSTOM_PROJECT');
  readonly newBoardFlowType = signal<FlowType>(FlowType.CONTEXT);
  readonly newBoardFeedSlug = signal<string>('');

  readonly isPersonalFeedModalOpen = signal<boolean>(false);
  readonly crossLinkSourceNote = signal<CloudDayNote | null>(null);
  readonly spawnChildCodingNode = signal<boolean>(false);
  readonly childCodingText = signal<string>('');

  // Day Vibes & Horizon Landscape system
  readonly vibes = CLOUD_DAY_VIBES;
  readonly landscapes = CLOUD_LANDSCAPES;
  readonly selectedVibeId = signal<CloudDayVibeId>(this.loadInitialVibe());
  readonly isVibePickerOpen = signal<boolean>(false);
  readonly selectedLandscapeId = signal<CloudLandscapeId>(DEFAULT_CLOUD_LANDSCAPE_ID);
  readonly landscapeLightsEnabled = signal<boolean>(true);
  readonly showTimeGrid = signal<boolean>(true);
  readonly isAppearanceModalOpen = signal<boolean>(false);

  readonly currentVibe = computed<CloudDayVibe>(() => {
    const id = this.selectedVibeId();
    return CLOUD_DAY_VIBES.find((v) => v.id === id) || CLOUD_DAY_VIBES[0];
  });

  readonly currentLandscape = computed<CloudLandscapeOption>(() =>
    getCloudLandscape(this.selectedLandscapeId()),
  );

  readonly viewMode = signal<CloudViewMode>('CLOUD_TIMELINE');
  readonly defaultFilterLayer: CloudFilterLayer = 'ALL';
  readonly activeLayer = signal<CloudFilterLayer>('ALL');

  // Selected Date Key (Defaults to Today 2026-11-06)
  readonly selectedDateKey = signal<string>('2026-11-06');

  // Notes Store (dateKey -> CloudDayNote[])
  readonly notesStore = signal<Record<string, CloudDayNote[]>>(this.loadInitialNotes());

  // Cached current time signals (updated once per minute outside Angular zone)
  readonly nowTimeText = signal<string>(this.getCurrentTimeString());
  readonly nowTimePercent = signal<number>(this.getCurrentTimePercent());

  // Input states for new thought/proposal/action
  readonly selectedActionType = signal<CloudItemType>('thought');
  readonly newNoteTime = signal<string>(this.getCurrentTimeString());
  readonly isTimeCustomized = signal<boolean>(false);
  readonly isTimePickerModalOpen = signal<boolean>(false);
  readonly modalDraftTime = signal<string>(this.getCurrentTimeString());
  readonly newIdeaTitle = signal<string>('');

  readonly detectedPartyActors = computed<ArenaActorCard[]>(() => {
    return detectMentionedActors(
      this.newIdeaTitle(),
      this.allActors(),
      this.activePitchActor()?.id,
    );
  });

  readonly isModalTimeNow = computed(() => {
    return this.modalDraftTime() === this.nowTimeText();
  });

  // Active Roleplay Character & Actors signals
  readonly allActors = signal<ArenaActorCard[]>([]);
  readonly quickActors = computed(() => this.allActors().slice(0, 7));
  readonly activePitchActor = signal<ArenaActorCard | null>(null);
  readonly activeSubActor = signal<ArenaActorCard | null>(null);
  readonly replyingToNote = signal<CloudDayNote | null>(null);
  readonly isCharacterPickerOpen = signal<boolean>(false);
  readonly characterPickerMode = signal<'MAIN' | 'SUB'>('MAIN');

  // Character Focus in Cloud & Personal Workspace
  readonly selectedActorFilter = signal<string | null>(null);
  readonly selectedTagFilter = signal<string | null>(null);
  readonly selectedActorForWorkspace = signal<ArenaActorCard | null>(null);

  // Composer Popovers (Presets & Party Mentions) & Multiselect Hashtags
  readonly activeComposerPopover = signal<'PRESETS' | 'PARTY' | null>(null);
  readonly partySearchQuery = signal<string>('');
  readonly composerSelectedTags = signal<string[]>([]);

  readonly filteredPartyActors = computed<ArenaActorCard[]>(() => {
    const activeId = this.activePitchActor()?.id;
    const q = this.partySearchQuery().trim().toLowerCase();
    return this.allActors().filter((a) => {
      if (a.id === activeId) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
    });
  });

  readonly filteredActor = computed<ArenaActorCard | null>(() => {
    const id = this.selectedActorFilter();
    if (!id) return null;
    return this.allActors().find((a) => a.id === id) ?? null;
  });

  // Inspector & Space Creation
  readonly inspectedNote = signal<CloudDayNote | null>(null);
  readonly inspectedActor = signal<ArenaActorCard | null>(null);
  readonly inspectedCard = signal<ArenaDesireCard | null>(null);
  readonly activeSpaceTitle = signal<string>('Friday Chill Core');
  readonly hostActorName = signal<string>('Бунтарь Кот');
  readonly isCreateSpaceModalOpen = signal<boolean>(false);
  readonly newSpaceTitle = signal<string>('');
  readonly newSpaceDescription = signal<string>('');
  readonly newSpaceHostId = signal<string>('');

  readonly cardSupporters = signal<Record<string, string[]>>({
    'card-board-games': ['actor-misha', 'actor-kot-rebel', 'actor-solomon'],
    'card-burger-bbq': ['actor-ratatouille', 'actor-kapitan-zaryad'],
    'card-lemon-seasons': ['actor-lemon-coder', 'actor-starleader'],
  });

  readonly timelineSlots: CalendarCoordinateSlot[] = [
    {
      id: 'slot-today-memorial',
      dateKey: '2026-11-06',
      dayLabel: 'Сегодня (Пт)',
      dateNumber: '6 Ноя',
      timeSlot: '09:00 — 10:30',
      title: '🕊️ Алексей и Акин · Поминный день',
      isToday: true,
      assignedCards: ['card-board-games'],
      assignedActors: ['actor-alexey', 'actor-akin'],
    },
    {
      id: 'slot-today-overwatch-sarah',
      dateKey: '2026-11-06',
      dayLabel: 'Сегодня (Пт)',
      dateNumber: '6 Ноя',
      timeSlot: '11:40 — 13:00',
      title: '🎮 Сарра · Овервотч',
      isToday: true,
      assignedCards: ['card-overwatch-beer'],
      assignedActors: ['actor-sarah', 'actor-ginny'],
    },
    {
      id: 'slot-today-coding-session',
      dateKey: '2026-11-06',
      dayLabel: 'Сегодня (Пт)',
      dateNumber: '6 Ноя',
      timeSlot: '12:20 — 15:00',
      title: '💻 Коддинг сессия · Программист Lemon Team & ТимЛид Старлидер',
      isToday: true,
      assignedCards: ['card-lemon-seasons'],
      assignedActors: ['actor-lemon-coder', 'actor-starleader'],
    },
    {
      id: 'slot-yest-night',
      dateKey: '2026-11-05',
      dayLabel: 'Вчера (Чт)',
      dateNumber: '5 Ноя',
      timeSlot: '20:00 — 23:30',
      title: '🍕 Прошлый Чилл & Пицца',
      isToday: false,
      assignedCards: ['card-board-games'],
      assignedActors: ['actor-misha', 'actor-kot-rebel'],
    },
  ];

  // Candlestick Chart Hour Milestones (08:00 to 24:00 range)
  readonly hourMilestones = [
    { label: '08:00', icon: '🌅', minutes: 480 },
    { label: '10:00', icon: '☕', minutes: 600 },
    { label: '12:00', icon: '☀️', minutes: 720 },
    { label: '14:00', icon: '🍕', minutes: 840 },
    { label: '16:00', icon: '💡', minutes: 960 },
    { label: '18:00', icon: '🌆', minutes: 1080 },
    { label: '20:00', icon: '🎮', minutes: 1200 },
    { label: '22:00', icon: '🌙', minutes: 1320 },
    { label: '24:00', icon: '💤', minutes: 1440 },
  ];

  readonly dayPeriods = [
    { id: 'morning', title: 'Утро (06:00 — 12:00)', icon: '🌅', hours: '06:00 — 12:00', min: 360, max: 720, defaultTime: '09:00' },
    { id: 'afternoon', title: 'День (12:00 — 17:00)', icon: '☀️', hours: '12:00 — 17:00', min: 720, max: 1020, defaultTime: '13:30' },
    { id: 'evening', title: 'Вечер (17:00 — 22:00)', icon: '🌆', hours: '17:00 — 22:00', min: 1020, max: 1320, defaultTime: '19:00' },
    { id: 'night', title: 'Ночь (22:00 — 04:00)', icon: '🌙', hours: '22:00 — 04:00', min: 1320, max: 1440, defaultTime: '22:30' },
  ];

  readonly thoughtPresets: IdeaPitchPreset[] = [
    { title: 'Кофе-брейк', icon: '☕', category: 'Чат', colorTheme: 'amber' },
    { title: 'Заказать пиццу', icon: '🍕', category: 'Еда', colorTheme: 'amber' },
    { title: 'Сыграть в CS2 / Настолки', icon: '🎮', category: 'Игры', colorTheme: 'emerald' },
    { title: 'Гениальная мысль', icon: '💡', category: 'Идея', colorTheme: 'cyan' },
    { title: 'Пора отдохнуть', icon: '🏖️', category: 'Чилл', colorTheme: 'rose' },
    { title: 'Врубить музыку', icon: '🎵', category: 'Музыка', colorTheme: 'violet' },
  ];

  readonly dateTabs = computed<CloudDateTab[]>(() => {
    const store = this.notesStore();
    const boardId = this.activeBoardId();
    const countForBoard = (key: string) =>
      (store[key] ?? []).filter((n) => (n.boardId || 'board-global-day') === boardId).length;
    return [
      {
        dateKey: '2026-11-05',
        label: 'Вчера',
        subLabel: '5 Ноября',
        isToday: false,
        notesCount: countForBoard('2026-11-05'),
      },
      {
        dateKey: '2026-11-06',
        label: 'Сегодня (Пт)',
        subLabel: '6 Ноября',
        isToday: true,
        notesCount: countForBoard('2026-11-06'),
      },
      {
        dateKey: '2026-11-07',
        label: 'Завтра (Сб)',
        subLabel: '7 Ноября',
        isToday: false,
        notesCount: countForBoard('2026-11-07'),
      },
    ];
  });

  readonly activeDateNotes = computed<CloudDayNote[]>(() => {
    const store = this.notesStore();
    const key = this.selectedDateKey();
    const boardId = this.activeBoardId();
    const notes = (store[key] ?? []).filter((n) => (n.boardId || 'board-global-day') === boardId);
    return [...notes].sort((a, b) => a.timeMinutes - b.timeMinutes);
  });

  readonly noteCountsByType = computed<Record<CloudItemType, number>>(() => {
    const counts: Record<CloudItemType, number> = {
      thought: 0,
      proposal: 0,
      action: 0,
    };
    for (const note of this.activeDateNotes()) {
      counts[note.type] = (counts[note.type] ?? 0) + 1;
    }
    return counts;
  });

  readonly actorNotesCountMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const note of this.activeDateNotes()) {
      const participantIds = new Set<string>();
      if (note.actorId) participantIds.add(note.actorId);
      if (note.subActorId) participantIds.add(note.subActorId);
      if (note.partyActorIds) {
        for (const pid of note.partyActorIds) participantIds.add(pid);
      }
      for (const pid of participantIds) {
        map[pid] = (map[pid] ?? 0) + 1;
      }
    }
    return map;
  });

  readonly filterLayerOptions = computed<CloudSelectOption<CloudFilterLayer>[]>(() => {
    const counts = this.noteCountsByType();
    return [
      {
        value: 'ALL',
        label: 'Все записи',
        materialIcon: 'filter_list',
        badge: this.activeDateNotes().length,
        tone: 'default',
      },
      {
        value: 'THOUGHTS',
        label: 'Мысли',
        emoji: '💭',
        badge: counts.thought,
        tone: 'amber',
      },
      {
        value: 'PROPOSALS',
        label: 'Предложения',
        emoji: '💡',
        badge: counts.proposal,
        tone: 'emerald',
      },
      {
        value: 'ACTIONS',
        label: 'Экшены',
        emoji: '⚡',
        badge: counts.action,
        tone: 'indigo',
      },
    ];
  });

  readonly actorFilterOptions = computed<CloudSelectOption<string | null>[]>(() => {
    const actors = this.allActors();
    const counts = this.actorNotesCountMap();
    return [
      {
        value: null,
        label: 'Все герои',
        materialIcon: 'groups',
        badge: actors.length,
        tone: 'default',
      },
      ...actors.map((actor) => ({
        value: actor.id,
        label: actor.name,
        subtitle: actor.title,
        avatarIcon: actor.avatarIcon,
        badge: counts[actor.id] > 0 ? counts[actor.id] : undefined,
      })),
    ];
  });

  readonly composerHeroOptions = computed<CloudSelectOption<string>[]>(() => {
    return this.allActors().map((actor) => ({
      value: actor.id,
      label: actor.name,
      subtitle: actor.title,
      avatarIcon: actor.avatarIcon,
    }));
  });

  readonly composerSubActorOptions = computed<CloudSelectOption<string | null>[]>(() => {
    const activeId = this.activePitchActor()?.id;
    const actorOpts: CloudSelectOption<string | null>[] = this.allActors()
      .filter((actor) => actor.id !== activeId)
      .map((actor) => ({
        value: actor.id,
        label: actor.name,
        subtitle: actor.title,
        avatarIcon: actor.avatarIcon,
      }));

    if (this.activeSubActor()) {
      return [
        {
          value: '__NONE__',
          label: 'Убрать соавтора',
          materialIcon: 'person_off',
          tone: 'default',
        },
        ...actorOpts,
      ];
    }

    return actorOpts;
  });

  readonly activeDateFormatted = computed<string>(() => {
    const key = this.selectedDateKey();
    if (key === '2026-11-06') return 'Сегодня (Пятница, 6 Ноября)';
    if (key === '2026-11-05') return 'Вчера (Четверг, 5 Ноября)';
    if (key === '2026-11-07') return 'Завтра (Суббота, 7 Ноября)';
    return key;
  });

  readonly cloudHashtagCounts = computed(() => collectHashtagCounts(this.activeDateNotes()));

  readonly composerHashtagOptions = computed<HashtagSelectOption[]>(() => {
    const map = new Map<string, number | undefined>();
    for (const item of this.cloudHashtagCounts()) {
      map.set(item.tag, item.count);
    }
    for (const def of ['идея', 'пати', 'чилл', 'важно']) {
      if (!map.has(def)) map.set(def, undefined);
    }
    return Array.from(map.entries()).map(([tag, count]) => ({ tag, count }));
  });

  readonly composerPreviewTags = computed<string[]>(() =>
    mergeNoteTags(this.newIdeaTitle(), this.composerSelectedTags()),
  );

  readonly quickComposerHashtags = computed<string[]>(() => {
    const existing = this.cloudHashtagCounts().map((i) => i.tag);
    return Array.from(new Set([...existing, 'идея', 'пати', 'чилл', 'важно'])).slice(0, 8);
  });

  readonly composerAutocompleteTags = computed<string[]>(() => {
    const prefix = getTrailingHashtagPrefix(this.newIdeaTitle());
    if (prefix === null) return [];
    return this.quickComposerHashtags()
      .filter((tag) => !prefix || tag.startsWith(prefix))
      .slice(0, 6);
  });

  readonly visibleNotes = computed<CloudDayNote[]>(() => {
    let notes = this.activeDateNotes();
    const actorId = this.selectedActorFilter();
    if (actorId) {
      notes = notes.filter(
        (n) =>
          n.actorId === actorId ||
          n.subActorId === actorId ||
          (n.partyActorIds?.includes(actorId) ?? false),
      );
    }
    const tagFilter = this.selectedTagFilter();
    if (tagFilter) {
      notes = notes.filter((n) => noteHasTag(n, tagFilter));
    }
    const layer = this.activeLayer();
    if (layer === 'ALL') return notes;
    if (layer === 'THOUGHTS') return notes.filter((n) => n.type === 'thought');
    if (layer === 'PROPOSALS') return notes.filter((n) => n.type === 'proposal');
    if (layer === 'ACTIONS') return notes.filter((n) => n.type === 'action');
    return notes;
  });

  readonly notesByPeriod = computed<Record<string, CloudDayNote[]>>(() => {
    const map: Record<string, CloudDayNote[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    const notes = this.visibleNotes();
    for (const p of this.dayPeriods) {
      map[p.id] = notes.filter((n) => n.timeMinutes >= p.min && n.timeMinutes < p.max);
    }
    return map;
  });

  readonly CLUSTER_GAP_MINUTES = 30;
  readonly clusterActiveIndices = signal<Record<string, number>>({});

  readonly groupedTimelineNotes = computed<TimelineCluster[]>(() => {
    const notes = this.visibleNotes();
    if (notes.length === 0) return [];

    const clusters: TimelineCluster[] = [];
    let currentGroup: CloudDayNote[] = [];

    for (const note of notes) {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
      } else {
        const clusterStart = currentGroup[0].timeMinutes;
        if (note.timeMinutes - clusterStart <= this.CLUSTER_GAP_MINUTES) {
          currentGroup.push(note);
        } else {
          clusters.push(this.buildTimelineCluster(currentGroup));
          currentGroup = [note];
        }
      }
    }

    if (currentGroup.length > 0) {
      clusters.push(this.buildTimelineCluster(currentGroup));
    }

    return clusters;
  });

  readonly inputPlaceholder = computed(() => {
    const actor = this.activePitchActor();
    const sub = this.activeSubActor();
    const name = actor ? actor.name : 'Участник';
    const duoName = sub ? `${name} & ${sub.name}` : name;
    const rep = this.replyingToNote();
    if (rep) {
      return `«${duoName}» в ответ для ${rep.actorName}... (нажмите Enter)`;
    }
    const type = this.selectedActionType();
    if (type === 'thought') {
      return `«${duoName}»: поделиться мыслью... (нажмите Enter)`;
    }
    if (type === 'proposal') {
      return `«${duoName}»: предложить идею... (нажмите Enter)`;
    }
    return `«${duoName}»: совершить экшен... (нажмите Enter)`;
  });

  readonly synergyPercent = computed(() => {
    const notes = this.activeDateNotes();
    let totalVotes = 0;
    for (const n of notes) {
      totalVotes += n.votesCount;
    }
    return Math.min(99, 70 + Math.floor(totalVotes * 1.8));
  });

  readonly gravityPull = computed(() => {
    return (8.0 + (this.synergyPercent() - 70) * 0.12).toFixed(1);
  });

  constructor() {
    this.arena.leadActor$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((actor) => {
      if (actor && !this.activePitchActor()) {
        this.activePitchActor.set(actor);
        this.hostActorName.set(actor.name);
      }
    });

    this.arena.actors$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((actors) => {
      this.allActors.set(actors);
      if (!this.activePitchActor() && actors.length > 0) {
        this.activePitchActor.set(actors[0]);
      }
    });

    this.arena.notesMap$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((map) => {
      this.notesStore.set(map);
    });

    this.arena.timelineBoards$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((boards) => {
      this.timelineBoards.set(boards);
    });

    this.arena.activeBoardId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.activeBoardId.set(id);
    });

    this.profileService.profiles$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((profiles) => {
      this.allProfiles.set(profiles);
    });

    this.profileService.activeProfile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((profile) => {
      this.activeProfile.set(profile);
    });

    this.seasonsBridge.personalFeedEntries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => {
        this.personalFeedEntries.set(entries);
      });

    combineLatest([this.arena.actors$, this.route.queryParams])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([actors, params]) => {
        const q = (params['workspace'] || params['actor'] || params['hero'])?.toLowerCase();
        if (q && actors.length > 0) {
          const found = actors.find(
            (a) =>
              a.id.toLowerCase() === q ||
              a.id.toLowerCase() === `actor-${q}` ||
              a.handle.toLowerCase() === q ||
              a.name.toLowerCase().includes(q),
          );
          if (found && this.selectedActorForWorkspace()?.id !== found.id) {
            this.selectedActorForWorkspace.set(found);
            this.selectedActorFilter.set(found.id);
          }
        }
      });

    if (typeof window !== 'undefined') {
      this.ngZone.runOutsideAngular(() => {
        const timerId = window.setInterval(() => {
          const nextText = this.getCurrentTimeString();
          if (nextText !== this.nowTimeText()) {
            this.nowTimeText.set(nextText);
            this.nowTimePercent.set(this.getCurrentTimePercent());
          }
        }, 60_000);
        this.destroyRef.onDestroy(() => window.clearInterval(timerId));
      });
    }
  }

  isCloudView(): boolean {
    const m = this.viewMode();
    return m === 'CLOUD_TIMELINE' || m === 'ORBIT';
  }

  isFeedView(): boolean {
    const m = this.viewMode();
    return m === 'DAY_FEED' || m === 'CALENDAR_TIMELINE';
  }

  isTodaySelected(): boolean {
    return this.selectedDateKey() === '2026-11-06';
  }

  selectDate(dateKey: string): void {
    this.selectedDateKey.set(dateKey);
    this.sound.playClick();
  }

  getActiveDateFormatted(): string {
    return this.activeDateFormatted();
  }

  countNotesByType(type: CloudItemType): number {
    return this.noteCountsByType()[type] ?? 0;
  }

  getTopLaneNotes(): CloudDayNote[] {
    return this.visibleNotes().filter((_, idx) => idx % 2 === 0);
  }

  getBottomLaneNotes(): CloudDayNote[] {
    return this.visibleNotes().filter((_, idx) => idx % 2 === 1);
  }

  // Candlestick Chart and Timeline visual helpers
  readonly getNoteStemHeight = getNoteStemHeight;
  readonly getAccentStemClasses = getAccentStemClasses;
  readonly getAccentGlowClasses = getAccentGlowClasses;
  readonly getClusterPinClasses = getClusterPinClasses;
  readonly getTimelinePercent = getTimelinePercent;

  getCurrentTimePercent(): number {
    const now = new Date();
    const hours = now.getHours() || 13;
    const mins = now.getMinutes() || 45;
    return getTimelinePercent(hours * 60 + mins);
  }

  currentTimeString(): string {
    return this.nowTimeText();
  }

  onTimelineRoadClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const rawRatio = Math.max(0, Math.min(1, clickX / rect.width));

    // Normalize from the 6% to 94% span
    const normalized = Math.max(0, Math.min(1, (rawRatio - 0.06) / 0.88));
    const mins = Math.round(480 + normalized * (1440 - 480));
    const h = Math.floor(mins / 60);
    const m = Math.round((mins % 60) / 15) * 15;
    const formatted = `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    this.newNoteTime.set(formatted);
    this.sound.playTick();
  }

  setTimeForSlot(time: string): void {
    this.newNoteTime.set(time);
    this.sound.playTick();
  }

  getNotesForPeriod(min: number, max: number): CloudDayNote[] {
    return this.visibleNotes().filter((n) => n.timeMinutes >= min && n.timeMinutes < max);
  }

  getInputPlaceholder(): string {
    return this.inputPlaceholder();
  }

  protected readonly getTypeLabel = getCloudTypeLabel;
  protected readonly getTypeEmoji = getCloudTypeEmoji;
  protected readonly getNoteBorderClass = getNoteBorderClass;

  appendActorMention(actor: ArenaActorCard): void {
    const current = this.newIdeaTitle().trim();
    if (!current) {
      this.newIdeaTitle.set(`+ ${actor.name}`);
    } else {
      this.newIdeaTitle.set(`${current} + ${actor.name}`);
    }
  }

  submitNoteOrIdea(): void {
    const text = this.newIdeaTitle().trim();
    if (!text) return;

    const actor = this.activePitchActor();
    const dateKey = this.selectedDateKey();
    const time = this.newNoteTime() || this.getCurrentTimeString();
    const [h, m] = time.split(':').map(Number);
    const timeMinutes = (h || 12) * 60 + (m || 0);
    const type = this.selectedActionType();

    // Auto-detect mentioned actors in text
    const detected = detectMentionedActors(text, this.allActors(), actor?.id);
    const explicitSubActor = this.activeSubActor();
    const subActor = explicitSubActor || (detected.length > 0 ? detected[0] : null);

    const initialParty = detected.map((a) => a.id);
    if (subActor && !initialParty.includes(subActor.id)) {
      initialParty.push(subActor.id);
    }
    const partyActorIds = Array.from(new Set(initialParty));
    const allActorsMap = new Map(this.allActors().map((a) => [a.id, a]));
    const partyActorNames = partyActorIds.map((id) => allActorsMap.get(id)?.name || id);

    const likedByActors = [
      ...(actor ? [{ actorId: actor.id, actorName: actor.name, avatarIcon: actor.avatarIcon, moodEmoji: '✨' }] : []),
      ...(subActor && subActor.id !== actor?.id
        ? [{ actorId: subActor.id, actorName: subActor.name, avatarIcon: subActor.avatarIcon, moodEmoji: '🤝' }]
        : []),
      ...detected
        .filter((a) => a.id !== actor?.id && a.id !== subActor?.id)
        .map((a) => ({ actorId: a.id, actorName: a.name, avatarIcon: a.avatarIcon, moodEmoji: '🤝' })),
    ];

    const supporters = new Set<string>();
    if (actor) supporters.add(actor.id);
    if (subActor) supporters.add(subActor.id);
    for (const pid of partyActorIds) supporters.add(pid);

    const rep = this.replyingToNote();
    const replyToNoteId = rep?.id;
    const replyToAuthorName = rep?.actorName;
    const replyToTextSnippet = rep ? (rep.text.length > 55 ? rep.text.slice(0, 52) + '...' : rep.text) : undefined;
    const currentBoardId = this.activeBoardId();
    const currentProfile = this.activeProfile();

    let crossRefs: TimelineNodeCrossRef[] | undefined;
    if (this.spawnChildCodingNode() && currentBoardId !== 'board-coding-sessions') {
      const codingBoard = this.arena.getBoardById('board-coding-sessions');
      const agentActor =
        this.allActors().find((a) => a.id === 'actor-antigravity-agent') || actor;
      const childText =
        this.childCodingText().trim() ||
        `Детали кодинг-сессии: ${text} (привязано из глобального таймлайна)`;
      const childId = `note-coding-${Date.now()}`;
      const childNote: CloudDayNote = {
        id: childId,
        boardId: codingBoard.id,
        dateKey,
        time,
        timeMinutes,
        type: 'action',
        actorId: agentActor?.id || 'actor-antigravity-agent',
        actorName: agentActor?.name || 'Antigravity Agent',
        actorAvatar: agentActor?.avatarIcon || 'antigravity-agent',
        actorAccent: agentActor?.accentColor || 'violet',
        actorTitle: agentActor?.title || '',
        subActorId: actor && actor.id !== agentActor?.id ? actor.id : undefined,
        subActorName: actor && actor.id !== agentActor?.id ? actor.name : undefined,
        subActorAvatar: actor && actor.id !== agentActor?.id ? actor.avatarIcon : undefined,
        subActorAccent: actor && actor.id !== agentActor?.id ? actor.accentColor : undefined,
        title: `Кодинг-сессия: ${text.slice(0, 48)}`,
        text: childText,
        tags: ['coding-session', 'cross-timeline', 'antigravity-agent'],
        supporters: [agentActor?.id || 'actor-antigravity-agent'],
        votesCount: 1,
        moodEmoji: '⚡',
        createdAt: new Date().toISOString(),
        visibility: 'PUBLIC',
        authorProfileId: 'a7e49c10-9100-4b22-a811-9000a6e17001',
        authorProfileName: '🤖 Игрок-Агент (AI Guild)',
        parentCrossRef: {
          sourceBoardId: currentBoardId,
          sourceBoardTitle: this.getBoardTitle(currentBoardId),
          sourceNoteId: `note-${Date.now()}`,
          sourceTime: time,
          sourceActorName: actor?.name || 'Участник',
        },
      };
      this.arena.addCloudNote(childNote);

      crossRefs = [
        {
          id: `crosslink-${Date.now()}`,
          targetBoardId: codingBoard.id,
          targetBoardTitle: codingBoard.title,
          targetBoardIcon: codingBoard.icon,
          targetNoteId: childNote.id,
          targetDateKey: dateKey,
          targetTime: time,
          targetActorId: childNote.actorId,
          targetActorName: childNote.actorName,
          targetActorAvatar: childNote.actorAvatar,
          targetTitle: childNote.title,
          targetSnippet: childNote.text.slice(0, 140),
          relationLabel: 'Дочерний узел · Сессия Кодинга',
          sessionStatus: codingBoard.flowStatus === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
        },
      ];
    }

    const tags = mergeNoteTags(text, this.composerSelectedTags());

    const newNote: CloudDayNote = {
      id: `note-${Date.now()}`,
      boardId: currentBoardId,
      dateKey,
      time,
      timeMinutes,
      type,
      actorId: actor?.id || 'actor-anon',
      actorName: actor?.name || 'Участник',
      actorAvatar: actor?.avatarIcon || 'kot-rebel',
      actorAccent: actor?.accentColor || 'amber',
      actorTitle: actor?.title || '',
      subActorId: subActor?.id,
      subActorName: subActor?.name,
      subActorAvatar: subActor?.avatarIcon,
      subActorAccent: subActor?.accentColor,
      replyToNoteId,
      replyToAuthorName,
      replyToTextSnippet,
      text,
      tags,
      supporters: Array.from(supporters),
      votesCount: supporters.size,
      moodEmoji: type === 'thought' ? '💭' : type === 'proposal' ? '💡' : '⚡',
      createdAt: new Date().toISOString(),
      visibility: 'PUBLIC',
      authorProfileId: currentProfile?.id,
      authorProfileName: currentProfile?.displayName,
      partyActorIds: partyActorIds.length > 0 ? partyActorIds : undefined,
      partyActorNames: partyActorNames.length > 0 ? partyActorNames : undefined,
      likedByActors: likedByActors.length > 0 ? likedByActors : undefined,
      crossRefs,
    };

    this.notesStore.update((store) => {
      const current = store[dateKey] ? [...store[dateKey]] : [];
      const updated = { ...store, [dateKey]: [...current, newNote] };
      this.persistNotes(updated);
      return updated;
    });

    this.arena.addCloudNote(newNote);

    this.newIdeaTitle.set('');
    this.composerSelectedTags.set([]);
    this.activeSubActor.set(null);
    this.replyingToNote.set(null);
    this.spawnChildCodingNode.set(false);
    this.childCodingText.set('');
    this.sound.playWin();

    const partyMentionStr = partyActorNames.length > 0 ? ` (в пати: ${partyActorNames.join(', ')})` : '';
    const replyMentionStr = replyToAuthorName ? ` (в ответ для ${replyToAuthorName})` : '';
    this.realtime.broadcastEvent({
      type: 'CARD_PLAYED',
      actorName: newNote.actorName,
      actorIcon: newNote.actorAvatar,
      roomTitle: this.activeSpaceTitle(),
      message: `${type === 'thought' ? 'поделился мыслью' : type === 'proposal' ? 'выдвинул предложение' : 'совершил экшен'} «${text}»${replyMentionStr}${partyMentionStr} на ${time}!`,
    });
  }

  submitPitchIdea(): void {
    this.submitNoteOrIdea();
  }

  pitchPreset(preset: IdeaPitchPreset): void {
    this.newIdeaTitle.set(preset.title);
    this.submitNoteOrIdea();
  }

  getResolvedLikes(note: CloudDayNote): NoteActorLike[] {
    if (note.likedByActors && note.likedByActors.length > 0) {
      return note.likedByActors;
    }
    if (note.supporters && note.supporters.length > 0) {
      const actorsMap = new Map(this.allActors().map((a) => [a.id, a]));
      return note.supporters
        .map((supId) => actorsMap.get(supId))
        .filter((a): a is ArenaActorCard => Boolean(a))
        .map((a) => ({
          actorId: a.id,
          actorName: a.name,
          avatarIcon: a.avatarIcon,
          moodEmoji: '❤️',
          accentColor: a.accentColor,
        }));
    }
    return [];
  }

  getVisibleLikes(note: CloudDayNote): NoteActorLike[] {
    const likes = this.getResolvedLikes(note);
    return likes.slice(0, 3);
  }

  getHiddenLikes(note: CloudDayNote): NoteActorLike[] {
    const likes = this.getResolvedLikes(note);
    return likes.length > 3 ? likes.slice(3) : [];
  }

  getHiddenLikesNames(note: CloudDayNote): string {
    const hidden = this.getHiddenLikes(note);
    return hidden.map((l) => l.actorName).join(', ');
  }

  getHiddenLikesTooltip(note: CloudDayNote): string {
    const hidden = this.getHiddenLikes(note);
    if (hidden.length === 0) return '';
    return `Оценили: ${hidden.map((l) => l.actorName).join(', ')}`;
  }

  hasActorLiked(note: CloudDayNote): boolean {
    const actorId = this.activePitchActor()?.id;
    if (!actorId) return false;
    const likes = this.getResolvedLikes(note);
    return likes.some((l) => l.actorId === actorId);
  }

  voteForNote(noteId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    const currentActor = this.activePitchActor();
    const actorId = currentActor ? currentActor.id : 'actor-anon';
    const dateKey = this.selectedDateKey();

    this.notesStore.update((store) => {
      const list = store[dateKey] ?? [];
      const updatedList = list.map((n) => {
        if (n.id === noteId) {
          const resolvedLikes = this.getResolvedLikes(n);
          const alreadyLikedIndex = resolvedLikes.findIndex((l) => l.actorId === actorId);

          let nextLikes: NoteActorLike[];
          let nextSupporters: string[];
          let nextVotes: number;

          if (alreadyLikedIndex !== -1) {
            // Toggle unlike
            nextLikes = resolvedLikes.filter((_, i) => i !== alreadyLikedIndex);
            nextSupporters = n.supporters.filter((id) => id !== actorId);
            nextVotes = Math.max(0, n.votesCount - 1);
          } else {
            // Add personalized like
            const newLike: NoteActorLike = {
              actorId,
              actorName: currentActor?.name || 'Участник',
              avatarIcon: currentActor?.avatarIcon || 'person',
              moodEmoji: '❤️',
              accentColor: currentActor?.accentColor,
            };
            nextLikes = [...resolvedLikes, newLike];
            nextSupporters = n.supporters.includes(actorId) ? n.supporters : [...n.supporters, actorId];
            nextVotes = n.votesCount + 1;
          }

          return {
            ...n,
            supporters: nextSupporters,
            votesCount: nextVotes,
            likedByActors: nextLikes,
          };
        }
        return n;
      });
      const updated = { ...store, [dateKey]: updatedList };
      this.persistNotes(updated);
      return updated;
    });

    if (this.inspectedNote()?.id === noteId) {
      this.inspectedNote.update((n) => {
        if (!n) return null;
        const currentInStore = this.notesStore()[dateKey]?.find((item) => item.id === noteId);
        return currentInStore || n;
      });
    }

    this.arena.toggleNoteLike(noteId, actorId);
    this.sound.playTick(1.2);

    this.realtime.broadcastEvent({
      type: 'VOTE_CAST',
      actorName: currentActor?.name || 'Участник',
      actorIcon: currentActor?.avatarIcon || 'person',
      roomTitle: this.activeSpaceTitle(),
      message: `поддержал мысль в облаке (+1)!`,
    });
  }

  readonly getLikesWord = getLikesWord;

  getPartyNames(note: CloudDayNote): string {
    if (!note.partyActorIds || note.partyActorIds.length === 0) return '';
    return note.partyActorIds
      .map((id) => this.arena.getActor(id)?.name || id)
      .join(', ');
  }

  voteForCard(cardId: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const actor = this.activePitchActor();
    const actorId = actor ? actor.id : 'actor-anon';

    this.arena.voteForDesireCard(cardId, actorId);
    this.cardSupporters.update((map) => {
      const cur = map[cardId] || [];
      return cur.includes(actorId) ? map : { ...map, [cardId]: [...cur, actorId] };
    });

    this.sound.playTick(1.2);
    this.realtime.broadcastEvent({
      type: 'VOTE_CAST',
      actorName: actor?.name || 'Участник',
      actorIcon: actor?.avatarIcon || 'person',
      roomTitle: this.activeSpaceTitle(),
      message: `поддержал карточку в пространстве!`,
    });
  }

  deleteNote(noteId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const dateKey = this.selectedDateKey();
    this.notesStore.update((store) => {
      const list = (store[dateKey] ?? []).filter((n) => n.id !== noteId);
      const updated = { ...store, [dateKey]: list };
      this.persistNotes(updated);
      return updated;
    });
    this.sound.playClick();
  }

  inspectNote(note: CloudDayNote): void {
    this.inspectedNote.set(note);
    const found = this.allActors().find((a) => a.id === note.actorId);
    this.inspectedActor.set(found || null);
    this.sound.playClick();
  }

  closeInspectModal(): void {
    this.inspectedNote.set(null);
    this.inspectedActor.set(null);
  }

  startReply(note: CloudDayNote, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.replyingToNote.set(note);
    if (note.time) {
      const [h, m] = note.time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const totalMinutes = (h * 60 + m + 5) % 1440;
        const newH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const newM = (totalMinutes % 60).toString().padStart(2, '0');
        this.newNoteTime.set(`${newH}:${newM}`);
      }
    }
    try {
      const el = document.getElementById('cloud-composer');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {}
  }

  startReplyFromModal(note: CloudDayNote): void {
    this.startReply(note);
    this.closeInspectModal();
  }

  cancelReply(): void {
    this.replyingToNote.set(null);
  }

  getRepliesForNote(noteId: string): CloudDayNote[] {
    const active = this.activeDateNotes();
    return active.filter((n) => n.replyToNoteId === noteId);
  }

  jumpToRepliedNote(noteId?: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!noteId) return;
    const found = this.activeDateNotes().find((n) => n.id === noteId);
    if (found) {
      this.inspectNote(found);
    }
  }

  selectPitchActorFromInspect(): void {
    const note = this.inspectedNote();
    if (!note) return;
    const actor = this.allActors().find((a) => a.id === note.actorId);
    if (actor) {
      this.selectPitchActor(actor);
    }
    this.closeInspectModal();
  }

  deleteInspectedNote(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.deleteNote(note.id);
    this.deleteNote(note.id);
    this.closeInspectModal();
  }

  adoptInspectedNoteToPrivate(): void {
    const note = this.inspectedNote();
    if (!note) return;
    const adopted = this.arena.adoptNoteToPrivate(note.id);
    this.sound.playWin();
    if (adopted) {
      this.inspectedNote.set(adopted);
    }
  }

  togglePinInspectedToHero(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.togglePinToHero(note.id);
    this.inspectedNote.update((n) => (n ? { ...n, isPinnedToHero: !n.isPinnedToHero } : null));
    this.sound.playClick();
  }

  togglePinInspectedToCloud(): void {
    const note = this.inspectedNote();
    if (!note) return;
    this.arena.togglePinToCloud(note.id);
    this.inspectedNote.update((n) => (n ? { ...n, isPinnedToCloud: !n.isPinnedToCloud } : null));
    this.sound.playClick();
  }

  selectActorFilter(actorId: string | null): void {
    this.selectedActorFilter.set(actorId);
    this.sound.playClick();
  }

  onLayerFilterChange(layer: CloudFilterLayer): void {
    this.activeLayer.set(layer);
    this.sound.playClick();
  }

  onComposerHeroChange(actorId: string | null): void {
    if (!actorId) return;
    const actor = this.allActors().find((a) => a.id === actorId);
    if (!actor) return;
    this.activePitchActor.set(actor);
    this.hostActorName.set(actor.name);
    if (this.activeSubActor()?.id === actor.id) {
      this.activeSubActor.set(null);
    }
    this.sound.playTick(1.1);
  }

  onComposerSubActorChange(actorId: string | null): void {
    if (!actorId || actorId === '__NONE__') {
      this.clearSubActor();
      return;
    }
    const actor = this.allActors().find((a) => a.id === actorId) ?? null;
    this.setSubActor(actor);
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    if (this.activeComposerPopover() !== null) {
      this.closeComposerPopover();
    }
  }

  toggleComposerPopover(kind: 'PRESETS' | 'PARTY', event?: MouseEvent): void {
    event?.stopPropagation();
    const next = this.activeComposerPopover() === kind ? null : kind;
    this.activeComposerPopover.set(next);
    if (next === 'PARTY') {
      this.partySearchQuery.set('');
    }
    this.sound.playClick();
  }

  closeComposerPopover(): void {
    this.activeComposerPopover.set(null);
    this.partySearchQuery.set('');
  }

  toggleTagFilter(tag: string): void {
    this.selectedTagFilter.update((curr) => (curr === tag ? null : tag));
    this.sound.playClick();
  }

  getDisplayTags(note: CloudDayNote): string[] {
    return mergeNoteTags(note.text || '', note.tags);
  }

  onTagChipClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    this.toggleTagFilter(tag);
  }

  onModalTagClick(tag: string): void {
    this.closeInspectModal();
    this.toggleTagFilter(tag);
  }

  insertComposerHashtag(tag: string): void {
    this.newIdeaTitle.update((curr) => appendHashtagToText(curr, tag));
  }

  applyComposerAutocomplete(tag: string): void {
    this.newIdeaTitle.update((curr) => applyHashtagAutocomplete(curr, tag));
  }

  selectQuickPresetFromPopover(preset: IdeaPitchPreset): void {
    this.pitchPreset(preset);
    this.closeComposerPopover();
  }

  mentionPartyHeroFromPopover(hero: ArenaActorCard): void {
    this.appendActorMention(hero);
    this.closeComposerPopover();
  }

  openCharacterWorkspace(actor: ArenaActorCard): void {
    this.selectedActorForWorkspace.set(actor);
    this.sound.playClick();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { workspace: actor.id },
      queryParamsHandling: 'merge',
    });
  }

  closeCharacterWorkspace(): void {
    this.selectedActorForWorkspace.set(null);
    if (
      this.route.snapshot.queryParams['workspace'] ||
      this.route.snapshot.queryParams['actor'] ||
      this.route.snapshot.queryParams['hero']
    ) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { workspace: null, actor: null, hero: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  openWorkspaceFromInspectedNote(): void {
    const note = this.inspectedNote();
    if (!note) return;
    const actor = this.allActors().find((a) => a.id === note.actorId);
    if (actor) {
      this.closeInspectModal();
      this.openCharacterWorkspace(actor);
    }
  }

  getActorNotesCountForDate(actorId: string): number {
    return this.actorNotesCountMap()[actorId] ?? 0;
  }

  buildTimelineCluster(notes: CloudDayNote[]): TimelineCluster {
    const isCluster = notes.length > 1;
    const first = notes[0];
    const last = notes[notes.length - 1];

    const avgMinutes = Math.round(
      notes.reduce((acc, n) => acc + n.timeMinutes, 0) / notes.length
    );

    const timeLabel = (!isCluster || first.time === last.time)
      ? first.time
      : `${first.time}–${last.time}`;

    const timeSpanLabel = isCluster
      ? (first.time === last.time
          ? `${first.time} (${notes.length} мыслей в стопке)`
          : `${first.time}–${last.time} (${notes.length} мыслей в стопке)`)
      : undefined;

    const id = isCluster
      ? `cluster-${first.id}-${notes.length}-${first.timeMinutes}`
      : first.id;

    return {
      id,
      timeMinutes: avgMinutes,
      time: timeLabel,
      timeSpanLabel,
      notes,
      isCluster,
    };
  }

  getClusterActiveIndex(clusterId: string): number {
    return this.clusterActiveIndices()[clusterId] ?? 0;
  }

  getClusterActiveNote(cluster: TimelineCluster): CloudDayNote {
    const idx = this.getClusterActiveIndex(cluster.id);
    const clamped = Math.max(0, Math.min(cluster.notes.length - 1, idx));
    return cluster.notes[clamped] ?? cluster.notes[0];
  }

  setClusterIndex(clusterId: string, index: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: index }));
    this.sound.playTick();
  }

  prevClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const prev = (current - 1 + total) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: prev }));
    this.sound.playTick();
  }

  nextClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const next = (current + 1) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: next }));
    this.sound.playTick();
  }

  getInspectedNoteCluster(): TimelineCluster | null {
    const note = this.inspectedNote();
    if (!note) return null;
    return this.groupedTimelineNotes().find((c) => c.isCluster && c.notes.some((n) => n.id === note.id)) ?? null;
  }

  getInspectedNoteClusterIndex(cluster: TimelineCluster): number {
    const note = this.inspectedNote();
    if (!note) return 0;
    const idx = cluster.notes.findIndex((n) => n.id === note.id);
    return idx >= 0 ? idx : 0;
  }

  prevInspectedClusterNote(cluster: TimelineCluster): void {
    const current = this.getInspectedNoteClusterIndex(cluster);
    const prev = (current - 1 + cluster.notes.length) % cluster.notes.length;
    this.inspectNote(cluster.notes[prev]);
  }

  nextInspectedClusterNote(cluster: TimelineCluster): void {
    const current = this.getInspectedNoteClusterIndex(cluster);
    const next = (current + 1) % cluster.notes.length;
    this.inspectNote(cluster.notes[next]);
  }

  toggleCharacterPicker(): void {
    this.openCharacterPickerForMain();
  }

  openCharacterPickerForMain(): void {
    this.characterPickerMode.set('MAIN');
    this.isCharacterPickerOpen.set(true);
    this.sound.playClick();
  }

  openCharacterPickerForSub(): void {
    this.characterPickerMode.set('SUB');
    this.isCharacterPickerOpen.set(true);
    this.sound.playClick();
  }

  setSubActor(actor: ArenaActorCard | null): void {
    this.activeSubActor.set(actor);
    this.sound.playTick(1.1);
  }

  clearSubActor(): void {
    this.activeSubActor.set(null);
    this.sound.playClick();
  }

  closeCharacterPickerModal(): void {
    this.isCharacterPickerOpen.set(false);
  }

  selectPitchActor(actor: ArenaActorCard): void {
    if (this.characterPickerMode() === 'SUB') {
      this.activeSubActor.set(actor);
    } else {
      this.activePitchActor.set(actor);
      this.hostActorName.set(actor.name);
    }
    this.isCharacterPickerOpen.set(false);
    this.sound.playTick(1.1);
  }

  openCreateSpaceModal(): void {
    const current = this.activePitchActor();
    this.newSpaceTitle.set(current ? `Чилл-Зона «${current.name}»` : 'Friday Chill Core');
    this.newSpaceDescription.set('Открытое облачное пространство для выбора формата вечеринки и совместного досуга.');
    this.newSpaceHostId.set(current?.id || 'actor-kot-rebel');
    this.isCreateSpaceModalOpen.set(true);
  }

  closeCreateSpaceModal(): void {
    this.newSpaceTitle.set('');
    this.newSpaceDescription.set('');
    this.newSpaceHostId.set('');
    this.isCreateSpaceModalOpen.set(false);
  }

  onHostChange(hostId: string): void {
    this.newSpaceHostId.set(hostId);
    const actor = this.allActors().find((a) => a.id === hostId);
    if (actor) {
      this.newSpaceTitle.set(`Чилл-Зона «${actor.name}»`);
    }
  }

  submitCreateSpace(): void {
    const title = this.newSpaceTitle().trim() || 'Friday Chill Core';
    const hostId = this.newSpaceHostId();
    const host = this.allActors().find((a) => a.id === hostId) || this.activePitchActor();

    if (host) {
      this.selectPitchActor(host);
      this.hostActorName.set(host.name);
    }

    this.activeSpaceTitle.set(title);
    this.realtime.createRoom({
      title,
      description: this.newSpaceDescription().trim(),
      icon: 'local_pizza',
      themeColor: 'amber',
      scheduledLabel: 'Пятница, 20:00',
      tags: ['чилл', 'облако', 'синергия'],
    });

    this.closeCreateSpaceModal();
    this.sound.playWin();
  }

  scheduleActiveToSlot(slot: CalendarCoordinateSlot): void {
    const actor = this.activePitchActor();
    if (actor && !slot.assignedActors.includes(actor.id)) {
      slot.assignedActors.push(actor.id);
    }

    this.sound.playTick(1.3);
    this.realtime.broadcastEvent({
      type: 'CARD_PLAYED',
      actorName: actor?.name || 'Лидер',
      actorIcon: actor?.avatarIcon || 'person',
      roomTitle: slot.title,
      message: `закрепил активность в слоте «${slot.dayLabel}, ${slot.timeSlot}»!`,
    });
  }

  selectVibe(vibeId: CloudDayVibeId): void {
    this.selectedVibeId.set(vibeId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_DAY_VIBE_KEY, vibeId);
      } catch {}
    }
    this.isVibePickerOpen.set(false);
    this.sound.playWin();
  }

  toggleVibePicker(): void {
    this.isVibePickerOpen.update((open) => !open);
    this.sound.playClick();
  }

  closeVibePickerModal(): void {
    this.isVibePickerOpen.set(false);
  }

  openAppearanceModal(): void {
    this.isAppearanceModalOpen.set(true);
    this.sound.playClick();
  }

  closeAppearanceModal(): void {
    this.isAppearanceModalOpen.set(false);
  }

  selectLandscape(id: CloudLandscapeId): void {
    this.selectedLandscapeId.set(id);
    this.sound.playTick();
  }

  toggleLandscapeLights(): void {
    this.landscapeLightsEnabled.update((v) => !v);
    this.sound.playClick();
  }

  resetCloudAppearance(): void {
    this.selectedLandscapeId.set(DEFAULT_CLOUD_LANDSCAPE_ID);
    this.landscapeLightsEnabled.set(true);
    this.showTimeGrid.set(true);
    this.sound.playClick();
  }

  /* ================== MULTI-TIMELINE, AGENT PLAYER & CROSS-LINK METHODS ================== */

  selectPlayerProfile(profile: Profile): void {
    this.profileService.selectProfile(profile.id);
    if (profile.playerType === 'AGENT') {
      const agentActor = this.allActors().find((a) => a.id === 'actor-antigravity-agent');
      if (agentActor) {
        this.activePitchActor.set(agentActor);
      }
    }
    this.sound.playTick();
  }

  switchToAntigravityAgent(): void {
    const agentProfile = this.allProfiles().find((p) => p.playerType === 'AGENT');
    if (agentProfile) {
      this.profileService.selectProfile(agentProfile.id);
    }
    const agentActor = this.allActors().find((a) => a.id === 'actor-antigravity-agent');
    if (agentActor) {
      this.activePitchActor.set(agentActor);
      this.hostActorName.set(agentActor.name);
    }
    this.sound.playWin();
  }

  selectTimelineBoard(boardId: string): void {
    this.arena.selectTimelineBoard(boardId);
    const board = this.arena.getBoardById(boardId);
    if (board.vibeId && CLOUD_DAY_VIBES.some((v) => v.id === board.vibeId)) {
      this.selectedVibeId.set(board.vibeId as CloudDayVibeId);
    }
    this.sound.playClick();
  }

  getBoardNotesCount(boardId: string): number {
    const store = this.notesStore();
    const key = this.selectedDateKey();
    return (store[key] ?? []).filter((n) => (n.boardId || 'board-global-day') === boardId).length;
  }

  getBoardTitle(boardId: string): string {
    return this.timelineBoards().find((b) => b.id === boardId)?.title || boardId;
  }

  toggleActiveBoardFlow(): void {
    const board = this.activeBoard();
    if (!board) return;
    this.arena.toggleBoardFlowSession(board.id);
    this.sound.playTick(1.1);
  }

  openCreateBoardModal(): void {
    this.newBoardTitle.set('');
    this.newBoardDescription.set('');
    this.newBoardKind.set('CUSTOM_PROJECT');
    this.newBoardFlowType.set(FlowType.CONTEXT);
    this.newBoardFeedSlug.set('');
    this.isCreateBoardModalOpen.set(true);
  }

  closeCreateBoardModal(): void {
    this.newBoardTitle.set('');
    this.newBoardDescription.set('');
    this.newBoardFeedSlug.set('');
    this.isCreateBoardModalOpen.set(false);
  }

  submitCreateBoard(): void {
    const title = this.newBoardTitle().trim();
    if (!title) return;
    const kind = this.newBoardKind();
    const icon =
      kind === 'CODING_SESSIONS'
        ? 'terminal'
        : kind === 'GLOBAL_DAY'
          ? 'public'
          : kind === 'PARTY_ROOM'
            ? 'celebration'
            : 'rocket_launch';
    const vibeId = kind === 'CODING_SESSIONS' ? 'SYNTHWAVE' : 'CHRONO_DAYFLOW';
    const created = this.arena.createTimelineBoard({
      title,
      description: this.newBoardDescription(),
      icon,
      colorTheme: kind === 'CODING_SESSIONS' ? 'violet' : 'amber',
      vibeId,
      boardKind: kind,
      flowType: this.newBoardFlowType(),
      seasonsFeedSlug: this.newBoardFeedSlug() || undefined,
    });
    this.selectedVibeId.set(vibeId as CloudDayVibeId);
    this.closeCreateBoardModal();
    this.sound.playWin();
    this.realtime.broadcastEvent({
      type: 'CARD_PLAYED',
      actorName: this.activePitchActor()?.name || 'Игрок',
      actorIcon: this.activePitchActor()?.avatarIcon || 'person',
      roomTitle: created.title,
      message: `создал новый TimeLine Board «${created.title}» на потоке Core Combinator ${created.flowType}!`,
    });
  }

  openPersonalFeedModal(): void {
    this.isPersonalFeedModalOpen.set(true);
    this.sound.playClick();
  }

  closePersonalFeedModal(): void {
    this.isPersonalFeedModalOpen.set(false);
  }

  toggleSpawnCodingChild(): void {
    this.spawnChildCodingNode.update((v) => !v);
    this.sound.playTick();
  }

  openCrossRefTarget(cref: TimelineNodeCrossRef, event?: Event): void {
    this.jumpToCrossBoardNote(cref.targetBoardId, cref.targetNoteId, event, cref.targetDateKey);
  }

  jumpToCrossBoardNote(
    boardId: string,
    noteId: string,
    event?: Event,
    dateKey?: string,
  ): void {
    if (event) event.stopPropagation();
    this.selectTimelineBoard(boardId);
    if (dateKey) {
      this.selectedDateKey.set(dateKey);
    }
    const allNotesInStore = Object.values(this.notesStore()).flat();
    const target = allNotesInStore.find((n) => n.id === noteId);
    if (target) {
      this.selectedDateKey.set(target.dateKey);
      this.inspectNote(target);
    }
  }

  openCrossLinkModal(note: CloudDayNote): void {
    this.crossLinkSourceNote.set(note);
  }

  closeCrossLinkModal(): void {
    this.crossLinkSourceNote.set(null);
  }

  getParallelBoardCandidateNotes(sourceNote: CloudDayNote): CloudDayNote[] {
    const srcBoardId = sourceNote.boardId || 'board-global-day';
    return Object.values(this.notesStore())
      .flat()
      .filter((n) => (n.boardId || 'board-global-day') !== srcBoardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  attachCandidateCrossLink(sourceNote: CloudDayNote, targetNote: CloudDayNote): void {
    const targetBoard = this.arena.getBoardById(targetNote.boardId || 'board-global-day');
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
      relationLabel: `Дочерний узел · ${targetBoard.title}`,
      sessionStatus: targetBoard.flowStatus === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
    };
    const updated = this.arena.attachCrossLinkToNote(sourceNote.id, crossRef);
    if (updated && this.inspectedNote()?.id === sourceNote.id) {
      this.inspectedNote.set(updated);
    }
    this.closeCrossLinkModal();
    this.sound.playWin();
  }

  private loadInitialVibe(): CloudDayVibeId {
    if (typeof window !== 'undefined') {
      try {
        const stored = readWithLegacyMigration(
          STORAGE_DAY_VIBE_KEY,
          LEGACY_SQUAD_DAY_VIBE_KEY,
          LEGACY_STORAGE_DAY_VIBE_KEY,
        ) as CloudDayVibeId;
        if (stored && CLOUD_DAY_VIBES.some((v) => v.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return 'CHRONO_DAYFLOW';
  }

  private getCurrentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours() || 13).padStart(2, '0');
    const m = String(now.getMinutes() || 45).padStart(2, '0');
    return `${h}:${m}`;
  }

  private loadInitialNotes(): Record<string, CloudDayNote[]> {
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
      } catch {
        // Local storage unreadable
      }
    }
    return {};
  }

  private persistNotes(store: Record<string, CloudDayNote[]>): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(store));
      } catch {
        // Storage quota or restriction
      }
    }
  }
}
