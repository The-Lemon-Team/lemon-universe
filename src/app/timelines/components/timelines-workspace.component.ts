import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { getAccentPillClasses } from '../../components/neuron-arena/arena-ui.utils';
import {
  CloudSelectOption,
  CloudThemedSelectComponent,
} from '../../components/neuron-arena/cloud-themed-select.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaActorCard,
  BoardMemberRole,
  BoardPrivacy,
  CloudDayNote,
  CloudItemType,
  Profile,
  SeasonsPersonalFeedEntry,
  TimelineBoard,
  TimelineBoardMode,
  TimelineMediaAttachment,
  TimelineNodeCrossRef,
} from '../../core/models/flow.models';
import { ProfileService } from '../../core/services/profile.service';
import { SeasonsTimelineBridgeService } from '../../core/services/seasons-timeline-bridge.service';
import { TimelinesService } from '../services/timelines.service';
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

type BoardFilterTab = 'ALL' | 'DIARY' | 'AGENT_SUMMARY' | 'PRIVATE' | 'PUBLIC';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 pb-28 sm:pb-36">
      <!-- Status / Error Banner -->
      @if (statusMessage(); as msg) {
        <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{{ msg }}</span>
          <button
            type="button"
            (click)="timelines.clearStatus()"
            class="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
            aria-label="Скрыть уведомление"
          >
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      }

      <!-- 1. COMPACT TIMELINE BOARDS ISLAND -->
      <section class="bg-surface-container-lowest rounded-2xl p-2.5 sm:p-3 shadow-xs border border-outline-variant/30 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1 flex-wrap">
            @for (tab of boardFilterTabs; track tab.id) {
              <button
                type="button"
                (click)="boardFilter.set(tab.id)"
                class="px-2.5 py-1 rounded-lg text-[11px] font-label-ui font-bold transition-colors cursor-pointer border active:scale-[0.98]"
                [class]="
                  boardFilter() === tab.id
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                "
              >
                {{ tab.label }}
              </button>
            }
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              (click)="openAgentSummaryModal()"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/12 hover:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-500/30 text-[11px] font-bold cursor-pointer transition-colors active:scale-[0.98]"
            >
              <span class="material-symbols-rounded text-sm">smart_toy</span>
              <span class="hidden sm:inline">Сводка Агента</span>
            </button>

            <button
              type="button"
              (click)="openPersonalFeedModal()"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-[11px] font-bold cursor-pointer transition-colors active:scale-[0.98]"
            >
              <span>🌿</span>
              <span class="hidden sm:inline">Seasons</span>
              <span class="font-mono">({{ personalFeedEntries().length }})</span>
            </button>

            <button
              type="button"
              (click)="openCreateBoardModal()"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold shadow-2xs hover:opacity-95 cursor-pointer active:scale-[0.98]"
            >
              <span class="material-symbols-rounded text-sm">add</span>
              <span>Новый TimeLine</span>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto py-0.5">
          @for (board of filteredBoards(); track board.id) {
            <button
              type="button"
              (click)="selectBoard(board)"
              class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border flex-shrink-0 cursor-pointer active:scale-[0.98]"
              [class]="
                activeBoard()?.id === board.id
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
              "
            >
              <span class="material-symbols-rounded text-sm">{{ board.icon || 'timeline' }}</span>
              <span>{{ board.title }}</span>
              <span class="text-[10px] px-1 py-0.5 rounded-md bg-black/10 font-mono leading-none">
                {{ board.privacy === 'PRIVATE' ? '🔒' : '🌐' }} {{ getBoardTotalCount(board.id) }}
              </span>
            </button>
          } @empty {
            <span class="text-xs text-outline italic py-2">
              Нет TimeLine-бордов по выбранному фильтру для текущего профиля.
            </span>
          }
        </div>
      </section>

      <!-- 2. ACTIVE BOARD WORKSPACE -->
      @if (activeBoard(); as board) {
        <section class="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 shadow-xs border border-outline-variant/30 flex flex-col gap-4">
          <!-- Board Header -->
          <div class="flex items-start justify-between gap-4 flex-wrap border-b border-outline-variant/20 pb-3">
            <div class="flex flex-col gap-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="material-symbols-rounded text-2xl text-primary">{{ board.icon || 'timeline' }}</span>
                <h1 class="font-headline-sm text-lg sm:text-xl font-black text-on-surface">
                  {{ board.title }}
                </h1>
                <span
                  class="text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold border"
                  [class]="
                    board.privacy === 'PRIVATE'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/35'
                      : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/35'
                  "
                >
                  {{ board.privacy === 'PRIVATE' ? '🔒 PRIVATE' : '🌐 PUBLIC' }}
                </span>
                <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono font-semibold">
                  {{ getModeLabel(board.boardMode) }}
                </span>
              </div>
              @if (board.description) {
                <p class="text-xs text-on-surface-variant max-w-3xl">{{ board.description }}</p>
              }
              <div class="flex items-center gap-3 text-[11px] font-mono text-outline flex-wrap">
                <span>Участники (members): {{ (board.members || []).length }}</span>
                <span>·</span>
                <span>Seasons Feed: {{ board.seasonsFeedSlug }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              @if (canManageActiveBoard()) {
                <button
                  type="button"
                  (click)="openEditBoardModal(board)"
                  class="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold border border-outline-variant/30 inline-flex items-center gap-1.5 cursor-pointer"
                  title="Редактировать название, описание и slug Lemon Seasons"
                >
                  <span class="material-symbols-rounded text-base text-primary">edit</span>
                  <span>Редактировать</span>
                </button>
              }

              <button
                type="button"
                (click)="isMembersModalOpen.set(true)"
                class="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold border border-outline-variant/30 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span class="material-symbols-rounded text-base text-primary">group_add</span>
                <span>Members &amp; Приватность ({{ (board.members || []).length }})</span>
              </button>

              <button
                type="button"
                (click)="isProjectariumModalOpen.set(true)"
                class="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold border border-outline-variant/30 inline-flex items-center gap-1.5 cursor-pointer"
                title="Привязка к Projectarium и выдача токена"
              >
                <span class="material-symbols-rounded text-base text-primary">hub</span>
                <span>Projectarium</span>
              </button>

              <!-- View Switcher -->
              <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                <button
                  type="button"
                  (click)="viewMode.set('CLOUD_TIMELINE')"
                  class="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  [class]="viewMode() === 'CLOUD_TIMELINE' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  <span class="material-symbols-rounded text-sm">cloud</span>
                  <span>Облачка</span>
                </button>
                <button
                  type="button"
                  (click)="viewMode.set('DIARY_FEED')"
                  class="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  [class]="viewMode() === 'DIARY_FEED' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  <span class="material-symbols-rounded text-sm">menu_book</span>
                  <span>Дневник</span>
                </button>
                <button
                  type="button"
                  (click)="viewMode.set('VISUAL_TIMELINE')"
                  class="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  [class]="viewMode() === 'VISUAL_TIMELINE' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'"
                >
                  <span class="material-symbols-rounded text-sm">timeline</span>
                  <span>Шкала 24ч</span>
                </button>
              </div>

              <button
                type="button"
                (click)="pinnedSidebarOpen.set(!pinnedSidebarOpen())"
                class="px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                [class]="pinnedSidebarOpen()
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border-outline-variant/30'"
                title="Закреплённые сообщения для всего TimeLine"
              >
                <span class="material-symbols-rounded text-base">push_pin</span>
                <span>Закреплённые</span>
                @if (pinnedBoardNotes().length > 0) {
                  <span
                    class="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none"
                    [class]="pinnedSidebarOpen() ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/15 text-primary'"
                  >
                    {{ pinnedBoardNotes().length }}
                  </span>
                }
              </button>
            </div>
          </div>

          <!-- Date & Filter Toolbar (Grouped Tactile Island) -->
          <div class="flex items-center justify-between gap-2 flex-wrap p-2 rounded-2xl bg-surface-container-low/80 border border-outline-variant/30">
            <!-- Left Cluster: Date Segmented Group + Edit -->
            <div class="flex items-center gap-1.5 flex-wrap">
              @if (canManageActiveBoard()) {
                <button
                  type="button"
                  (click)="openEditBoardModal(board)"
                  class="px-2.5 py-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/30 inline-flex items-center gap-1 cursor-pointer transition-colors active:scale-[0.98]"
                  title="Редактировать название, описание и slug Lemon Seasons"
                >
                  <span class="material-symbols-rounded text-sm text-primary">edit</span>
                  <span class="hidden sm:inline">Редактировать</span>
                </button>
              }

              <div class="inline-flex items-center bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-0.5 gap-0.5">
                <button
                  type="button"
                  (click)="shiftDate(-1)"
                  [disabled]="showAllDates()"
                  class="px-2 py-1 rounded-lg hover:bg-surface-container-high text-xs font-bold disabled:opacity-40 cursor-pointer transition-colors"
                  title="Предыдущий день"
                >
                  ←
                </button>

                <input
                  type="date"
                  [ngModel]="selectedDateKey()"
                  (ngModelChange)="onDateInputChange($event)"
                  [disabled]="showAllDates()"
                  aria-label="Выбрать дату"
                  class="px-2 py-0.5 rounded-lg bg-transparent text-xs font-mono font-bold text-on-surface disabled:opacity-50 focus:outline-none"
                />

                <button
                  type="button"
                  (click)="shiftDate(1)"
                  [disabled]="showAllDates()"
                  class="px-2 py-1 rounded-lg hover:bg-surface-container-high text-xs font-bold disabled:opacity-40 cursor-pointer transition-colors"
                  title="Следующий день"
                >
                  →
                </button>
              </div>

              <div class="inline-flex items-center bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-0.5 gap-0.5">
                <button
                  type="button"
                  (click)="setToday()"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors active:scale-[0.98]"
                  [class]="
                    isTodaySelected()
                      ? 'bg-primary text-on-primary shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  "
                >
                  Сегодня
                </button>

                <button
                  type="button"
                  (click)="toggleAllDates()"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors active:scale-[0.98]"
                  [class]="
                    showAllDates()
                      ? 'bg-primary text-on-primary shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  "
                >
                  Все ({{ boardAllNotes().length }})
                </button>
              </div>
            </div>

            <!-- Right Cluster: Search & Actor Filter -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <div class="relative">
                <span class="material-symbols-rounded text-sm text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  placeholder="Поиск..."
                  class="pl-8 pr-2.5 py-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface w-36 sm:w-44 focus:outline-none focus:border-primary/60"
                />
              </div>

              <app-cloud-themed-select
                [options]="actorFilterOptions()"
                [value]="selectedActorFilter()"
                [clearable]="true"
                [clearValue]="null"
                [searchable]="true"
                prefixLabel="Персонаж:"
                panelWidthClass="w-64"
                (valueChange)="selectedActorFilter.set($event)"
              />
            </div>
          </div>

          <!-- 3. COMPOSER MOVED TO BOTTOM-DOCKED ISLAND -->

          <!-- 4. NOTES LIST (CLOUD TIMELINE, DIARY FEED OR 24H TIMELINE) -->
          @if (viewMode() === 'CLOUD_TIMELINE') {
            <app-timeline-cloud-view
              [notes]="visibleNotes()"
              [board]="board"
              [selectedDateKey]="selectedDateKey()"
              [showAllDates]="showAllDates()"
              [canPost]="canPostToActiveBoard()"
              (timeSelected)="composerTime = $event"
              (deleteNote)="timelines.deleteNote($event)"
              (editNote)="timelines.updateNote($event.noteId, { title: $event.title, text: $event.text })"
              (crossLinkNote)="openCrossLinkModal($event)"
              (jumpToCrossRef)="jumpToCrossRef($event)"
            />
          } @else if (viewMode() === 'VISUAL_TIMELINE') {
            <div class="relative overflow-x-auto rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 min-h-[260px]">
              <div class="min-w-[820px] flex flex-col gap-3">
                <div class="flex items-center justify-between text-[11px] font-mono text-outline border-b border-outline-variant/20 pb-2">
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                </div>
                @for (note of visibleNotes(); track note.id) {
                  <div class="relative flex items-center" [style.padding-left.%]="getTimelineOffset(note.timeMinutes)">
                    <div class="max-w-md p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <app-actor-avatar [avatar]="note.actorAvatar" containerClass="w-6 h-6 rounded-lg flex-shrink-0" />
                        <span class="text-xs font-bold">{{ note.actorName }}</span>
                        <span class="text-[10px] font-mono text-outline">{{ note.dateKey }} · {{ note.time }}</span>
                      </div>
                      <p class="text-xs text-on-surface">{{ note.text }}</p>
                    </div>
                  </div>
                } @empty {
                  <p class="text-xs text-outline italic text-center py-8">Нет записей за выбранный период.</p>
                }
              </div>
            </div>
          } @else {
            <div class="flex flex-col gap-3">
              @for (note of visibleNotes(); track note.id) {
                <article class="p-4 rounded-2xl bg-surface-container-low/70 border border-outline-variant/35 flex flex-col gap-2.5">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <app-actor-avatar [avatar]="note.actorAvatar" containerClass="w-9 h-9 rounded-xl shadow-2xs flex-shrink-0" />
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-bold text-on-surface">{{ note.actorName }}</span>
                          @if (note.authorProfileName) {
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-mono">
                              👤 {{ note.authorProfileName }}
                            </span>
                          }
                          <span class="text-[11px] font-mono text-outline">
                            {{ note.dateKey }} · {{ note.time }}
                          </span>
                        </div>
                        @if (note.title) {
                          <h3 class="text-sm font-bold text-primary mt-0.5">{{ note.title }}</h3>
                        }
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-xs px-2 py-0.5 rounded-full font-mono" [class]="getAccentPillClasses(note.actorAccent)">
                        {{ note.moodEmoji || '💭' }} {{ note.type }}
                      </span>

                      @if (note.seasonsNoteId || note.seasonsSynced) {
                        <span
                          class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-bold inline-flex items-center gap-1"
                          [title]="'Seasons Note ID: ' + (note.seasonsNoteId || 'synced')"
                        >
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Seasons OK</span>
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="timelines.retrySyncSeasons(note.id)"
                          class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Синхронизировать эту заметку в Lemon Seasons"
                        >
                          <span class="material-symbols-rounded text-xs">sync</span>
                          <span>Sync Seasons</span>
                        </button>
                      }

                      <button
                        type="button"
                        (click)="timelines.shareNoteWithGroup(note.id, !note.sharedWithGroup)"
                        class="px-2 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border transition-colors"
                        [class]="
                          note.sharedWithGroup
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40'
                            : 'bg-surface-container-highest/60 text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                        "
                        [title]="note.sharedWithGroup ? 'NoteShare включён для участников борда (нажмите чтобы отозвать)' : 'Расшарить Note & Media участникам борда через Lemon Seasons NoteShare'"
                      >
                        <span class="material-symbols-rounded text-sm">group_work</span>
                        <span>{{ note.sharedWithGroup ? 'Shared' : 'NoteShare' }}</span>
                      </button>

                      <button
                        type="button"
                        (click)="openCrossLinkModal(note)"
                        class="px-2.5 py-1 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-800 dark:text-violet-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        title="Прикрепить ссылку на сообщение из другого TimeLine"
                      >
                        <span class="material-symbols-rounded text-sm">add_link</span>
                        <span>Ссылка</span>
                      </button>

                      @if (canManageActiveBoard()) {
                        <button
                          type="button"
                          (click)="timelines.togglePinNote(note.id, !note.isPinned)"
                          class="p-1.5 rounded-xl cursor-pointer transition-colors"
                          [class]="note.isPinned
                            ? 'text-primary bg-primary/15 hover:bg-primary/25'
                            : 'text-outline hover:text-primary hover:bg-primary/10'"
                          [title]="note.isPinned ? 'Открепить сообщение' : 'Закрепить сообщение в сайдбаре TimeLine'"
                        >
                          <span class="material-symbols-rounded text-base">push_pin</span>
                        </button>
                      } @else if (note.isPinned) {
                        <span
                          class="p-1.5 rounded-xl text-primary bg-primary/10 inline-flex items-center"
                          title="Закреплено создателем доски"
                        >
                          <span class="material-symbols-rounded text-base">push_pin</span>
                        </span>
                      }

                      <button
                        type="button"
                        (click)="startEditNote(note)"
                        class="p-1.5 rounded-xl text-outline hover:text-primary hover:bg-primary/10 cursor-pointer"
                        title="Редактировать запись"
                      >
                        <span class="material-symbols-rounded text-base">edit</span>
                      </button>

                      <button
                        type="button"
                        (click)="timelines.deleteNote(note.id)"
                        class="p-1.5 rounded-xl text-outline hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        title="Удалить запись"
                      >
                        <span class="material-symbols-rounded text-base">delete</span>
                      </button>
                    </div>
                  </div>

                  @if (editingNoteId() === note.id) {
                    <div class="p-3 rounded-2xl bg-surface-container-lowest border border-primary/40 flex flex-col gap-2">
                      <input
                        type="text"
                        [(ngModel)]="editTitleDraft"
                        placeholder="Заголовок (опционально)"
                        class="w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                      />
                      <textarea
                        [(ngModel)]="editTextDraft"
                        rows="3"
                        class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface resize-y"
                      ></textarea>
                      <div class="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          (click)="cancelEditNote()"
                          class="px-3 py-1 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          (click)="saveEditedNote(note)"
                          [disabled]="!editTextDraft.trim()"
                          class="px-3 py-1 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  } @else {
                    <p class="text-sm text-on-surface leading-relaxed whitespace-pre-line">{{ note.text }}</p>
                  }

                  <!-- Media Attachments -->
                  @if (note.mediaAttachments && note.mediaAttachments.length > 0) {
                    <div class="flex flex-wrap gap-2 pt-1">
                      @for (m of note.mediaAttachments; track $index) {
                        @if ((m.mimeType || 'image/').startsWith('image/')) {
                          <a [href]="m.url" target="_blank" rel="noopener" class="block rounded-xl overflow-hidden border border-outline-variant/30">
                            <img [src]="m.thumbnailUrl || m.url" [alt]="m.caption || m.filename || 'image'" class="max-h-44 object-cover" />
                          </a>
                        } @else {
                          <a
                            [href]="m.url"
                            target="_blank"
                            rel="noopener"
                            class="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-mono inline-flex items-center gap-1.5 no-underline text-on-surface"
                          >
                            <span class="material-symbols-rounded text-sm text-primary">attachment</span>
                            <span>{{ m.filename || m.url }}</span>
                          </a>
                        }
                      }
                    </div>
                  }

                  <!-- Tags -->
                  @if (note.tags && note.tags.length > 0) {
                    <div class="flex flex-wrap gap-1.5">
                      @for (tag of note.tags; track tag) {
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                          #{{ tag }}
                        </span>
                      }
                    </div>
                  }

                  <!-- Cross-Timeline References -->
                  @if (note.crossRefs && note.crossRefs.length > 0) {
                    <div class="flex flex-col gap-1.5 pt-1">
                      @for (cref of note.crossRefs; track cref.targetNoteId) {
                        <button
                          type="button"
                          (click)="jumpToCrossRef(cref)"
                          class="p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/35 text-left flex flex-col gap-1 cursor-pointer transition-colors"
                        >
                          <div class="flex items-center justify-between gap-2 text-[10px] font-mono">
                            <span class="font-bold text-violet-700 dark:text-violet-300">
                              🔗 {{ cref.relationLabel || cref.targetBoardTitle }}
                            </span>
                            <span class="text-outline">{{ cref.targetDateKey }} · {{ cref.targetTime }}</span>
                          </div>
                          <div class="flex items-center gap-1.5">
                            <app-actor-avatar [avatar]="cref.targetActorAvatar" containerClass="w-4 h-4 rounded flex-shrink-0" />
                            <span class="text-xs font-bold">{{ cref.targetActorName }}</span>
                          </div>
                          <p class="text-xs text-on-surface-variant line-clamp-2">{{ cref.targetSnippet }}</p>
                        </button>
                      }
                    </div>
                  }
                </article>
              } @empty {
                <div class="p-8 text-center rounded-2xl bg-surface-container-low/50 border border-dashed border-outline-variant/40 text-xs text-outline">
                  Пока нет записей за выбранный день. Выберите «Все даты» или добавьте новую запись выше.
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- RIGHT SLIDE-OUT PINNED MESSAGES SIDEBAR -->
      @if (pinnedSidebarOpen()) {
        <div
          class="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-30 transition-opacity"
          (click)="pinnedSidebarOpen.set(false)"
        ></div>
      }
      <aside
        class="fixed top-0 right-0 h-full w-full sm:w-96 max-w-full bg-surface-container border-l border-outline-variant/30 shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out"
        [class.translate-x-0]="pinnedSidebarOpen()"
        [class.translate-x-full]="!pinnedSidebarOpen()"
        [attr.aria-hidden]="!pinnedSidebarOpen()"
      >
        <div class="p-4 border-b border-outline-variant/20 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-rounded text-primary">push_pin</span>
            <h3 class="text-sm font-black text-on-surface truncate">Закреплённые сообщения</h3>
            <span class="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-black">
              {{ pinnedBoardNotes().length }}
            </span>
          </div>
          <button
            type="button"
            (click)="pinnedSidebarOpen.set(false)"
            class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
            title="Закрыть панель"
          >
            <span class="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          @if (pinnedBoardNotes().length === 0) {
            <div class="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center text-xs text-on-surface-variant">
              <span class="material-symbols-rounded text-3xl text-outline mb-2 block">push_pin</span>
              <p class="font-bold text-on-surface mb-1">Пока нет закреплённых сообщений</p>
              <p>Создатель доски может закрепить важные записи для всего TimeLine.</p>
            </div>
          } @else {
            @for (pinned of pinnedBoardNotes(); track pinned.id) {
              <div class="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 hover:border-primary/40 transition-colors flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-base leading-none">{{ pinned.actorAvatar }}</span>
                    <span class="text-xs font-bold text-on-surface truncate">{{ pinned.actorName }}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      (click)="jumpToPinnedNote(pinned)"
                      class="px-2 py-0.5 rounded-lg bg-surface-container-high hover:bg-primary/15 text-[11px] font-bold text-on-surface-variant hover:text-primary cursor-pointer"
                      title="Перейти к дате сообщения"
                    >
                      {{ pinned.dateKey }} · {{ pinned.time }}
                    </button>
                    @if (canManageActiveBoard()) {
                      <button
                        type="button"
                        (click)="timelines.togglePinNote(pinned.id, false)"
                        class="p-1 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        title="Открепить сообщение"
                      >
                        <span class="material-symbols-rounded text-sm">keep_off</span>
                      </button>
                    }
                  </div>
                </div>

                @if (pinned.title) {
                  <div class="text-xs font-black text-on-surface">{{ pinned.title }}</div>
                }
                <p class="text-xs text-on-surface-variant whitespace-pre-wrap break-words leading-relaxed">
                  {{ pinned.text }}
                </p>
              </div>
            }
          }
        </div>
      </aside>

      <!-- BOTTOM-DOCKED CHAT COMPOSER ISLAND -->
      @if (activeBoard(); as board) {
        <div class="fixed bottom-0 inset-x-0 z-20 px-2 sm:px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div class="pointer-events-auto max-w-4xl mx-auto rounded-2xl sm:rounded-3xl bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/50 shadow-lg p-2 sm:p-2.5 flex flex-col gap-2">
            @if (canPostToActiveBoard()) {
              @if (composerExpanded()) {
                <div class="flex flex-col gap-2 pb-2 border-b border-outline-variant/30">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <app-cloud-themed-select
                        [options]="composerActorOptions()"
                        [value]="selectedComposerActorId()"
                        [searchable]="true"
                        placement="up"
                        prefixLabel="Персонаж:"
                        panelWidthClass="w-64"
                        (valueChange)="selectedComposerActorId.set($event)"
                      />
                      @if (activeProfile(); as prof) {
                        <span class="px-2 py-1 rounded-lg bg-surface-container-high text-[11px] font-mono text-on-surface-variant inline-flex items-center gap-1">
                          <span class="material-symbols-rounded text-xs text-primary">{{ prof.avatarIcon || 'person' }}</span>
                          <span>{{ prof.displayName }}</span>
                        </span>
                      }
                    </div>

                    <div class="flex items-center gap-1 flex-wrap">
                      @for (t of entryTypes; track t.value) {
                        <button
                          type="button"
                          (click)="composerType.set(t.value)"
                          class="px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors"
                          [class]="
                            composerType() === t.value
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30'
                          "
                        >
                          {{ t.emoji }} {{ t.label }}
                        </button>
                      }
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      [(ngModel)]="composerTitle"
                      placeholder="Заголовок (опционально)..."
                      class="sm:col-span-2 px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
                    />
                    <input
                      type="text"
                      [(ngModel)]="composerTagsRaw"
                      placeholder="Теги (diary, work)..."
                      class="px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
                    />
                  </div>

                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="inline-flex items-center gap-1">
                      <input
                        type="time"
                        [(ngModel)]="composerTime"
                        aria-label="Время записи"
                        class="px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface"
                      />
                      <button
                        type="button"
                        (click)="setCurrentTime()"
                        title="Установить текущее время"
                        class="px-2 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-[11px] font-bold text-on-surface-variant inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span class="material-symbols-rounded text-xs text-primary">schedule</span>
                        <span>Сейчас</span>
                      </button>
                    </div>

                    @if (board.privacy === 'PRIVATE') {
                      <label
                        class="px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant/40 text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                        title="Выдать NoteShare участникам этого приватного борда"
                      >
                        <input type="checkbox" [(ngModel)]="composerShareWithGroup" />
                        <span class="font-semibold text-on-surface-variant">NoteShare группе</span>
                      </label>
                    }
                  </div>
                </div>
              }

              @if (pendingMedia().length > 0) {
                <div class="flex flex-wrap gap-1.5">
                  @for (media of pendingMedia(); track $index) {
                    <div class="relative p-1 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center gap-1.5">
                      @if ((media.mimeType || '').startsWith('image/')) {
                        <img [src]="media.thumbnailUrl || media.url" [alt]="media.filename || 'media'" class="w-8 h-8 rounded object-cover" />
                      } @else {
                        <span class="material-symbols-rounded text-lg text-primary">attachment</span>
                      }
                      <span class="text-[10px] font-mono max-w-24 truncate">{{ media.filename || 'media' }}</span>
                      <button
                        type="button"
                        (click)="removePendingMedia($index)"
                        class="p-0.5 rounded hover:bg-rose-500/20 text-rose-600 cursor-pointer"
                        aria-label="Убрать файл"
                      >
                        <span class="material-symbols-rounded text-xs">close</span>
                      </button>
                    </div>
                  }
                </div>
              }

              <div class="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  (click)="composerExpanded.set(!composerExpanded())"
                  class="p-2 rounded-xl border text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors flex-shrink-0"
                  [class]="composerExpanded() ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-low border-outline-variant/30'"
                  title="Параметры записи (персонаж, тип, теги, время)"
                  aria-label="Параметры записи"
                >
                  <span class="material-symbols-rounded text-base leading-none">{{ composerExpanded() ? 'expand_more' : 'tune' }}</span>
                </button>

                <span class="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant/30 text-[11px] font-bold text-on-surface-variant flex-shrink-0">
                  {{ activeComposerActor()?.name || 'Персонаж' }}
                </span>

                <textarea
                  [(ngModel)]="composerText"
                  rows="1"
                  (keydown.ctrl.enter)="submitEntry()"
                  [placeholder]="'Сообщение от «' + (activeComposerActor()?.name || 'Персонаж') + '»... (Ctrl+Enter)'"
                  class="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface resize-none focus:outline-none focus:border-primary/60"
                ></textarea>

                <label
                  class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary cursor-pointer transition-colors flex-shrink-0"
                  title="Прикрепить медиа (Media Hub)"
                >
                  <span class="material-symbols-rounded text-base leading-none">{{ isUploadingMedia() ? 'hourglass_top' : 'add_photo_alternate' }}</span>
                  <input
                    type="file"
                    accept="image/*,audio/*,video/*"
                    (change)="onMediaFileSelected($event)"
                    class="hidden"
                  />
                </label>

                <button
                  type="button"
                  (click)="submitEntry()"
                  [disabled]="!composerText.trim() || isUploadingMedia()"
                  class="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-45 cursor-pointer inline-flex items-center gap-1 flex-shrink-0 active:scale-[0.98]"
                >
                  <span class="material-symbols-rounded text-base leading-none">send</span>
                  <span class="hidden sm:inline">Записать</span>
                </button>
              </div>
            } @else {
              <div class="px-2 py-1 text-xs text-on-surface-variant italic text-center">
                У текущего аккаунта режим только для чтения на этом борде.
              </div>
            }
          </div>
        </div>
      }

      <!-- MODALS -->
      <app-timeline-board-modal
        [isOpen]="isCreateBoardOpen()"
        [editingBoard]="editingBoard()"
        [actors]="allActors()"
        [profiles]="allProfiles()"
        [activeProfileId]="activeProfile()?.id || ''"
        (close)="closeBoardModal()"
        (create)="handleCreateBoard($event)"
        (save)="handleEditBoard($event)"
      />

      <app-timeline-members-modal
        [isOpen]="isMembersModalOpen()"
        [board]="activeBoard()"
        [profiles]="allProfiles()"
        [canManage]="canManageActiveBoard()"
        (close)="isMembersModalOpen.set(false)"
        (saveBoardSettings)="handleSaveBoardSettings($event)"
        (addOrUpdateMember)="handleUpsertMember($event)"
        (removeMember)="handleRemoveMember($event)"
      />

      <app-timeline-projectarium-modal
        [isOpen]="isProjectariumModalOpen()"
        [boards]="visibleBoards()"
        [activeBoardId]="activeBoard()?.id || null"
        [actorProfileId]="activeProfile()?.id || null"
        (closed)="isProjectariumModalOpen.set(false)"
      />

      <app-timeline-crosslink-modal
        [sourceBoard]="activeBoard()"
        [sourceNote]="crossLinkSourceNote()"
        [candidates]="crossLinkCandidates()"
        [boards]="visibleBoards()"
        (close)="crossLinkSourceNote.set(null)"
        (attach)="handleAttachCrossLink($event)"
      />

      <app-timeline-agent-summary-modal
        [isOpen]="isAgentSummaryOpen()"
        [boards]="visibleBoards()"
        [actors]="allActors()"
        [profiles]="allProfiles()"
        [errorMessage]="agentSummaryError()"
        (close)="closeAgentSummaryModal()"
        (submitSummary)="handleAgentSummary($event)"
      />

      <!-- Lemon Seasons Personal Feed Modal -->
      @if (isPersonalFeedModalOpen()) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="isPersonalFeedModalOpen.set(false)"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tl-seasons-feed-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[88vh] overflow-hidden"
          >
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🌿</span>
                <div>
                  <h2 id="tl-seasons-feed-title" class="font-headline-sm text-base font-bold">
                    Интеграция Lemon Seasons Neurons ({{ personalFeedEntries().length }})
                  </h2>
                  <p class="text-[11px] text-on-surface-variant">
                    Заметки транслируются через <code class="font-mono text-primary">&#64;lemon/seasons-neurons</code> и <code class="font-mono text-primary">SeasonsMediaAxon</code>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="isPersonalFeedModalOpen.set(false)"
                aria-label="Закрыть"
                class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
              >
                <span class="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="seasonsModalTab.set('LOCAL')"
                  class="px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer"
                  [class]="seasonsModalTab() === 'LOCAL' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30'"
                >
                  Локальный журнал ({{ personalFeedEntries().length }})
                </button>
                <button
                  type="button"
                  (click)="seasonsModalTab.set('REMOTE'); refreshRemoteSeasonsFeed()"
                  class="px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer"
                  [class]="seasonsModalTab() === 'REMOTE' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30'"
                >
                  Live Lemon Seasons ({{ remoteFeedNotes().length }})
                </button>
              </div>
              <div class="flex items-center gap-2">
                @if (remoteFeedAccount()) {
                  <span class="text-[10px] font-mono text-outline">Аккаунт: {{ remoteFeedAccount() }}</span>
                }
                <button
                  type="button"
                  (click)="refreshRemoteSeasonsFeed()"
                  class="px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-rounded text-sm">refresh</span>
                  <span>Обновить</span>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              @if (seasonsModalTab() === 'REMOTE') {
                @for (item of remoteFeedNotes(); track item.id) {
                  <div class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span class="font-bold text-on-surface">{{ item.title || item.externalId || item.id }}</span>
                      <span class="px-2 py-0.5 rounded-full bg-surface-container-highest text-[10px]">
                        {{ item.privacy || 'private' }} · {{ item.type || 'SINGLE' }}
                      </span>
                    </div>
                    <p class="text-xs text-on-surface-variant">{{ item.content || item.summary }}</p>
                  </div>
                } @empty {
                  <div class="p-6 text-center text-xs text-outline italic">
                    Нет загруженных заметок из Lemon Seasons API (проверьте доступность API или нажмите «Обновить»).
                  </div>
                }
              } @else {
                @for (entry of personalFeedEntries(); track entry.id) {
                  <div class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span class="font-bold text-on-surface">{{ entry.title }}</span>
                      <span class="text-outline">
                        {{ entry.syncedToRemote ? '✓ synced' : '⏳ local' }} · {{ entry.feedSlug }} · {{ entry.dateKey }}
                      </span>
                    </div>
                    <p class="text-xs text-on-surface-variant">{{ entry.content }}</p>
                  </div>
                }
              }
            </div>

            <div class="flex items-center justify-end pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="isPersonalFeedModalOpen.set(false)"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TimelinesWorkspaceComponent {
  protected readonly timelines = inject(TimelinesService);
  protected readonly profileService = inject(ProfileService);
  protected readonly seasonsBridge = inject(SeasonsTimelineBridgeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly boardFilterTabs: Array<{ id: BoardFilterTab; label: string }> = [
    { id: 'ALL', label: 'Все доступные' },
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
  readonly statusMessage = signal<string | null>(null);

  readonly boardFilter = signal<BoardFilterTab>('ALL');
  readonly viewMode = signal<TimelineViewMode>('CLOUD_TIMELINE');
  readonly selectedDateKey = signal<string>(new Date().toISOString().slice(0, 10));
  readonly showAllDates = signal<boolean>(false);
  readonly composerExpanded = signal<boolean>(false);
  readonly isTodaySelected = computed(
    () => !this.showAllDates() && this.selectedDateKey() === new Date().toISOString().slice(0, 10),
  );
  readonly selectedActorFilter = signal<string | null>(null);
  searchQuery = '';

  // Composer & Inline Edit state
  readonly selectedComposerActorId = signal<string>('actor-alexey');
  readonly composerType = signal<CloudItemType>('thought');
  composerTitle = '';
  composerText = '';
  composerTagsRaw = '';
  composerTime = this.getCurrentLocalTimeString();
  composerShareWithGroup = false;
  readonly pendingMedia = signal<TimelineMediaAttachment[]>([]);
  readonly isUploadingMedia = signal<boolean>(false);
  readonly editingNoteId = signal<string | null>(null);
  editTitleDraft = '';
  editTextDraft = '';

  // Modals state
  readonly isCreateBoardOpen = signal<boolean>(false);
  readonly editingBoard = signal<TimelineBoard | null>(null);
  readonly isMembersModalOpen = signal<boolean>(false);
  readonly isProjectariumModalOpen = signal<boolean>(false);
  readonly crossLinkSourceNote = signal<CloudDayNote | null>(null);
  readonly isAgentSummaryOpen = signal<boolean>(false);
  readonly agentSummaryError = signal<string | null>(null);
  readonly isPersonalFeedModalOpen = signal<boolean>(false);
  readonly seasonsModalTab = signal<'LOCAL' | 'REMOTE'>('LOCAL');

  readonly filteredBoards = computed<TimelineBoard[]>(() => {
    const f = this.boardFilter();
    const list = this.visibleBoards();
    if (f === 'ALL') return list;
    if (f === 'DIARY') return list.filter((b) => b.boardMode === 'DIARY');
    if (f === 'AGENT_SUMMARY') return list.filter((b) => b.boardMode === 'AGENT_SUMMARY');
    if (f === 'PRIVATE') return list.filter((b) => b.privacy === 'PRIVATE');
    return list.filter((b) => b.privacy === 'PUBLIC');
  });

  readonly boardAllNotes = computed<CloudDayNote[]>(() => {
    const board = this.activeBoard();
    if (!board) return [];
    return this.allNotes().filter((n) => (n.boardId || 'board-global-day') === board.id);
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
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.text.toLowerCase().includes(q) ||
          (n.title || '').toLowerCase().includes(q) ||
          n.actorName.toLowerCase().includes(q),
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
    this.selectedDateKey.set(note.dateKey);
    this.showAllDates.set(false);
    this.pinnedSidebarOpen.set(false);
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

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const slug = params.get('boardSlug');
        if (slug) this.timelines.selectBoard(slug);
      });
  }

  selectBoard(board: TimelineBoard): void {
    this.timelines.selectBoard(board.id);
    void this.router.navigate(['/timelines', board.slug]);
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
    this.composerTime = this.getCurrentLocalTimeString();
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

  submitEntry(): void {
    const board = this.activeBoard();
    const actor = this.activeComposerActor();
    const text = this.composerText.trim();
    if (!board || !actor || !text) return;

    const tags = this.composerTagsRaw
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const created = this.timelines.addNote({
      board,
      actor,
      dateKey: this.selectedDateKey(),
      time: this.composerTime || this.getCurrentLocalTimeString(),
      type: this.composerType(),
      title: this.composerTitle,
      text,
      tags,
      mediaAttachments: this.pendingMedia(),
      sharedWithGroup: board.privacy === 'PRIVATE' ? this.composerShareWithGroup : false,
    });

    if (created) {
      this.composerTitle = '';
      this.composerText = '';
      this.composerTagsRaw = '';
      this.composerShareWithGroup = false;
      this.pendingMedia.set([]);
    }
  }

  startEditNote(note: CloudDayNote): void {
    this.editingNoteId.set(note.id);
    this.editTitleDraft = note.title || '';
    this.editTextDraft = note.text || '';
  }

  cancelEditNote(): void {
    this.editingNoteId.set(null);
    this.editTitleDraft = '';
    this.editTextDraft = '';
  }

  saveEditedNote(note: CloudDayNote): void {
    const nextText = this.editTextDraft.trim();
    if (!nextText) return;
    this.timelines.updateNote(note.id, {
      title: this.editTitleDraft.trim() || undefined,
      text: nextText,
    });
    this.cancelEditNote();
  }

  openPersonalFeedModal(): void {
    this.isPersonalFeedModalOpen.set(true);
    this.refreshRemoteSeasonsFeed();
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
    void this.router.navigate(['/timelines', targetBoard.slug]);
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
