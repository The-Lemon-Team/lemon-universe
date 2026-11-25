import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { getAccentPillClasses } from '../../components/neuron-arena/arena-ui.utils';
import {
  CloudSelectOption,
  CloudThemedSelectComponent,
} from '../../components/neuron-arena/cloud-themed-select.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { HashtagTextComponent } from '../../core/components/hashtag-text.component';
import { TimePickerPopoverComponent } from '../../core/components/time-picker-popover.component';
import {
  appendHashtagToText,
  applyHashtagAutocomplete,
  collectHashtagCounts,
  getExtraTagsNotInText,
  getTrailingHashtagPrefix,
  mergeNoteTags,
  noteHasTag,
} from '../../core/utils/hashtag.utils';
import {
  ArenaActorCard,
  BoardMemberRole,
  BoardPrivacy,
  CloudDayNote,
  CloudItemType,
  NoteWeatherSnapshot,
  NoteWorldMomentSnapshot,
  Profile,
  SeasonsPersonalFeedEntry,
  TimelineBoard,
  TimelineBoardMode,
  TimelineMediaAttachment,
  TimelineNodeCrossRef,
} from '../../core/models/flow.models';
import { ProfileService } from '../../core/services/profile.service';
import { SeasonsTimelineBridgeService } from '../../core/services/seasons-timeline-bridge.service';
import { LemonWatchersService } from '../../core/watchers';
import { WeatherService, formatTemperatureC } from '../../core/weather';
import { TimelinesService } from '../services/timelines.service';
import {
  buildTimelineNoteCommands,
  buildTimelineNoteUrl,
  copyTextToClipboard,
  planFilterClearForNote,
  resolveNoteDeepLink,
} from '../utils/timeline-note-routing.utils';
import {
  CreateBoardSubmitPayload,
  EditBoardSubmitPayload,
  TimelineBoardModalComponent,
} from './timeline-board-modal.component';
import { TimelineMembersModalComponent } from './timeline-members-modal.component';
import { TimelineProjectariumModalComponent } from './timeline-projectarium-modal.component';
import { TimelineCrossLinkModalComponent } from './timeline-crosslink-modal.component';
import {
  AgentSummarySubmitPayload,
  TimelineAgentSummaryModalComponent,
} from './timeline-agent-summary-modal.component';
import { TimelineCloudViewComponent } from './timeline-cloud-view.component';
import { TimelineSeasonsModalComponent } from './timeline-seasons-modal.component';
import { BoardFilterTab, TimelineBoardNavComponent } from './timeline-board-nav.component';

type TimelineViewMode = 'CLOUD_TIMELINE' | 'DIARY_FEED' | 'VISUAL_TIMELINE';

@Component({
  selector: 'app-timelines-workspace',
  standalone: true,
  imports: [
    FormsModule,
    ActorAvatarComponent,
    CloudThemedSelectComponent,
    ModalOverlayDirective,
    TimelineBoardModalComponent,
    TimelineMembersModalComponent,
    TimelineProjectariumModalComponent,
    TimelineCrossLinkModalComponent,
    TimelineAgentSummaryModalComponent,
    TimelineCloudViewComponent,
    TimelineSeasonsModalComponent,
    TimelineBoardNavComponent,
    HashtagMultiselectComponent,
    HashtagTextComponent,
    TimePickerPopoverComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timelines-workspace.component.html'
})
export class TimelinesWorkspaceComponent {
  protected readonly timelines = inject(TimelinesService);
  protected readonly profileService = inject(ProfileService);
  protected readonly seasonsBridge = inject(SeasonsTimelineBridgeService);
  protected readonly weatherService = inject(WeatherService);
  protected readonly watchersService = inject(LemonWatchersService);
  protected readonly formatTemperatureC = formatTemperatureC;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly boardFilterTabs: Array<{ id: BoardFilterTab; label: string }> = [
    { id: 'ALL', label: 'Все доступные' },
    { id: 'TOWERS', label: '🏛️ Эмитент и Башни' },
    { id: 'DIARY', label: '📓 Дневники' },
    { id: 'AGENT_SUMMARY', label: '🤖 Сводки Агентов' },
    { id: 'PRIVATE', label: '🔒 Приватные' },
    { id: 'PUBLIC', label: '🌐 Публичные' },
  ];

  readonly entryTypes: Array<{ value: CloudItemType; label: string; emoji: string }> = [
    { value: 'thought', label: 'Запись / Мысль', emoji: '💭' },
    { value: 'proposal', label: 'Событие / Идея', emoji: '💡' },
    { value: 'action', label: 'Итог / Экшен', emoji: '⚡' },
  ];

  readonly visibleBoards = signal<TimelineBoard[]>([]);
  readonly activeBoard = signal<TimelineBoard | null>(null);
  readonly allNotes = signal<CloudDayNote[]>([]);
  readonly allActors = signal<ArenaActorCard[]>([]);
  readonly allProfiles = signal<Profile[]>([]);
  readonly activeProfile = signal<Profile | null>(null);
  readonly personalFeedEntries = signal<SeasonsPersonalFeedEntry[]>([]);
  readonly remoteFeedNotes = signal<any[]>([]);
  readonly remoteFeedAccount = signal<string | null>(null);
  readonly seasonsStreamInfo = signal<any | null>(null);
  readonly isEnsuringSeasonsStream = signal<boolean>(false);
  readonly statusMessage = signal<string | null>(null);
  readonly routeBoardSlug = signal<string | null>(null);
  readonly routeNoteId = signal<string | null>(null);
  readonly highlightedNoteId = signal<string | null>(null);
  readonly boardsLoaded = signal<boolean>(false);
  readonly notesLoaded = signal<boolean>(false);
  private lastMissingLookupKey: string | null = null;
  private lastScrolledNoteKey: string | null = null;

  readonly boardFilter = signal<BoardFilterTab>('ALL');
  readonly boardSearchQuery = signal<string>('');
  readonly selectedBoardHashtag = signal<string | null>(null);
  readonly viewMode = signal<TimelineViewMode>('CLOUD_TIMELINE');
  readonly selectedDateKey = signal<string>(new Date().toISOString().slice(0, 10));
  readonly showAllDates = signal<boolean>(false);
  readonly composerExpanded = signal<boolean>(false);
  readonly isTodaySelected = computed(
    () => !this.showAllDates() && this.selectedDateKey() === new Date().toISOString().slice(0, 10),
  );
  readonly selectedActorFilter = signal<string | null>(null);
  readonly selectedTagFilter = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  // Composer & Inline Edit state
  readonly selectedComposerActorId = signal<string>('actor-alexey');
  readonly composerType = signal<CloudItemType>('thought');
  composerTitle = '';
  readonly composerText = signal<string>('');
  readonly composerTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('composerTextarea');

  private readonly composerResizeEffect = effect(() => {
    this.composerText();
    const el = this.composerTextarea()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  });
  readonly composerSelectedTags = signal<string[]>([]);
  readonly composerTime = signal<string>(this.getCurrentLocalTimeString());
  readonly composerWeather = signal<NoteWeatherSnapshot | null>(null);
  readonly composerWorldMoment = signal<NoteWorldMomentSnapshot | null>(null);
  composerShareWithGroup = false;
  readonly pendingMedia = signal<TimelineMediaAttachment[]>([]);
  readonly isUploadingMedia = signal<boolean>(false);
  readonly editingNoteId = signal<string | null>(null);
  editTitleDraft = '';
  readonly editTextDraft = signal<string>('');
  readonly editSelectedTags = signal<string[]>([]);

  readonly editPreviewTags = computed<string[]>(() =>
    mergeNoteTags(this.editTextDraft(), this.editSelectedTags()),
  );

  // Modals state
  readonly isCreateBoardOpen = signal<boolean>(false);
  readonly editingBoard = signal<TimelineBoard | null>(null);
  readonly isMembersModalOpen = signal<boolean>(false);
  readonly isProjectariumModalOpen = signal<boolean>(false);
  readonly crossLinkSourceNote = signal<CloudDayNote | null>(null);
  readonly isAgentSummaryOpen = signal<boolean>(false);
  readonly agentSummaryError = signal<string | null>(null);
  readonly isPersonalFeedModalOpen = signal<boolean>(false);

  readonly allBoardHashtags = computed(() =>
    collectHashtagCounts(
      this.visibleBoards().map((b) => ({ text: b.description || '', tags: b.hashtags || [] })),
    ),
  );

  readonly boardNoteCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const n of this.allNotes()) {
      const id = n.boardId || 'board-global-day';
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  });

  readonly filteredBoards = computed<TimelineBoard[]>(() => {
    const f = this.boardFilter();
    const tagFilter = this.selectedBoardHashtag();
    const q = this.boardSearchQuery().trim().toLowerCase();
    let list = this.visibleBoards();
    if (f === 'TOWERS') {
      list = list.filter(
        (b) =>
          b.id === 'board-lemon-space' ||
          b.slug === 'lemon-space' ||
          b.id.startsWith('board-tower-') ||
          b.slug.startsWith('tower-'),
      );
    } else if (f === 'DIARY') list = list.filter((b) => b.boardMode === 'DIARY');
    else if (f === 'AGENT_SUMMARY') list = list.filter((b) => b.boardMode === 'AGENT_SUMMARY');
    else if (f === 'PRIVATE') list = list.filter((b) => b.privacy === 'PRIVATE');
    else if (f === 'PUBLIC') list = list.filter((b) => b.privacy === 'PUBLIC');

    if (tagFilter) {
      list = list.filter((b) =>
        noteHasTag({ text: b.description || '', tags: b.hashtags || [] }, tagFilter),
      );
    }

    if (q) {
      list = list.filter((b) => {
        const hashtags = (b.hashtags || []).join(' ');
        return `${b.title} ${b.slug} ${b.description || ''} ${hashtags}`.toLowerCase().includes(q);
      });
    }
    return list;
  });

  readonly boardAllNotes = computed<CloudDayNote[]>(() => {
    const board = this.activeBoard();
    if (!board) return [];
    return this.allNotes().filter((n) => (n.boardId || 'board-global-day') === board.id);
  });

  readonly boardHashtagCounts = computed(() => collectHashtagCounts(this.boardAllNotes()));

  readonly composerHashtagOptions = computed<HashtagSelectOption[]>(() => {
    const existing = this.boardHashtagCounts();
    const map = new Map<string, number>();
    for (const item of existing) {
      map.set(item.tag, item.count);
    }
    for (const def of ['идея', 'важно', 'дневник', 'релиз']) {
      if (!map.has(def)) map.set(def, 0);
    }
    return Array.from(map.entries()).map(([tag, count]) => ({
      tag,
      count: count > 0 ? count : undefined,
    }));
  });

  readonly composerPreviewTags = computed<string[]>(() =>
    mergeNoteTags(this.composerText(), this.composerSelectedTags()),
  );

  readonly quickComposerHashtags = computed<string[]>(() => {
    const existing = this.boardHashtagCounts().map((item) => item.tag);
    const defaults = ['идея', 'важно', 'дневник', 'релиз'];
    return Array.from(new Set([...existing, ...defaults])).slice(0, 6);
  });

  readonly composerAutocompleteTags = computed<string[]>(() => {
    const prefix = getTrailingHashtagPrefix(this.composerText());
    if (prefix === null) return [];
    const pool = Array.from(
      new Set([...this.boardHashtagCounts().map((i) => i.tag), 'идея', 'важно', 'дневник', 'релиз']),
    );
    return pool.filter((tag) => !prefix || tag.startsWith(prefix)).slice(0, 6);
  });

  readonly visibleNotes = computed<CloudDayNote[]>(() => {
    let list = this.boardAllNotes();
    if (!this.showAllDates()) {
      const dk = this.selectedDateKey();
      list = list.filter((n) => n.dateKey === dk);
    }
    const actorFilter = this.selectedActorFilter();
    if (actorFilter) {
      list = list.filter((n) => n.actorId === actorFilter || n.subActorId === actorFilter);
    }
    const tagFilter = this.selectedTagFilter();
    if (tagFilter) {
      list = list.filter((n) => noteHasTag(n, tagFilter));
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      const tagNeedle = q.replace(/^#+/, '');
      list = list.filter(
        (n) =>
          n.text.toLowerCase().includes(q) ||
          (n.title || '').toLowerCase().includes(q) ||
          n.actorName.toLowerCase().includes(q) ||
          mergeNoteTags(n.text, n.tags).some((t) => t.includes(tagNeedle)),
      );
    }
    return [...list].sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      return b.timeMinutes - a.timeMinutes;
    });
  });

  readonly composerActorOptions = computed<CloudSelectOption<string>[]>(() =>
    this.allActors().map((a) => ({
      value: a.id,
      label: a.name,
      subtitle: a.title,
      avatarIcon: a.avatarIcon,
    })),
  );

  readonly actorFilterOptions = computed<CloudSelectOption<string | null>[]>(() => [
    { value: null, label: 'Все персонажи', materialIcon: 'groups' },
    ...this.allActors().map((a) => ({
      value: a.id,
      label: a.name,
      subtitle: a.title,
      avatarIcon: a.avatarIcon,
    })),
  ]);

  readonly activeComposerActor = computed<ArenaActorCard | null>(() => {
    const id = this.selectedComposerActorId();
    return this.allActors().find((a) => a.id === id) ?? this.allActors()[0] ?? null;
  });

  readonly canPostToActiveBoard = computed<boolean>(() => {
    const b = this.activeBoard();
    this.activeProfile();
    return b ? this.timelines.canPost(b) : false;
  });

  readonly canManageActiveBoard = computed<boolean>(() => {
    const b = this.activeBoard();
    this.activeProfile();
    return b ? this.timelines.canManageMembers(b) : false;
  });

  readonly pinnedSidebarOpen = signal(false);

  readonly pinnedBoardNotes = computed<CloudDayNote[]>(() => {
    const b = this.activeBoard();
    if (!b) return [];
    return this.allNotes()
      .filter((n) => n.boardId === b.id && Boolean(n.isPinned))
      .sort((a, bNote) => {
        const aTime = a.pinnedAt || a.createdAt || `${a.dateKey}T${a.time}`;
        const bTime = bNote.pinnedAt || bNote.createdAt || `${bNote.dateKey}T${bNote.time}`;
        return bTime.localeCompare(aTime);
      });
  });

  jumpToPinnedNote(note: CloudDayNote): void {
    this.pinnedSidebarOpen.set(false);
    this.navigateToNote(note);
  }

  navigateToNote(note: CloudDayNote): void {
    this.selectedDateKey.set(note.dateKey);
    this.showAllDates.set(false);
    this.highlightedNoteId.set(note.id);
    const board =
      this.visibleBoards().find((b) => b.id === (note.boardId || 'board-global-day')) ??
      this.activeBoard();
    const commands = board
      ? buildTimelineNoteCommands(board.slug, note.id)
      : ['/timelines', 'notes', note.id];
    void this.router.navigate(commands).catch(() => {});
  }

  copyNoteDeepLink(note: CloudDayNote): void {
    const board =
      this.visibleBoards().find((b) => b.id === (note.boardId || 'board-global-day')) ??
      this.activeBoard();
    const url = buildTimelineNoteUrl(board?.slug, note.id);
    void copyTextToClipboard(url).then((copied) => {
      this.timelines.setStatus(
        copied ? 'Ссылка на сообщение скопирована в буфер обмена.' : `Ссылка на сообщение: ${url}`,
      );
    });
  }

  onCloudNoteInspected(note: CloudDayNote): void {
    const board = this.activeBoard();
    if (!board || this.routeNoteId() === note.id) return;
    this.highlightedNoteId.set(note.id);
    void this.router.navigate(buildTimelineNoteCommands(board.slug, note.id)).catch(() => {});
  }

  onCloudNoteInspectClosed(): void {
    this.highlightedNoteId.set(null);
    const board = this.activeBoard();
    if (this.routeNoteId() && board) {
      void this.router.navigate(['/timelines', board.slug]).catch(() => {});
    }
  }

  jumpToReplyParent(note: CloudDayNote): void {
    if (!note.replyToNoteId) return;
    const parent = this.allNotes().find((n) => n.id === note.replyToNoteId);
    if (parent) {
      this.navigateToNote(parent);
      return;
    }
    void this.router.navigate(['/timelines', 'notes', note.replyToNoteId]).catch(() => {});
  }

  private scrollNoteIntoView(noteId: string): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(noteId) : noteId;
      const el = document.querySelector(`[data-note-id="${escaped}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  readonly crossLinkCandidates = computed<CloudDayNote[]>(() => {
    const b = this.activeBoard();
    this.crossLinkSourceNote();
    if (!b) return [];
    return this.timelines.getCompatibleCrossLinkCandidates(b);
  });

  constructor() {
    this.timelines.visibleBoards$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((boards) => this.visibleBoards.set(boards));

    this.timelines.activeBoard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((board) => {
        this.activeBoard.set(board);
        if (board?.defaultActorId) {
          this.selectedComposerActorId.set(board.defaultActorId);
        }
      });

    this.timelines.allNotes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notes) => this.allNotes.set(notes));

    this.timelines.actors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((actors) => this.allActors.set(actors));

    this.timelines.statusMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => this.statusMessage.set(msg));

    this.timelines.boardsLoaded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loaded) => this.boardsLoaded.set(loaded));

    this.timelines.notesLoaded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loaded) => this.notesLoaded.set(loaded));

    this.profileService.profiles$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((profiles) => this.allProfiles.set(profiles));

    this.profileService.activeProfile$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((profile) => {
        this.activeProfile.set(profile);
        if (profile.playerType === 'AGENT') {
          this.selectedComposerActorId.set('actor-antigravity-agent');
        }
      });

    this.seasonsBridge.personalFeedEntries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => this.personalFeedEntries.set(entries));

    this.seasonsBridge.remoteFeedNotes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => this.remoteFeedNotes.set(items));

    this.seasonsBridge.remoteFeedAccount$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((acc) => this.remoteFeedAccount.set(acc));

    this.seasonsBridge.streamInfo$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((info) => this.seasonsStreamInfo.set(info));

    this.seasonsBridge.isEnsuringStream$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => this.isEnsuringSeasonsStream.set(val));

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        const slug = params.get('boardSlug');
        const noteId = params.get('noteId') || queryParams.get('noteId');
        this.routeBoardSlug.set(slug);
        this.routeNoteId.set(noteId);
        if (slug) this.timelines.selectBoard(slug);
        if (!noteId) {
          this.highlightedNoteId.set(null);
          this.lastMissingLookupKey = null;
          this.lastScrolledNoteKey = null;
        }
      });

    effect(
      () => {
        const noteId = this.routeNoteId();
        if (!noteId) return;

        const boards = this.visibleBoards();
        const notes = this.allNotes();
        const resolution = resolveNoteDeepLink({
          noteId,
          routeBoardSlug: this.routeBoardSlug(),
          boards,
          notes,
        });

        if (resolution.status === 'FOUND') {
          this.lastMissingLookupKey = null;
          const { note, board, needsCanonicalRedirect } = resolution;
          if (this.activeBoard()?.id !== board.id) {
            this.timelines.selectBoard(board.id);
          }
          if (needsCanonicalRedirect) {
            void this.router
              .navigate(buildTimelineNoteCommands(board.slug, note.id), { replaceUrl: true })
              .catch(() => {});
          }
          if (this.selectedDateKey() !== note.dateKey) {
            this.selectedDateKey.set(note.dateKey);
          }
          if (this.showAllDates()) {
            this.showAllDates.set(false);
          }

          const filterPlan = planFilterClearForNote(note, {
            actorFilter: this.selectedActorFilter(),
            tagFilter: this.selectedTagFilter(),
            searchQuery: this.searchQuery(),
          });
          if (filterPlan.clearActor) this.selectedActorFilter.set(null);
          if (filterPlan.clearTag) this.selectedTagFilter.set(null);
          if (filterPlan.clearSearch) this.searchQuery.set('');

          this.highlightedNoteId.set(note.id);
          const scrollKey = `${board.id}:${note.id}:${this.viewMode()}`;
          if (this.lastScrolledNoteKey !== scrollKey) {
            this.lastScrolledNoteKey = scrollKey;
            this.scrollNoteIntoView(note.id);
          }
          return;
        }

        if (resolution.status === 'BOARD_NOT_ACCESSIBLE') {
          if (this.boardsLoaded()) {
            this.timelines.setStatus('Нет доступа к доске этого сообщения для текущего профиля.');
          }
          return;
        }

        if (!this.boardsLoaded() || !this.notesLoaded()) return;

        const lookupKey = `${this.activeProfile()?.id || ''}:${noteId}`;
        if (this.lastMissingLookupKey === lookupKey) return;
        this.lastMissingLookupKey = lookupKey;

        this.timelines.fetchNoteById(noteId).subscribe({
          error: (err) => {
            const status = (err as { status?: number } | null)?.status;
            this.timelines.setStatus(
              status === 403
                ? 'Нет доступа к сообщению приватного TimeLine.'
                : 'Сообщение не найдено или было удалено.',
            );
          },
        });
      },
      { allowSignalWrites: true },
    );
  }

  selectBoard(board: TimelineBoard): void {
    this.selectedTagFilter.set(null);
    this.highlightedNoteId.set(null);
    this.editingNoteId.set(null);
    this.crossLinkSourceNote.set(null);
    this.timelines.clearStatus();
    this.timelines.selectBoard(board.id);
    const targetSlug = board.slug || board.id;
    void this.router.navigate(['/timelines', targetSlug]).catch(() => {});
  }

  toggleTagFilter(tag: string): void {
    this.selectedTagFilter.update((curr) => (curr === tag ? null : tag));
  }

  toggleBoardHashtagFilter(tag: string): void {
    this.selectedBoardHashtag.update((curr) => (curr === tag ? null : tag));
  }

  getBoardHashtags(board: TimelineBoard): string[] {
    return mergeNoteTags(board.description || '', board.hashtags || []);
  }

  getDisplayTags(note: CloudDayNote): string[] {
    return mergeNoteTags(note.text || '', note.tags);
  }

  insertComposerHashtag(tag: string): void {
    this.composerText.update((curr) => appendHashtagToText(curr, tag));
  }

  applyComposerAutocomplete(tag: string): void {
    this.composerText.update((curr) => applyHashtagAutocomplete(curr, tag));
  }

  getBoardTotalCount(boardId: string): number {
    return this.allNotes().filter((n) => (n.boardId || 'board-global-day') === boardId).length;
  }

  getModeLabel(mode?: TimelineBoardMode): string {
    switch (mode) {
      case 'DIARY':
        return '📓 Дневник';
      case 'AGENT_SUMMARY':
        return '🤖 Сводка Агента';
      case 'PARTY_CLOUD':
        return '☁️ Облако';
      default:
        return '⏱️ TimeLine';
    }
  }

  getTimelineOffset(timeMinutes: number): number {
    return Math.max(0, Math.min(72, Math.round((timeMinutes / 1440) * 72)));
  }

  onDateInputChange(val: string): void {
    if (val) {
      this.selectedDateKey.set(val);
      this.showAllDates.set(false);
    }
  }

  shiftDate(days: number): void {
    const dt = new Date(`${this.selectedDateKey()}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + days);
    this.selectedDateKey.set(dt.toISOString().slice(0, 10));
  }

  setToday(): void {
    this.selectedDateKey.set(new Date().toISOString().slice(0, 10));
    this.showAllDates.set(false);
  }

  setCurrentTime(): void {
    this.composerTime.set(this.getCurrentLocalTimeString());
  }

  private getCurrentLocalTimeString(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  toggleAllDates(): void {
    this.showAllDates.update((v) => !v);
  }

  async onMediaFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const board = this.activeBoard();
    if (!file || !board) return;

    this.isUploadingMedia.set(true);
    try {
      const privacy: BoardPrivacy = board.privacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
      const attachment = await this.timelines.uploadMediaFile(file, privacy, this.composerTitle || file.name);
      this.pendingMedia.update((list) => [...list, attachment]);
    } catch {
      // Статус ошибки уже выставлен в TimelinesService
    } finally {
      this.isUploadingMedia.set(false);
      input.value = '';
    }
  }

  removePendingMedia(index: number): void {
    this.pendingMedia.update((list) => list.filter((_, i) => i !== index));
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitEntry();
    }
  }

  toggleComposerWeather(): void {
    if (this.composerWeather()) {
      this.composerWeather.set(null);
      return;
    }
    const [hh, mm] = (this.composerTime() || '12:00').split(':').map(Number);
    const mins = (hh || 12) * 60 + (mm || 0);
    this.composerWeather.set(this.weatherService.captureSnapshot(mins));
  }

  toggleComposerWorldMoment(): void {
    if (this.composerWorldMoment()) {
      this.composerWorldMoment.set(null);
      return;
    }
    this.composerWorldMoment.set(this.watchersService.captureActiveMomentSnapshot());
  }

  submitEntry(): void {
    const board = this.activeBoard();
    const actor = this.activeComposerActor();
    const text = this.composerText().trim();
    if (!board || !actor || !text) return;

    const tags = mergeNoteTags(text, this.composerSelectedTags());
    const weather = this.composerWeather();
    const worldMoment = this.composerWorldMoment();

    const created = this.timelines.addNote({
      board,
      actor,
      dateKey: this.selectedDateKey(),
      time: this.composerTime() || this.getCurrentLocalTimeString(),
      type: this.composerType(),
      title: this.composerTitle,
      text,
      tags,
      mediaAttachments: this.pendingMedia(),
      sharedWithGroup: board.privacy === 'PRIVATE' ? this.composerShareWithGroup : false,
      ...(weather ? { weather } : {}),
      ...(worldMoment ? { worldMoment } : {}),
    });

    if (created) {
      this.composerTitle = '';
      this.composerText.set('');
      this.composerSelectedTags.set([]);
      this.composerWeather.set(null);
      this.composerWorldMoment.set(null);
      this.composerShareWithGroup = false;
      this.pendingMedia.set([]);
    }
  }

  handleCloudCreateNote(payload: {
    time: string;
    type: CloudItemType;
    title?: string;
    text: string;
    tags?: string[];
    weather?: NoteWeatherSnapshot | null;
    worldMoment?: NoteWorldMomentSnapshot | null;
  }): void {
    const board = this.activeBoard();
    const actor = this.activeComposerActor();
    if (!board || !actor) return;

    const text = payload.text.trim();
    if (!text) return;

    this.composerTime.set(payload.time);
    this.timelines.addNote({
      board,
      actor,
      dateKey: this.selectedDateKey(),
      time: payload.time,
      type: payload.type,
      title: payload.title,
      text,
      tags: payload.tags,
      sharedWithGroup: board.privacy === 'PRIVATE' ? this.composerShareWithGroup : false,
      ...(payload.weather ? { weather: payload.weather } : {}),
      ...(payload.worldMoment ? { worldMoment: payload.worldMoment } : {}),
    });
  }

  startEditNote(note: CloudDayNote): void {
    this.editingNoteId.set(note.id);
    this.editTitleDraft = note.title || '';
    this.editTextDraft.set(note.text || '');
    this.editSelectedTags.set(getExtraTagsNotInText(note.text || '', note.tags));
  }

  cancelEditNote(): void {
    this.editingNoteId.set(null);
    this.editTitleDraft = '';
    this.editTextDraft.set('');
    this.editSelectedTags.set([]);
  }

  saveEditedNote(note: CloudDayNote): void {
    const nextText = this.editTextDraft().trim();
    if (!nextText) return;
    this.timelines.updateNote(note.id, {
      title: this.editTitleDraft.trim() || undefined,
      text: nextText,
      tags: mergeNoteTags(nextText, this.editSelectedTags()),
    });
    this.cancelEditNote();
  }

  openPersonalFeedModal(): void {
    this.isPersonalFeedModalOpen.set(true);
    this.refreshRemoteSeasonsFeed();
    this.seasonsBridge.fetchStreamInfo(
      this.activeBoard()?.seasonsStreamSlug || 'lemon-universe',
      this.profileService.currentProfileId,
    );
  }

  handleEnsureSeasonsStream(): void {
    const streamSlug = this.activeBoard()?.seasonsStreamSlug || 'lemon-universe';
    this.seasonsBridge
      .ensureTimelinesStream(streamSlug, this.profileService.currentProfileId)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.statusMessage.set(
              `Стрим '${res.streamSlug}' синхронизирован! Погружено каналов (feeds): ${res.attachedFeedsCount}`,
            );
            this.refreshRemoteSeasonsFeed();
          } else {
            this.statusMessage.set(`Ошибка погружения каналов в стрим: ${res.error}`);
          }
        },
        error: (err) => {
          this.statusMessage.set(
            `Ошибка связи при синхронизации стрима: ${err?.message || err}`,
          );
        },
      });
  }

  refreshRemoteSeasonsFeed(): void {
    this.seasonsBridge.fetchRemoteFeedNotes(
      this.activeBoard()?.seasonsFeedSlug,
      this.profileService.currentProfileId,
    );
  }

  openCreateBoardModal(): void {
    this.editingBoard.set(null);
    this.isCreateBoardOpen.set(true);
  }

  openEditBoardModal(board: TimelineBoard): void {
    this.editingBoard.set(board);
    this.isCreateBoardOpen.set(true);
  }

  closeBoardModal(): void {
    this.isCreateBoardOpen.set(false);
    this.editingBoard.set(null);
  }

  handleCreateBoard(payload: CreateBoardSubmitPayload): void {
    const created = this.timelines.createBoard(payload);
    this.closeBoardModal();
    void this.router.navigate(['/timelines', created.slug]);
  }

  handleEditBoard(payload: EditBoardSubmitPayload): void {
    const b = this.editingBoard();
    if (!b) return;
    this.timelines.updateBoard(b.id, payload);
    this.closeBoardModal();
  }

  handleSaveBoardSettings(payload: { privacy: BoardPrivacy; boardMode: TimelineBoardMode }): void {
    const b = this.activeBoard();
    if (!b) return;
    this.timelines.updateBoard(b.id, payload);
  }

  handleUpsertMember(dto: {
    profileId: string;
    role: BoardMemberRole;
    canPost: boolean;
    canCrossLink: boolean;
  }): void {
    const b = this.activeBoard();
    if (!b) return;
    this.timelines.upsertMember(b.id, dto);
  }

  handleRemoveMember(profileId: string): void {
    const b = this.activeBoard();
    if (!b) return;
    this.timelines.removeMember(b.id, profileId);
  }

  openCrossLinkModal(note: CloudDayNote): void {
    this.crossLinkSourceNote.set(note);
  }

  handleAttachCrossLink(payload: { targetNote: CloudDayNote; relationLabel: string }): void {
    const srcBoard = this.activeBoard();
    const srcNote = this.crossLinkSourceNote();
    if (!srcBoard || !srcNote) return;

    const targetBoard = this.visibleBoards().find(
      (b) => b.id === (payload.targetNote.boardId || 'board-global-day'),
    );
    if (!targetBoard) return;

    this.timelines.attachCrossLink(
      srcBoard,
      srcNote,
      targetBoard,
      payload.targetNote,
      payload.relationLabel || undefined,
    );
    this.crossLinkSourceNote.set(null);
  }

  jumpToCrossRef(cref: TimelineNodeCrossRef): void {
    const targetBoard = this.visibleBoards().find((b) => b.id === cref.targetBoardId);
    if (!targetBoard) {
      this.timelines.setStatus('Целевой борд недоступен для текущего профиля или удалён.');
      return;
    }
    this.timelines.selectBoard(targetBoard.id);
    this.selectedDateKey.set(cref.targetDateKey);
    this.showAllDates.set(false);
    this.highlightedNoteId.set(cref.targetNoteId);
    void this.router
      .navigate(buildTimelineNoteCommands(targetBoard.slug, cref.targetNoteId))
      .catch(() => {});
  }

  openAgentSummaryModal(): void {
    this.agentSummaryError.set(null);
    this.isAgentSummaryOpen.set(true);
  }

  closeAgentSummaryModal(): void {
    this.agentSummaryError.set(null);
    this.isAgentSummaryOpen.set(false);
  }

  handleAgentSummary(payload: AgentSummarySubmitPayload): void {
    const sourceBoard = this.visibleBoards().find((b) => b.id === payload.sourceBoardId);
    const targetBoard = payload.targetBoardId
      ? this.visibleBoards().find((b) => b.id === payload.targetBoardId)
      : null;
    const actor =
      this.allActors().find((a) => a.id === payload.actorId) ?? this.allActors()[0];
    if (!sourceBoard || !actor) return;

    const res = this.timelines.runAgentSummaryFlow({
      agentProfileId: payload.agentProfileId,
      sourceBoard,
      targetBoard,
      actor,
      title: payload.title,
      text: payload.text,
      tags: payload.tags,
    });

    if (!res.ok) {
      this.agentSummaryError.set(res.reason || 'Не удалось создать сводку агента.');
      return;
    }

    this.closeAgentSummaryModal();
  }
}
