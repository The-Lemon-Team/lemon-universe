import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { getAccentPillClasses } from '../../components/neuron-arena/arena-ui.utils';
import {
  CLOUD_DAY_VIBES,
  CLOUD_HOUR_MILESTONES,
  CLOUD_LANDSCAPES,
  CELESTIAL_ORB_FULL_ARC_PATH,
  CelestialOrbState,
  CloudDayVibe,
  CloudDayVibeId,
  CloudLandscapeId,
  CloudLandscapeOption,
  CloudNowIndicatorMode,
  DEFAULT_CLOUD_LANDSCAPE_ID,
  TimelineCluster,
  getAccentStemClasses,
  getCelestialOrbState,
  getCloudLandscape,
  getCloudTypeEmoji,
  getCloudTypeLabel,
  getClusterPinClasses,
  getNoteBorderClass,
  getNoteStemHeight,
  getTimelinePercent,
  groupNotesIntoClusters,
  parseTimeToMinutes,
  resolveTimelineClickTime,
} from '../../components/neuron-arena/cloud-timeline.utils';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { HashtagTextComponent } from '../../core/components/hashtag-text.component';
import { TimePickerPopoverComponent } from '../../core/components/time-picker-popover.component';
import {
  ArenaActorCard,
  CloudDayNote,
  CloudItemType,
  NoteWeatherSnapshot,
  NoteWorldMomentSnapshot,
  TimelineBoard,
  TimelineNodeCrossRef,
} from '../../core/models/flow.models';
import { getExtraTagsNotInText, mergeNoteTags } from '../../core/utils/hashtag.utils';
import {
  HashtagCloudSatelliteState,
  LemonWatchersService,
  WatcherCategoryCode,
  WatcherMomentCard,
  WatcherTrendingHashtag,
  adaptHashtagCloudSatelliteState,
  getWatcherHashtagPillClasses,
  getWatcherHashtagWeightClasses,
  getWatcherImportanceBadgeClasses,
} from '../../core/watchers';
import {
  CelestialWeatherOrbState,
  SkyCanvasWeatherAtmosphere,
  WEATHER_CONDITIONS_CATALOG,
  WeatherConditionCode,
  WeatherLocation,
  WeatherService,
  adaptCelestialOrbForWeather,
  adaptSkyCanvasWeatherAtmosphere,
  formatTemperatureC,
} from '../../core/weather';

export type CloudScreenSize = 'standard' | 'large' | 'ultra';
export type CloudCardDensity = 'compact' | 'normal';

@Component({
  selector: 'app-timeline-cloud-view',
  standalone: true,
  imports: [
    ActorAvatarComponent,
    FormsModule,
    ModalOverlayDirective,
    HashtagMultiselectComponent,
    HashtagTextComponent,
    TimePickerPopoverComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-cloud-view.component.html',
  styleUrl: './timeline-cloud-view.component.css',
})
export class TimelineCloudViewComponent {
  private static readonly SCREEN_SIZE_STORAGE_KEY = 'lemon.timeline.cloudScreenSize';
  private static readonly CARD_DENSITY_STORAGE_KEY = 'lemon.timeline.cloudCardDensity';

  readonly screenSize = signal<CloudScreenSize>(this.loadScreenSizePreference());
  readonly cardDensity = signal<CloudCardDensity>(this.loadCardDensityPreference());
  readonly isFullscreen = signal<boolean>(false);
  readonly cloudRoot = viewChild<ElementRef<HTMLElement>>('cloudRoot');

  readonly rootScreenSizeClass = computed(() => {
    if (this.isFullscreen()) return '';
    return 'cloud-root-' + this.screenSize();
  });

  readonly skyScreenSizeClass = computed(() => {
    if (this.isFullscreen()) return 'cloud-sky-fullscreen';
    return 'cloud-sky-' + this.screenSize();
  });

  readonly cardDensityClass = computed(() => {
    return this.cardDensity() === 'compact' ? 'cloud-card-compact' : 'cloud-card-normal';
  });

  setScreenSize(size: CloudScreenSize): void {
    this.screenSize.set(size);
    try {
      localStorage.setItem(TimelineCloudViewComponent.SCREEN_SIZE_STORAGE_KEY, size);
    } catch {}
  }

  setCardDensity(density: CloudCardDensity): void {
    this.cardDensity.set(density);
    try {
      localStorage.setItem(TimelineCloudViewComponent.CARD_DENSITY_STORAGE_KEY, density);
    } catch {}
  }

  toggleCardDensity(): void {
    this.setCardDensity(this.cardDensity() === 'compact' ? 'normal' : 'compact');
  }

  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen(): void {
    this.isFullscreen.set(true);
    const rootEl = this.cloudRoot()?.nativeElement;
    if (rootEl && typeof document !== 'undefined') {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        rootEl.requestFullscreen?.().catch(() => {});
      }
    }
  }

  exitFullscreen(): void {
    this.isFullscreen.set(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (typeof document !== 'undefined') {
      const isDocFull = Boolean(document.fullscreenElement);
      if (!isDocFull && this.isFullscreen()) {
        this.isFullscreen.set(false);
      }
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (
      this.isWeatherModalOpen() ||
      this.isWorldPulseModalOpen() ||
      this.isAppearanceModalOpen() ||
      this.isVibePickerOpen() ||
      this.inspectedNote() ||
      this.draftTime()
    ) {
      return;
    }
    if (this.isFullscreen()) {
      this.exitFullscreen();
      event.stopPropagation();
    }
  }

  getCardStemHeight(index: number): number {
    const size = this.screenSize();
    const isCompact = this.cardDensity() === 'compact';
    const isFull = this.isFullscreen();

    if (isFull || size === 'ultra') {
      const step = isCompact ? 65 : 78;
      const base = isCompact ? 55 : 68;
      return (index % 6) * step + base;
    }
    if (size === 'large') {
      const step = isCompact ? 58 : 72;
      const base = isCompact ? 50 : 62;
      return (index % 5) * step + base;
    }
    const step = isCompact ? 50 : 64;
    const base = isCompact ? 46 : 58;
    return (index % 5) * step + base;
  }

  private loadScreenSizePreference(): CloudScreenSize {
    try {
      const saved = localStorage.getItem(TimelineCloudViewComponent.SCREEN_SIZE_STORAGE_KEY);
      if (saved === 'standard' || saved === 'large' || saved === 'ultra') {
        return saved;
      }
    } catch {}
    return 'large';
  }

  private loadCardDensityPreference(): CloudCardDensity {
    try {
      const saved = localStorage.getItem(TimelineCloudViewComponent.CARD_DENSITY_STORAGE_KEY);
      if (saved === 'compact' || saved === 'normal') {
        return saved;
      }
    } catch {}
    return 'compact';
  }

  readonly notes = input.required<CloudDayNote[]>();
  readonly board = input<TimelineBoard | null>(null);
  readonly selectedDateKey = input.required<string>();
  readonly showAllDates = input<boolean>(false);
  readonly canPost = input<boolean>(false);
  readonly activeTagFilter = input<string | null>(null);
  readonly hashtagOptions = input<HashtagSelectOption[]>([]);
  readonly defaultActor = input<ArenaActorCard | null>(null);
  readonly focusedNoteId = input<string | null>(null);

  readonly timeSelected = output<string>();
  readonly createNote = output<{
    time: string;
    type: CloudItemType;
    title?: string;
    text: string;
    tags?: string[];
    weather?: NoteWeatherSnapshot | null;
    worldMoment?: NoteWorldMomentSnapshot | null;
  }>();
  readonly deleteNote = output<string>();
  readonly editNote = output<{
    noteId: string;
    title?: string;
    text: string;
    tags?: string[];
    weather?: NoteWeatherSnapshot | null;
    worldMoment?: NoteWorldMomentSnapshot | null;
  }>();
  readonly crossLinkNote = output<CloudDayNote>();
  readonly jumpToCrossRef = output<TimelineNodeCrossRef>();
  readonly tagClick = output<string>();
  readonly noteInspected = output<CloudDayNote>();
  readonly noteInspectClosed = output<void>();
  readonly copyNoteLink = output<CloudDayNote>();

  protected readonly weatherService = inject(WeatherService);
  protected readonly watchersService = inject(LemonWatchersService);
  protected readonly weatherConditions = WEATHER_CONDITIONS_CATALOG;
  protected readonly formatTemperatureC = formatTemperatureC;
  protected readonly getWatcherHashtagPillClasses = getWatcherHashtagPillClasses;
  protected readonly getWatcherHashtagWeightClasses = getWatcherHashtagWeightClasses;
  protected readonly getWatcherImportanceBadgeClasses = getWatcherImportanceBadgeClasses;
  protected readonly hourMilestones = CLOUD_HOUR_MILESTONES;
  protected readonly vibes = CLOUD_DAY_VIBES;
  protected readonly landscapes = CLOUD_LANDSCAPES;
  protected readonly getTimelinePercent = getTimelinePercent;

  /**
   * Horizontal shift (%) for the bubble card near timeline edges so it isn't clipped.
   * Returns 0 for centered bubbles, positive near the left edge, negative near the right edge.
   */
  getBubbleShiftPercent(timeMinutes: number, edgeThreshold = 14, maxShift = 44): number {
    const percent = getTimelinePercent(timeMinutes);
    if (percent < edgeThreshold) {
      return Math.round(((edgeThreshold - percent) / edgeThreshold) * maxShift * 10) / 10;
    }
    if (percent > 100 - edgeThreshold) {
      return -Math.round(((percent - (100 - edgeThreshold)) / edgeThreshold) * maxShift * 10) / 10;
    }
    return 0;
  }
  protected readonly getNoteStemHeight = getNoteStemHeight;
  protected readonly getAccentStemClasses = getAccentStemClasses;
  protected readonly getClusterPinClasses = getClusterPinClasses;
  protected readonly getNoteBorderClass = getNoteBorderClass;
  protected readonly getCloudTypeEmoji = getCloudTypeEmoji;
  protected readonly getCloudTypeLabel = getCloudTypeLabel;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly selectedVibeId = signal<CloudDayVibeId>('CHRONO_DAYFLOW');
  readonly isVibePickerOpen = signal<boolean>(false);
  readonly isWeatherModalOpen = signal<boolean>(false);
  readonly isWorldPulseModalOpen = signal<boolean>(false);
  readonly locationSearchQuery = signal<string>('');
  readonly locationSearchResults = signal<WeatherLocation[]>(this.weatherService.presetLocations);
  readonly clusterActiveIndices = signal<Record<string, number>>({});
  readonly inspectedNote = signal<CloudDayNote | null>(null);
  readonly isEditingInspectedNote = signal<boolean>(false);
  editTitleDraft = '';
  readonly editTextDraft = signal<string>('');
  readonly editSelectedTags = signal<string[]>([]);
  readonly editWeatherDraft = signal<NoteWeatherSnapshot | null>(null);
  private editWeatherDirty = false;
  readonly editWorldMomentDraft = signal<NoteWorldMomentSnapshot | null>(null);
  private editWorldMomentDirty = false;
  readonly editPreviewTags = computed<string[]>(() =>
    mergeNoteTags(this.editTextDraft(), this.editSelectedTags()),
  );

  // Interactive click-to-create draft bubble state
  readonly hoverTimePreview = signal<{ time: string; leftPercent: number } | null>(null);
  readonly draftTime = signal<string | null>(null);
  readonly draftType = signal<CloudItemType>('thought');
  readonly draftTitle = signal<string>('');
  readonly draftText = signal<string>('');
  readonly draftSelectedTags = signal<string[]>([]);
  readonly draftWeather = signal<NoteWeatherSnapshot | null>(null);
  readonly draftWorldMoment = signal<NoteWorldMomentSnapshot | null>(null);
  readonly draftTimeMinutes = computed<number>(() => parseTimeToMinutes(this.draftTime()));
  readonly draftPreviewTags = computed<string[]>(() =>
    mergeNoteTags(this.draftText(), this.draftSelectedTags()),
  );
  readonly draftActorView = computed(() => {
    const actor = this.defaultActor();
    return {
      name: actor?.name || 'Новая запись',
      avatarIcon: actor?.avatarIcon || 'edit_note',
    };
  });
  protected readonly draftEntryTypes: Array<{ value: CloudItemType; emoji: string; label: string }> = [
    { value: 'thought', emoji: '💭', label: 'Мысль' },
    { value: 'proposal', emoji: '💡', label: 'Идея' },
    { value: 'action', emoji: '⚡', label: 'Экшен' },
  ];
  private readonly draftTextareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('draftTextarea');

  readonly currentVibe = computed<CloudDayVibe>(
    () => this.vibes.find((v) => v.id === this.selectedVibeId()) ?? this.vibes[0],
  );

  readonly clusters = computed<TimelineCluster[]>(() => groupNotesIntoClusters(this.notes()));

  readonly headerDateLabel = computed<string>(() => {
    if (this.showAllDates()) {
      return `Все даты (${this.board()?.title || 'TimeLine'})`;
    }
    return this.selectedDateKey();
  });

  readonly isTodaySelected = computed<boolean>(() => {
    if (this.showAllDates()) return true;
    const today = new Date().toISOString().slice(0, 10);
    return this.selectedDateKey() === today;
  });

  private readonly destroyRef = inject(DestroyRef);
  private lastFocusedNoteId: string | null = null;
  private static readonly NOW_MODE_STORAGE_KEY = 'lemon.timeline.nowIndicatorMode';
  private static readonly LANDSCAPE_STORAGE_KEY = 'lemon.timeline.cloudLandscape';
  private static readonly LANDSCAPE_LIGHTS_STORAGE_KEY = 'lemon.timeline.cloudLandscapeLights';
  private static readonly TIME_GRID_STORAGE_KEY = 'lemon.timeline.cloudTimeGrid';
  private static nextOrbUid = 0;

  protected readonly orbUid = ++TimelineCloudViewComponent.nextOrbUid;
  protected readonly orbMaskId = `celestial-orb-mask-${this.orbUid}`;
  protected readonly orbCoreGradId = `celestial-orb-core-${this.orbUid}`;
  protected readonly orbCloudGradId = `celestial-orb-cloud-${this.orbUid}`;
  protected readonly orbTrailGradId = `celestial-orb-trail-${this.orbUid}`;
  protected readonly landscapeBackGradId = `cloud-landscape-back-${this.orbUid}`;
  protected readonly landscapeMidGradId = `cloud-landscape-mid-${this.orbUid}`;
  protected readonly landscapeFrontGradId = `cloud-landscape-front-${this.orbUid}`;
  protected readonly landscapeStrokeGradId = `cloud-landscape-stroke-${this.orbUid}`;
  protected readonly celestialFullArcPath = CELESTIAL_ORB_FULL_ARC_PATH;

  readonly nowIndicatorMode = signal<CloudNowIndicatorMode>(this.loadNowIndicatorMode());
  readonly selectedLandscapeId = signal<CloudLandscapeId>(this.loadLandscapeId());
  readonly landscapeLightsEnabled = signal<boolean>(this.loadBooleanPreference(TimelineCloudViewComponent.LANDSCAPE_LIGHTS_STORAGE_KEY, true));
  readonly showTimeGrid = signal<boolean>(this.loadBooleanPreference(TimelineCloudViewComponent.TIME_GRID_STORAGE_KEY, true));
  readonly isAppearanceModalOpen = signal<boolean>(false);

  readonly currentLandscape = computed<CloudLandscapeOption>(() =>
    getCloudLandscape(this.selectedLandscapeId()),
  );
  readonly nowMinutes = signal<number>(this.getCurrentMinutes());

  readonly nowTimePercent = computed<number>(() => getTimelinePercent(this.nowMinutes()));

  readonly nowTimeText = computed<string>(() => {
    const mins = this.nowMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  readonly celestialOrb = computed<CelestialOrbState>(() => getCelestialOrbState(this.nowMinutes()));

  readonly celestialWeatherOrb = computed<CelestialWeatherOrbState>(() =>
    adaptCelestialOrbForWeather(
      this.celestialOrb(),
      this.weatherService.currentReading(),
      this.weatherService.selectedLocation().name,
    ),
  );

  readonly skyWeatherAtmosphere = computed<SkyCanvasWeatherAtmosphere>(() =>
    adaptSkyCanvasWeatherAtmosphere(this.weatherService.currentReading().condition),
  );

  readonly hashtagCloudSatellite = computed<HashtagCloudSatelliteState>(() =>
    adaptHashtagCloudSatelliteState(
      this.celestialOrb(),
      this.watchersService.feedSnapshot(),
      this.watchersService.activeMoment(),
    ),
  );

  readonly orbDayProgressPercent = computed<number>(() => Math.round(this.celestialOrb().progress * 100));

  constructor() {
    effect(
      () => {
        const vibeId = this.board()?.vibeId as CloudDayVibeId | undefined;
        if (vibeId && this.vibes.some((v) => v.id === vibeId)) {
          this.selectedVibeId.set(vibeId);
        }
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const textarea = this.draftTextareaRef();
      if (textarea) {
        queueMicrotask(() => textarea.nativeElement.focus());
      }
    });

    effect(
      () => {
        this.board()?.id;
        this.selectedDateKey();
        const postAllowed = this.canPost();
        if (!postAllowed || untracked(() => this.draftTime() !== null)) {
          this.cancelDraftNote();
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const focusId = this.focusedNoteId();
        const currentNotes = this.notes();
        if (!focusId) {
          if (this.lastFocusedNoteId !== null) {
            this.lastFocusedNoteId = null;
            this.cancelEditInspectedNote();
            this.inspectedNote.set(null);
          }
          return;
        }

        const targetNote = currentNotes.find((n) => n.id === focusId);
        if (!targetNote) return;

        const targetCluster = untracked(() => this.clusters()).find((c) =>
          c.notes.some((n) => n.id === focusId),
        );
        if (targetCluster) {
          const idx = targetCluster.notes.findIndex((n) => n.id === focusId);
          if (idx >= 0) {
            untracked(() => {
              this.clusterActiveIndices.update((map) => ({ ...map, [targetCluster.id]: idx }));
            });
          }
        }

        if (this.lastFocusedNoteId !== focusId) {
          this.lastFocusedNoteId = focusId;
          if (untracked(() => this.inspectedNote()?.id) !== targetNote.id) {
            this.cancelEditInspectedNote();
            this.inspectedNote.set(targetNote);
          }
        }
      },
      { allowSignalWrites: true },
    );

    const timer = setInterval(() => {
      this.nowMinutes.set(this.getCurrentMinutes());
    }, 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  setNowIndicatorMode(mode: CloudNowIndicatorMode): void {
    this.nowIndicatorMode.set(mode);
    try {
      localStorage.setItem(TimelineCloudViewComponent.NOW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  private loadNowIndicatorMode(): CloudNowIndicatorMode {
    try {
      const saved = localStorage.getItem(TimelineCloudViewComponent.NOW_MODE_STORAGE_KEY);
      if (saved === 'beam' || saved === 'orb') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'orb';
  }

  private getCurrentMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  selectVibe(id: CloudDayVibeId): void {
    this.selectedVibeId.set(id);
    this.isVibePickerOpen.set(false);
  }

  openAppearanceModal(): void {
    this.isAppearanceModalOpen.set(true);
  }

  closeAppearanceModal(): void {
    this.isAppearanceModalOpen.set(false);
  }

  selectLandscape(id: CloudLandscapeId): void {
    this.selectedLandscapeId.set(id);
    try {
      localStorage.setItem(TimelineCloudViewComponent.LANDSCAPE_STORAGE_KEY, id);
    } catch {
      // Ignore storage errors
    }
  }

  toggleLandscapeLights(): void {
    const next = !this.landscapeLightsEnabled();
    this.landscapeLightsEnabled.set(next);
    try {
      localStorage.setItem(TimelineCloudViewComponent.LANDSCAPE_LIGHTS_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage errors
    }
  }

  toggleTimeGrid(): void {
    const next = !this.showTimeGrid();
    this.showTimeGrid.set(next);
    try {
      localStorage.setItem(TimelineCloudViewComponent.TIME_GRID_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage errors
    }
  }

  resetCloudAppearance(): void {
    this.selectLandscape(DEFAULT_CLOUD_LANDSCAPE_ID);
    this.landscapeLightsEnabled.set(true);
    this.showTimeGrid.set(true);
    try {
      localStorage.setItem(TimelineCloudViewComponent.LANDSCAPE_LIGHTS_STORAGE_KEY, 'true');
      localStorage.setItem(TimelineCloudViewComponent.TIME_GRID_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  }

  private loadLandscapeId(): CloudLandscapeId {
    try {
      const saved = localStorage.getItem(TimelineCloudViewComponent.LANDSCAPE_STORAGE_KEY);
      if (saved && this.landscapes.some((l) => l.id === saved)) {
        return saved as CloudLandscapeId;
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_CLOUD_LANDSCAPE_ID;
  }

  private loadBooleanPreference(key: string, fallback: boolean): boolean {
    try {
      const saved = localStorage.getItem(key);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {
      // Ignore storage errors
    }
    return fallback;
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
    event?.stopPropagation();
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: index }));
  }

  prevClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const prev = (current - 1 + total) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: prev }));
  }

  nextClusterNote(clusterId: string, total: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.getClusterActiveIndex(clusterId);
    const next = (current + 1) % total;
    this.clusterActiveIndices.update((map) => ({ ...map, [clusterId]: next }));
  }

  onSkyMouseMove(event: MouseEvent): void {
    const rawTarget = event.target as HTMLElement | null;
    if (rawTarget?.closest('[data-cloud-interactive="true"]')) {
      this.hoverTimePreview.set(null);
      return;
    }
    this.updateHoverPreview(event.clientX, event.currentTarget as HTMLElement | null);
  }

  onTimelineRoadMouseMove(event: MouseEvent): void {
    event.stopPropagation();
    this.updateHoverPreview(event.clientX, event.currentTarget as HTMLElement | null);
  }

  private updateHoverPreview(clientX: number, container: HTMLElement | null): void {
    if (!this.canPost() || this.draftTime() !== null || !container) {
      this.hoverTimePreview.set(null);
      return;
    }
    const resolved = resolveTimelineClickTime(clientX, container.getBoundingClientRect());
    if (!resolved) {
      this.hoverTimePreview.set(null);
      return;
    }
    this.hoverTimePreview.set({
      time: resolved.time,
      leftPercent: getTimelinePercent(resolved.timeMinutes),
    });
  }

  onSkyCanvasClick(event: MouseEvent): void {
    const rawTarget = event.target as HTMLElement | null;
    if (rawTarget?.closest('[data-cloud-interactive="true"]')) return;
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return;
    const resolved = resolveTimelineClickTime(event.clientX, container.getBoundingClientRect());
    if (!resolved) return;
    this.startOrMoveDraftAt(resolved.time);
  }

  onTimelineRoadClick(event: MouseEvent): void {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const resolved = resolveTimelineClickTime(event.clientX, target.getBoundingClientRect());
    if (!resolved) return;
    this.startOrMoveDraftAt(resolved.time);
  }

  private startOrMoveDraftAt(formattedTime: string): void {
    this.timeSelected.emit(formattedTime);
    if (!this.canPost()) return;
    this.hoverTimePreview.set(null);
    this.closeInspectModal();
    if (this.draftTime() !== null) {
      this.draftTime.set(formattedTime);
      return;
    }
    this.draftType.set('thought');
    this.draftTitle.set('');
    this.draftText.set('');
    this.draftSelectedTags.set([]);
    this.draftWeather.set(null);
    this.draftWorldMoment.set(null);
    this.draftTime.set(formattedTime);
  }

  cancelDraftNote(): void {
    this.draftTime.set(null);
    this.draftType.set('thought');
    this.draftTitle.set('');
    this.draftText.set('');
    this.draftSelectedTags.set([]);
    this.draftWeather.set(null);
    this.draftWorldMoment.set(null);
  }

  captureWeatherForDraft(): void {
    this.draftWeather.set(this.weatherService.captureSnapshot(this.draftTimeMinutes()));
  }

  clearDraftWeather(): void {
    this.draftWeather.set(null);
  }

  captureWorldMomentForDraft(): void {
    this.draftWorldMoment.set(this.watchersService.captureActiveMomentSnapshot());
  }

  clearDraftWorldMoment(): void {
    this.draftWorldMoment.set(null);
  }

  saveDraftNote(): void {
    const time = this.draftTime();
    const text = this.draftText().trim();
    if (!time || !text || !this.canPost()) return;
    const title = this.draftTitle().trim() || undefined;
    const tags = mergeNoteTags(text, this.draftSelectedTags());
    const weather = this.draftWeather();
    const worldMoment = this.draftWorldMoment();
    this.createNote.emit({
      time,
      type: this.draftType(),
      title,
      text,
      tags,
      ...(weather ? { weather } : {}),
      ...(worldMoment ? { worldMoment } : {}),
    });
    this.cancelDraftNote();
  }

  onDraftKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelDraftNote();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveDraftNote();
    }
  }

  onDraftEscape(event: Event): void {
    event.stopPropagation();
    this.cancelDraftNote();
  }

  openInspectModal(note: CloudDayNote, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.draftTime() !== null && !this.draftText().trim() && !this.draftTitle().trim()) {
      this.cancelDraftNote();
    }
    this.cancelEditInspectedNote();
    this.inspectedNote.set(note);
    this.noteInspected.emit(note);
  }

  closeInspectModal(): void {
    const wasOpen = this.inspectedNote() !== null;
    this.cancelEditInspectedNote();
    this.inspectedNote.set(null);
    if (wasOpen) {
      this.noteInspectClosed.emit();
    }
  }

  startEditInspectedNote(note: CloudDayNote): void {
    this.editTitleDraft = note.title || '';
    this.editTextDraft.set(note.text || '');
    this.editSelectedTags.set(getExtraTagsNotInText(note.text || '', note.tags));
    this.editWeatherDraft.set(note.weather ?? null);
    this.editWeatherDirty = false;
    this.editWorldMomentDraft.set(note.worldMoment ?? null);
    this.editWorldMomentDirty = false;
    this.isEditingInspectedNote.set(true);
  }

  cancelEditInspectedNote(): void {
    this.isEditingInspectedNote.set(false);
    this.editTitleDraft = '';
    this.editTextDraft.set('');
    this.editSelectedTags.set([]);
    this.editWeatherDraft.set(null);
    this.editWeatherDirty = false;
    this.editWorldMomentDraft.set(null);
    this.editWorldMomentDirty = false;
  }

  captureWeatherForEdit(): void {
    const note = this.inspectedNote();
    const snapshot = this.weatherService.captureSnapshot(note?.timeMinutes);
    this.editWeatherDraft.set(snapshot);
    this.editWeatherDirty = true;
  }

  clearEditWeather(): void {
    this.editWeatherDraft.set(null);
    this.editWeatherDirty = true;
  }

  captureWorldMomentForEdit(): void {
    const snapshot = this.watchersService.captureActiveMomentSnapshot();
    this.editWorldMomentDraft.set(snapshot);
    this.editWorldMomentDirty = true;
  }

  clearEditWorldMoment(): void {
    this.editWorldMomentDraft.set(null);
    this.editWorldMomentDirty = true;
  }

  stampWeatherOnInspectedNote(note: CloudDayNote): void {
    if (!this.canPost()) return;
    const snapshot = this.weatherService.captureSnapshot(note.timeMinutes);
    const mergedTags = mergeNoteTags(note.text || '', note.tags);
    this.editNote.emit({
      noteId: note.id,
      title: note.title,
      text: note.text,
      tags: mergedTags,
      weather: snapshot,
    });
    this.inspectedNote.set({
      ...note,
      weather: snapshot,
    });
  }

  stampWorldMomentOnInspectedNote(note: CloudDayNote): void {
    if (!this.canPost()) return;
    const snapshot = this.watchersService.captureActiveMomentSnapshot();
    const mergedTags = mergeNoteTags(note.text || '', note.tags);
    this.editNote.emit({
      noteId: note.id,
      title: note.title,
      text: note.text,
      tags: mergedTags,
      worldMoment: snapshot,
    });
    this.inspectedNote.set({
      ...note,
      worldMoment: snapshot,
    });
  }

  saveEditedInspectedNote(note: CloudDayNote): void {
    const nextText = this.editTextDraft().trim();
    if (!nextText) return;
    const nextTitle = this.editTitleDraft.trim() || undefined;
    const mergedTags = mergeNoteTags(nextText, this.editSelectedTags());
    const nextWeather = this.editWeatherDraft();
    const nextWorldMoment = this.editWorldMomentDraft();
    this.editNote.emit({
      noteId: note.id,
      title: nextTitle,
      text: nextText,
      tags: mergedTags,
      ...(this.editWeatherDirty ? { weather: nextWeather } : {}),
      ...(this.editWorldMomentDirty ? { worldMoment: nextWorldMoment } : {}),
    });
    this.inspectedNote.set({
      ...note,
      title: nextTitle,
      text: nextText,
      tags: mergedTags,
      ...(this.editWeatherDirty ? { weather: nextWeather } : {}),
      ...(this.editWorldMomentDirty ? { worldMoment: nextWorldMoment } : {}),
    });
    this.cancelEditInspectedNote();
  }

  onOrbClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openWeatherModal();
  }

  openWeatherModal(): void {
    this.locationSearchQuery.set('');
    this.locationSearchResults.set(this.weatherService.presetLocations);
    this.isWeatherModalOpen.set(true);
  }

  closeWeatherModal(): void {
    this.isWeatherModalOpen.set(false);
    this.locationSearchQuery.set('');
    this.locationSearchResults.set(this.weatherService.presetLocations);
  }

  onLocationSearchChange(query: string): void {
    this.locationSearchQuery.set(query);
    void this.weatherService.searchLocations(query).then((results) => {
      this.locationSearchResults.set(results);
    });
  }

  triggerLocationSearch(): void {
    void this.weatherService.searchLocations(this.locationSearchQuery()).then((results) => {
      this.locationSearchResults.set(results);
    });
  }

  selectWeatherLocation(location: WeatherLocation): void {
    void this.weatherService.selectLocation(location);
  }

  refreshLiveWeather(): void {
    void this.weatherService.refreshWeather();
  }

  selectConditionOverride(condition: WeatherConditionCode | null): void {
    this.weatherService.setConditionOverride(condition);
  }

  toggleSkyWeatherAnimations(): void {
    this.weatherService.setSkyAnimationsEnabled(!this.weatherService.skyAnimationsEnabled());
  }

  startDraftWithCurrentWeather(): void {
    this.closeWeatherModal();
    if (!this.canPost()) return;
    const currentMins = Math.max(480, Math.min(23 * 60 + 45, Math.round(this.nowMinutes() / 15) * 15));
    const h = Math.floor(currentMins / 60);
    const m = currentMins % 60;
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.startOrMoveDraftAt(formatted);
    this.draftWeather.set(this.weatherService.captureSnapshot(currentMins));
  }

  onHashtagSatelliteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openWorldPulseModal();
  }

  onSatelliteHashtagClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    this.watchersService.selectedCategory.set('all');
    this.watchersService.selectedHashtag.set(tag);
    this.isWorldPulseModalOpen.set(true);
  }

  openWorldPulseModal(): void {
    this.isWorldPulseModalOpen.set(true);
  }

  closeWorldPulseModal(): void {
    this.isWorldPulseModalOpen.set(false);
    this.watchersService.selectedCategory.set('all');
    this.watchersService.selectedHashtag.set(null);
  }

  refreshWorldPulse(): void {
    void this.watchersService.refreshWorldPulse(this.selectedDateKey());
  }

  selectWatcherCategory(category: WatcherCategoryCode): void {
    this.watchersService.selectCategory(category);
  }

  selectWatcherHashtag(tag: string | null): void {
    this.watchersService.toggleHashtag(tag);
  }

  pinMomentToSatellite(momentId: string): void {
    this.watchersService.setActiveMoment(momentId);
  }

  toggleHashtagSatellite(): void {
    this.watchersService.setSatelliteEnabled(!this.watchersService.satelliteEnabled());
  }

  private ensureDraftOpenAtCurrentTime(): void {
    if (this.draftTime() !== null) return;
    const currentMins = Math.max(480, Math.min(23 * 60 + 45, Math.round(this.nowMinutes() / 15) * 15));
    const h = Math.floor(currentMins / 60);
    const m = currentMins % 60;
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.startOrMoveDraftAt(formatted);
  }

  startDraftWithWorldMomentCard(card: WatcherMomentCard): void {
    const snapshot = this.watchersService.captureCardSnapshot(card);
    this.closeWorldPulseModal();
    if (!this.canPost()) return;
    this.ensureDraftOpenAtCurrentTime();
    this.draftWorldMoment.set(snapshot);
    this.draftSelectedTags.update((existing) =>
      Array.from(new Set([...existing, ...snapshot.hashtags])),
    );
  }

  startDraftWithWorldHashtag(hashtag: WatcherTrendingHashtag): void {
    const snapshot = this.watchersService.captureHashtagSnapshot(hashtag);
    this.closeWorldPulseModal();
    if (!this.canPost()) return;
    this.ensureDraftOpenAtCurrentTime();
    this.draftWorldMoment.set(snapshot);
    this.draftSelectedTags.update((existing) =>
      Array.from(new Set([...existing, ...snapshot.hashtags])),
    );
  }

  startDraftWithActiveWorldMoment(): void {
    this.startDraftWithWorldMomentCard(this.watchersService.activeMoment());
  }

  getDisplayTags(note: CloudDayNote): string[] {
    return mergeNoteTags(note.text || '', note.tags);
  }

  onTagChipClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    this.tagClick.emit(tag);
  }

  onModalTagClick(tag: string): void {
    this.closeInspectModal();
    this.tagClick.emit(tag);
  }

  getInspectedNoteCluster(): TimelineCluster | null {
    const note = this.inspectedNote();
    if (!note) return null;
    return this.clusters().find((c) => c.isCluster && c.notes.some((n) => n.id === note.id)) ?? null;
  }

  getInspectedClusterIndex(cluster: TimelineCluster): number {
    const note = this.inspectedNote();
    if (!note) return 0;
    const idx = cluster.notes.findIndex((n) => n.id === note.id);
    return idx >= 0 ? idx : 0;
  }

  stepInspectedCluster(cluster: TimelineCluster, delta: number): void {
    this.cancelEditInspectedNote();
    const current = this.getInspectedClusterIndex(cluster);
    const nextIdx = (current + delta + cluster.notes.length) % cluster.notes.length;
    this.inspectedNote.set(cluster.notes[nextIdx]);
  }

  onDeleteNoteClick(noteId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNote.emit(noteId);
  }

  triggerDeleteFromModal(noteId: string): void {
    this.closeInspectModal();
    this.deleteNote.emit(noteId);
  }

  triggerCrossLinkFromModal(note: CloudDayNote): void {
    this.closeInspectModal();
    this.crossLinkNote.emit(note);
  }

  onCrossRefClick(cref: TimelineNodeCrossRef, event: MouseEvent): void {
    event.stopPropagation();
    this.jumpToCrossRef.emit(cref);
  }

  getNotesWord(count: number): string {
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'сообщений';
    const mod10 = count % 10;
    if (mod10 === 1) return 'сообщение';
    if (mod10 >= 2 && mod10 <= 4) return 'сообщения';
    return 'сообщений';
  }
}
