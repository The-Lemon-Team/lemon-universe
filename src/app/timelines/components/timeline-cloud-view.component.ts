import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { getAccentPillClasses } from '../../components/neuron-arena/arena-ui.utils';
import {
  CLOUD_DAY_VIBES,
  CLOUD_HOUR_MILESTONES,
  CloudDayVibe,
  CloudDayVibeId,
  TimelineCluster,
  getAccentStemClasses,
  getCloudTypeEmoji,
  getCloudTypeLabel,
  getClusterPinClasses,
  getNoteBorderClass,
  getNoteStemHeight,
  getTimelinePercent,
  groupNotesIntoClusters,
} from '../../components/neuron-arena/cloud-timeline.utils';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { CloudDayNote, TimelineBoard, TimelineNodeCrossRef } from '../../core/models/flow.models';

@Component({
  selector: 'app-timeline-cloud-view',
  standalone: true,
  imports: [ActorAvatarComponent, FormsModule, ModalOverlayDirective],
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
  template: `
    <div class="overflow-x-auto pb-2 pt-8">
      <div
        class="relative bg-white dark:bg-[#1b1e2a] rounded-[3.2rem] border-4 shadow-xl p-5 sm:p-7 min-h-[700px] min-w-[960px] flex flex-col justify-between transition-colors"
        [class]="currentVibe().stageBorderClass"
      >
        <!-- Decorative Puffy Lobes on Top of Cloud -->
        <div class="absolute -top-6 left-12 w-20 h-14 bg-white dark:bg-[#1b1e2a] rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>
        <div class="absolute -top-10 left-36 w-32 h-20 bg-white dark:bg-[#1b1e2a] rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>
        <div class="absolute -top-7 right-32 w-24 h-16 bg-white dark:bg-[#1b1e2a] rounded-t-full border-t-4 border-l-4 border-r-4 border-amber-300 dark:border-amber-400/50 pointer-events-none"></div>

        <!-- In-Cloud Header Strip -->
        <div class="relative z-10 flex items-center justify-between gap-3 border-b border-amber-200/60 dark:border-outline-variant/30 pb-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-amber-400/25 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xl shadow-xs">
              ☁️
            </div>
            <div>
              <h2 class="font-headline-sm text-base sm:text-lg font-black text-on-surface">
                Хроно-Облако: {{ headerDateLabel() }}
              </h2>
              <p class="font-body-sm text-[11px] text-on-surface-variant">
                Облачка сообщений на нижней шкале времени (08:00 — 24:00) · Стопки по 30 минут
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Vibe Selector Button -->
            <button
              type="button"
              (click)="isVibePickerOpen.set(true)"
              class="px-3 py-1.5 rounded-full bg-surface-container-high/90 hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 text-xs font-bold font-label-ui flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Настроить вайб и атмосферный фон дня"
            >
              <span>{{ currentVibe().icon }}</span>
              <span>Вайб: {{ currentVibe().name.split(' (')[0] }}</span>
              <span class="material-symbols-rounded text-sm text-outline">tune</span>
            </button>

            <span class="px-3 py-1.5 rounded-full bg-amber-400/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 text-xs font-bold font-label-code-sm flex items-center gap-1.5 shadow-2xs">
              <span>💬</span>
              <span>{{ notes().length }} {{ getNotesWord(notes().length) }}</span>
            </span>
          </div>
        </div>

        <!-- CENTRAL IN-CLOUD TIMELINE SKY -->
        <div class="cloud-sky-canvas relative z-10 flex-1 my-4 min-h-[540px] flex flex-col justify-end min-w-[900px] px-8 pb-4 pt-4 rounded-3xl overflow-hidden border border-outline-variant/20 shadow-inner isolate">
          <!-- 1. DYNAMIC SKY GRADIENT & TIME-OF-DAY ATMOSPHERIC SECTORS -->
          <div class="absolute inset-0 pointer-events-none -z-10" [class]="currentVibe().skyGradient">
            <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/40 dark:to-slate-950/50"></div>

            <!-- Sector 1: Morning (08:00 — 12:00 = 25% width) -->
            <div class="absolute inset-y-0 left-0 w-[25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-amber-500/35 pointer-events-none">
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 text-[10px] font-bold font-label-code-sm self-start shadow-2xs">
                <span>🌅</span>
                <span>Утро (08:00 — 12:00)</span>
              </div>
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[0] }}</div>
            </div>

            <!-- Sector 2: Midday / Afternoon (12:00 — 17:00 = 31.25% width) -->
            <div class="absolute inset-y-0 left-[25%] w-[31.25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-sky-500/35 pointer-events-none">
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-900 dark:text-sky-200 border border-sky-400/40 text-[10px] font-bold font-label-code-sm self-start shadow-2xs">
                <span>☀️</span>
                <span>День (12:00 — 17:00)</span>
              </div>
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[1] }}</div>
            </div>

            <!-- Sector 3: Evening / Sunset (17:00 — 21:00 = 25% width) -->
            <div class="absolute inset-y-0 left-[56.25%] w-[25%] flex flex-col justify-between p-3 border-r-2 border-dashed border-purple-500/35 pointer-events-none">
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-400/20 text-purple-900 dark:text-purple-200 border border-purple-400/40 text-[10px] font-bold font-label-code-sm self-start shadow-2xs">
                <span>🌆</span>
                <span>Вечер (17:00 — 21:00)</span>
              </div>
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[2] }}</div>
            </div>

            <!-- Sector 4: Night / Starlight (21:00 — 24:00 = 18.75% width) -->
            <div class="absolute inset-y-0 left-[81.25%] right-0 flex flex-col justify-between p-3 pointer-events-none">
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border border-indigo-400/40 text-[10px] font-bold font-label-code-sm self-start shadow-2xs">
                <span>🌙</span>
                <span>Ночь (21:00 — 24:00)</span>
              </div>
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[3] }}</div>
            </div>
          </div>

          <!-- CANDLESTICK TIME GRID COLUMNS -->
          <div class="absolute inset-0 bottom-16 flex pointer-events-none opacity-20 -z-5">
            @for (m of hourMilestones; track m.label) {
              <div class="h-full border-r border-dotted border-outline-variant/40 flex-1 relative flex flex-col justify-between">
                <span class="text-[9px] font-mono text-outline/60 p-2 font-semibold">{{ m.label }}</span>
              </div>
            }
          </div>

          @if (clusters().length === 0) {
            <div class="my-auto mx-auto px-6 py-5 rounded-3xl bg-white/85 dark:bg-slate-900/80 border border-outline-variant/40 shadow-md text-center max-w-md z-10">
              <div class="text-3xl mb-2">☁️</div>
              <p class="text-xs font-bold text-on-surface mb-1">Облако пока пустое</p>
              <p class="text-[11px] text-on-surface-variant">
                Добавьте запись в форме выше или кликните по нижней шкале времени, чтобы выбрать час для нового сообщения.
              </p>
            </div>
          }

          <!-- FLOATING MESSAGE BUBBLES ANCHORED BY VERTICAL CANDLESTICK STEMS -->
          @for (cluster of clusters(); track cluster.id; let idx = $index) {
            @if (getClusterActiveNote(cluster); as note) {
              <div
                class="absolute bottom-14 -translate-x-1/2 flex flex-col items-center group z-10 hover:z-30 pointer-events-none"
                [style.left.%]="getTimelinePercent(cluster.timeMinutes)"
              >
                <!-- 1. MESSAGE BUBBLE CARD WITH STACK -->
                <div
                  class="relative w-[230px] sm:w-[265px] pointer-events-auto thought-pop"
                  [style.translate]="getBubbleShiftPercent(cluster.timeMinutes) + '% 0'"
                >
                  @if (cluster.isCluster && cluster.notes.length > 2) {
                    <div
                      class="absolute inset-0 rounded-2xl bg-amber-100/80 dark:bg-slate-700/80 border-2 border-outline-variant/30 shadow-2xs pointer-events-none -translate-x-1.5 translate-y-2.5 -rotate-2 -z-20 transition-transform duration-150 group-hover:-translate-x-2.5 group-hover:translate-y-3.5"
                    ></div>
                  }

                  @if (cluster.isCluster) {
                    <div
                      class="absolute inset-0 rounded-2xl bg-white/90 dark:bg-slate-800/90 border-2 border-outline-variant/40 shadow-xs pointer-events-none translate-x-1.5 translate-y-1.5 rotate-2 -z-10 transition-transform duration-150 group-hover:translate-x-2.5 group-hover:translate-y-2.5"
                    ></div>
                  }

                  <div
                    (click)="openInspectModal(note)"
                    class="relative p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-md group-hover:shadow-lg group-hover:-translate-y-0.5 group-hover:scale-[1.03] transition-transform duration-150 ease-out will-change-transform border-2 w-full cursor-pointer"
                    [class]="getNoteBorderClass(note.actorAccent)"
                  >
                    <!-- Mini Header -->
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <div class="flex items-center -space-x-2 flex-shrink-0">
                        <app-actor-avatar
                          [avatar]="note.actorAvatar"
                          containerClass="w-7 h-7 rounded-xl shadow-xs ring-2 ring-surface z-10 flex-shrink-0"
                        />
                        @if (note.subActorAvatar) {
                          <app-actor-avatar
                            [avatar]="note.subActorAvatar"
                            containerClass="w-7 h-7 rounded-xl shadow-xs ring-2 ring-amber-500/50 z-20 flex-shrink-0"
                            [title]="'Субперсонаж: ' + note.subActorName"
                          />
                        }
                      </div>

                      <div class="flex flex-col truncate min-w-0 flex-1">
                        <div class="flex items-center gap-1 truncate">
                          <span class="text-xs font-bold text-on-surface truncate">{{ note.actorName }}</span>
                          @if (note.subActorName) {
                            <span class="text-[10px] text-primary font-black">&amp;</span>
                            <span class="text-xs font-bold text-primary truncate">{{ note.subActorName }}</span>
                          }
                        </div>
                        <span class="text-[10px] font-mono text-outline font-semibold">
                          @if (showAllDates()) {
                            {{ note.dateKey }} · {{ note.time }}
                          } @else {
                            {{ note.time }}
                          }
                        </span>
                      </div>

                      <!-- Mini Stack Paginator -->
                      @if (cluster.isCluster) {
                        <div
                          (click)="$event.stopPropagation()"
                          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold shadow-2xs flex-shrink-0 select-none"
                          [title]="'Стопка: 30-минутное окно (' + cluster.notes.length + ' сообщений)'"
                        >
                          <button
                            type="button"
                            (click)="prevClusterNote(cluster.id, cluster.notes.length, $event)"
                            class="w-4 h-4 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-xs font-black"
                            title="Предыдущее сообщение в стопке"
                          >
                            ‹
                          </button>
                          <span class="px-0.5">{{ getClusterActiveIndex(cluster.id) + 1 }}/{{ cluster.notes.length }}</span>
                          <button
                            type="button"
                            (click)="nextClusterNote(cluster.id, cluster.notes.length, $event)"
                            class="w-4 h-4 rounded hover:bg-amber-500/30 flex items-center justify-center transition-colors cursor-pointer text-xs font-black"
                            title="Следующее сообщение в стопке"
                          >
                            ›
                          </button>
                        </div>
                      }

                      <span class="ml-0.5 text-sm flex-shrink-0" [title]="getCloudTypeLabel(note.type)">
                        {{ note.moodEmoji || getCloudTypeEmoji(note.type) }}
                      </span>
                    </div>

                    @if (note.title) {
                      <div class="text-[11px] font-bold text-primary mb-1 truncate">
                        {{ note.title }}
                      </div>
                    }

                    <!-- Message Text -->
                    <p class="text-xs font-body-sm text-on-surface leading-snug line-clamp-3 italic min-h-[2.4rem]">
                      «{{ note.text }}»
                    </p>

                    <!-- Media Preview Strip -->
                    @if (note.mediaAttachments && note.mediaAttachments.length > 0) {
                      <div class="mt-1.5 flex items-center gap-1.5">
                        @if ((note.mediaAttachments[0].mimeType || 'image/').startsWith('image/')) {
                          <img
                            [src]="note.mediaAttachments[0].thumbnailUrl || note.mediaAttachments[0].url"
                            [alt]="note.mediaAttachments[0].filename || 'media'"
                            class="w-8 h-8 rounded-lg object-cover border border-outline-variant/30"
                          />
                        }
                        <span class="text-[10px] font-mono text-primary font-semibold truncate">
                          📎 {{ note.mediaAttachments.length }} медиа
                        </span>
                      </div>
                    }

                    <!-- Cross-Ref Preview Badge -->
                    @if (note.crossRefs && note.crossRefs.length > 0) {
                      <div
                        (click)="onCrossRefClick(note.crossRefs[0], $event)"
                        class="mt-1.5 px-2 py-1 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/35 transition-colors cursor-pointer flex items-center justify-between gap-1 text-[10px]"
                        [title]="'Перейти в ленту: ' + note.crossRefs[0].targetBoardTitle"
                      >
                        <span class="font-bold text-violet-700 dark:text-violet-300 truncate">
                          🔗 {{ note.crossRefs[0].relationLabel || note.crossRefs[0].targetBoardTitle }}
                        </span>
                        <span class="font-mono text-outline flex-shrink-0">{{ note.crossRefs[0].targetTime }}</span>
                      </div>
                    }

                    <!-- Bubble Footer -->
                    <div class="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-outline-variant/20 flex-wrap">
                      <div class="flex items-center gap-1.5 min-w-0">
                        @if (note.seasonsNoteId || note.seasonsSynced) {
                          <span class="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Seasons</span>
                          </span>
                        }
                        @if (note.tags && note.tags.length > 0) {
                          <span class="text-[9px] font-mono text-outline truncate">#{{ note.tags[0] }}</span>
                        }
                      </div>

                      <!-- Dot indicators for cluster -->
                      @if (cluster.isCluster) {
                        <div class="flex items-center gap-1" (click)="$event.stopPropagation()">
                          @for (item of cluster.notes; track item.id; let dotIdx = $index) {
                            <button
                              type="button"
                              (click)="setClusterIndex(cluster.id, dotIdx, $event)"
                              class="h-1.5 rounded-full transition-colors cursor-pointer"
                              [class]="dotIdx === getClusterActiveIndex(cluster.id) ? 'w-3.5 bg-amber-500' : 'w-1.5 bg-outline-variant/60 hover:bg-outline-variant'"
                              [title]="'Сообщение ' + (dotIdx + 1) + ': ' + item.actorName + ' (' + item.time + ')'"
                            ></button>
                          }
                        </div>
                      }

                      @if (canPost()) {
                        <button
                          type="button"
                          (click)="onDeleteNoteClick(note.id, $event)"
                          class="opacity-0 group-hover:opacity-100 p-0.5 rounded text-outline hover:text-rose-500 transition-opacity cursor-pointer"
                          title="Удалить запись"
                        >
                          <span class="material-symbols-rounded text-sm">close</span>
                        </button>
                      }
                    </div>

                    <!-- Triangular bottom tail pointing to candlestick column -->
                    <div
                      class="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-b-2 border-r-2"
                      [class]="getNoteBorderClass(note.actorAccent)"
                      [style.left]="'calc(50% - ' + getBubbleShiftPercent(cluster.timeMinutes) + '%)'"
                    ></div>
                  </div>
                </div>

                <!-- 2. VERTICAL CANDLESTICK STEM -->
                <div
                  class="w-1.5 rounded-full transition-transform duration-150 ease-out group-hover:scale-x-150 will-change-transform shadow-xs my-0.5 pointer-events-none"
                  [class]="getAccentStemClasses(note.actorAccent)"
                  [style.height.px]="getNoteStemHeight(idx)"
                ></div>

                <!-- 3. BASE PIN ON THE TIMELINE ROAD -->
                <div class="flex flex-col items-center pointer-events-auto cursor-pointer" (click)="openInspectModal(note)">
                  <div
                    class="rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs flex items-center justify-center transition-transform duration-150 group-hover:scale-125"
                    [class]="getClusterPinClasses(cluster.isCluster, note.actorAccent)"
                  >
                    @if (cluster.isCluster) {
                      <span class="text-[9px] font-bold text-white">{{ cluster.notes.length }}</span>
                    } @else {
                      <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                    }
                  </div>
                  <span class="text-[9px] font-mono font-bold text-on-surface-variant bg-white/95 dark:bg-slate-900/95 px-1 py-0.2 rounded shadow-2xs mt-0.5 whitespace-nowrap">
                    {{ cluster.time }}
                  </span>
                </div>
              </div>
            }
          }

          <!-- THE BOTTOM TIMELINE AXIS (ROAD BAR) -->
          <div class="relative w-full mt-auto pt-8 pb-1">
            <div
              (click)="onTimelineRoadClick($event)"
              class="relative w-full h-5 rounded-full bg-gradient-to-r from-amber-400 via-orange-300 via-sky-400 to-indigo-500 shadow-inner flex items-center cursor-pointer group"
              title="Кликните в любую точку шкалы, чтобы выбрать время для новой записи"
            >
              <!-- Dashed Center Lane -->
              <div class="absolute inset-x-2 border-t-2 border-dashed border-white/70 pointer-events-none"></div>

              <!-- Milestone Hour Nodes -->
              @for (m of hourMilestones; track m.label) {
                <div
                  class="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
                  [style.left.%]="getTimelinePercent(m.minutes)"
                >
                  <div class="w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-600 shadow-xs"></div>
                  <span class="text-[10px] font-mono font-bold text-on-surface-variant mt-2 whitespace-nowrap bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.2 rounded-md shadow-2xs">
                    {{ m.icon }} {{ m.label }}
                  </span>
                </div>
              }

              <!-- "СЕЙЧАС" (NOW) INDICATOR PIN -->
              @if (isTodaySelected()) {
                <div
                  class="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none z-20"
                  [style.left.%]="nowTimePercent()"
                >
                  <div class="w-0.5 h-80 border-l-2 border-dashed border-amber-500/50 -mb-2"></div>
                  <div class="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-xs now-sun-glow">
                    ☀️
                  </div>
                  <span class="text-[9px] font-label-code-sm font-extrabold text-amber-900 dark:text-amber-200 bg-amber-300 dark:bg-amber-600 px-1.5 py-0.2 rounded-full shadow-xs -mt-1 whitespace-nowrap">
                    Сейчас {{ nowTimeText() }}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- In-Cloud Bottom Info Strip -->
        <div class="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-amber-200/50 dark:border-outline-variant/30 text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <span class="text-base">✨</span>
            <span>Каждое сообщение прикреплено столбцом ко времени на нижней шкале. Кликните по шкале для выбора времени или по облачку для деталей.</span>
          </div>
          <div class="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <span>Хроно-Шкала: 08:00 — 24:00</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: DAY VIBE SELECTOR -->
    @if (isVibePickerOpen()) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="isVibePickerOpen.set(false)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-vibe-picker-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-md rounded-xl bg-surface-container-lowest shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden text-on-surface"
        >
          <div class="px-4 py-2.5 border-b border-outline-variant/20 bg-surface-container-low/60 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base">{{ currentVibe().icon }}</span>
              <h2 id="tl-vibe-picker-title" class="font-headline-sm text-sm font-bold truncate">
                Атмосфера Хроно-Облака
              </h2>
            </div>
            <button
              type="button"
              (click)="isVibePickerOpen.set(false)"
              aria-label="Закрыть"
              class="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
            >
              <span class="material-symbols-rounded text-lg leading-none">close</span>
            </button>
          </div>

          <div class="p-3 flex flex-col gap-1.5">
            @for (vibe of vibes; track vibe.id) {
              <button
                type="button"
                (click)="selectVibe(vibe.id)"
                class="px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5"
                [class]="
                  selectedVibeId() === vibe.id
                    ? 'bg-primary/10 border-primary shadow-2xs'
                    : 'bg-surface-container-low/70 border-outline-variant/25 hover:bg-surface-container-high'
                "
              >
                <span class="text-xl flex-shrink-0 leading-none">{{ vibe.icon }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-bold text-on-surface">{{ vibe.name }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest font-mono font-semibold leading-none">
                      {{ vibe.badge }}
                    </span>
                  </div>
                  <p class="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{{ vibe.description }}</p>
                </div>
              </button>
            }
          </div>

          <div class="px-4 py-2 border-t border-outline-variant/20 bg-surface-container-low/60 flex items-center justify-end">
            <button
              type="button"
              (click)="isVibePickerOpen.set(false)"
              class="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL: INSPECT NOTE BUBBLE -->
    @if (inspectedNote(); as note) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="closeInspectModal()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-inspect-note-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-lg rounded-xl bg-surface-container-lowest shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden text-on-surface max-h-[85vh]"
        >
          <!-- Compact Header (admin-cms style) -->
          <div class="px-4 py-2.5 border-b border-outline-variant/20 bg-surface-container-low/60 flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2 min-w-0">
              <app-actor-avatar [avatar]="note.actorAvatar" containerClass="w-8 h-8 rounded-lg shadow-2xs flex-shrink-0" />
              <div class="min-w-0">
                <h2 id="tl-inspect-note-title" class="font-headline-sm text-sm font-bold truncate leading-tight">
                  {{ note.actorName }}
                  @if (note.subActorName) {
                    <span class="text-primary"> &amp; {{ note.subActorName }}</span>
                  }
                </h2>
                <div class="flex items-center gap-1.5 text-[10px] font-mono text-outline flex-wrap mt-0.5">
                  <span>{{ note.dateKey }} · {{ note.time }}</span>
                  <span class="px-1.5 py-0.5 rounded leading-none" [class]="getAccentPillClasses(note.actorAccent)">
                    {{ note.moodEmoji || getCloudTypeEmoji(note.type) }} {{ getCloudTypeLabel(note.type) }}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              (click)="closeInspectModal()"
              aria-label="Закрыть"
              class="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer shrink-0"
            >
              <span class="material-symbols-rounded text-lg leading-none">close</span>
            </button>
          </div>

          <!-- Metadata / Cluster Sub-Bar -->
          @if (getInspectedNoteCluster(); as cluster) {
            <div class="px-4 py-1.5 border-b border-outline-variant/20 bg-amber-500/10 flex items-center justify-between text-[11px]">
              <span class="font-mono font-bold text-amber-800 dark:text-amber-300">
                Стопка {{ cluster.timeSpanLabel }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="stepInspectedCluster(cluster, -1)"
                  class="px-2 py-0.5 rounded bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/40 font-bold cursor-pointer"
                >
                  ‹ Пред.
                </button>
                <span class="font-mono font-bold px-1">
                  {{ getInspectedClusterIndex(cluster) + 1 }} / {{ cluster.notes.length }}
                </span>
                <button
                  type="button"
                  (click)="stepInspectedCluster(cluster, 1)"
                  class="px-2 py-0.5 rounded bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/40 font-bold cursor-pointer"
                >
                  След. ›
                </button>
              </div>
            </div>
          }

          <!-- Compact Scrollable Body -->
          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            @if (isEditingInspectedNote()) {
              <div class="p-3 rounded-xl bg-surface-container-low border border-primary/40 flex flex-col gap-2">
                <input
                  type="text"
                  [(ngModel)]="editTitleDraft"
                  placeholder="Заголовок (опционально)"
                  class="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
                />
                <textarea
                  [(ngModel)]="editTextDraft"
                  rows="4"
                  placeholder="Текст сообщения..."
                  class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[13px] text-on-surface leading-snug resize-y"
                ></textarea>
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    (click)="cancelEditInspectedNote()"
                    class="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    (click)="saveEditedInspectedNote(note)"
                    [disabled]="!editTextDraft.trim()"
                    class="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-on-primary text-[11px] font-bold cursor-pointer"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            } @else {
              @if (note.title) {
                <h3 class="text-xs font-bold text-primary">{{ note.title }}</h3>
              }

              <p class="text-[13px] text-on-surface leading-snug whitespace-pre-line">{{ note.text }}</p>
            }

            @if (note.mediaAttachments && note.mediaAttachments.length > 0) {
              <div class="flex flex-wrap gap-1.5">
                @for (m of note.mediaAttachments; track $index) {
                  @if ((m.mimeType || 'image/').startsWith('image/')) {
                    <a [href]="m.url" target="_blank" rel="noopener" class="block rounded-lg overflow-hidden border border-outline-variant/30">
                      <img [src]="m.thumbnailUrl || m.url" [alt]="m.caption || m.filename || 'image'" class="max-h-40 object-cover" />
                    </a>
                  } @else {
                    <a
                      [href]="m.url"
                      target="_blank"
                      rel="noopener"
                      class="px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/40 text-[11px] font-mono inline-flex items-center gap-1 no-underline text-on-surface"
                    >
                      <span class="material-symbols-rounded text-sm text-primary">attachment</span>
                      <span>{{ m.filename || m.url }}</span>
                    </a>
                  }
                }
              </div>
            }

            @if (note.tags && note.tags.length > 0) {
              <div class="flex flex-wrap gap-1">
                @for (tag of note.tags; track tag) {
                  <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                    #{{ tag }}
                  </span>
                }
              </div>
            }

            @if (note.crossRefs && note.crossRefs.length > 0) {
              <div class="flex flex-col gap-1">
                @for (cref of note.crossRefs; track cref.targetNoteId) {
                  <button
                    type="button"
                    (click)="onCrossRefClick(cref, $event); closeInspectModal()"
                    class="px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/35 text-left flex flex-col gap-0.5 cursor-pointer transition-colors"
                  >
                    <div class="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span class="font-bold text-violet-700 dark:text-violet-300">
                        🔗 {{ cref.relationLabel || cref.targetBoardTitle }}
                      </span>
                      <span class="text-outline">{{ cref.targetDateKey }} · {{ cref.targetTime }}</span>
                    </div>
                    <p class="text-[11px] text-on-surface-variant line-clamp-2">{{ cref.targetSnippet }}</p>
                  </button>
                }
              </div>
            }
          </div>

          <!-- Compact Footer -->
          <div class="px-4 py-2 border-t border-outline-variant/20 bg-surface-container-low/60 flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              @if (canPost()) {
                <button
                  type="button"
                  (click)="triggerCrossLinkFromModal(note)"
                  class="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-800 dark:text-violet-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-rounded text-sm leading-none">add_link</span>
                  <span>Ссылка</span>
                </button>
                @if (!isEditingInspectedNote()) {
                  <button
                    type="button"
                    (click)="startEditInspectedNote(note)"
                    class="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span class="material-symbols-rounded text-sm leading-none">edit</span>
                    <span>Редактировать</span>
                  </button>
                }
                <button
                  type="button"
                  (click)="triggerDeleteFromModal(note.id)"
                  class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-rounded text-sm leading-none">delete</span>
                  <span>Удалить</span>
                </button>
              }
            </div>

            <button
              type="button"
              (click)="closeInspectModal()"
              class="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineCloudViewComponent {
  readonly notes = input.required<CloudDayNote[]>();
  readonly board = input<TimelineBoard | null>(null);
  readonly selectedDateKey = input.required<string>();
  readonly showAllDates = input<boolean>(false);
  readonly canPost = input<boolean>(false);

  readonly timeSelected = output<string>();
  readonly deleteNote = output<string>();
  readonly editNote = output<{ noteId: string; title?: string; text: string }>();
  readonly crossLinkNote = output<CloudDayNote>();
  readonly jumpToCrossRef = output<TimelineNodeCrossRef>();

  protected readonly hourMilestones = CLOUD_HOUR_MILESTONES;
  protected readonly vibes = CLOUD_DAY_VIBES;
  protected readonly getTimelinePercent = getTimelinePercent;

  /**
   * Horizontal shift (%) for the bubble card near timeline edges so it isn't clipped.
   * Returns 0 for centered bubbles, positive near the left edge, negative near the right edge.
   */
  getBubbleShiftPercent(timeMinutes: number): number {
    const percent = getTimelinePercent(timeMinutes);
    const edgeThreshold = 14;
    const maxShift = 44;
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
  readonly clusterActiveIndices = signal<Record<string, number>>({});
  readonly inspectedNote = signal<CloudDayNote | null>(null);
  readonly isEditingInspectedNote = signal<boolean>(false);
  editTitleDraft = '';
  editTextDraft = '';

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

  readonly nowTimePercent = computed<number>(() => {
    const now = new Date();
    return getTimelinePercent(now.getHours() * 60 + now.getMinutes());
  });

  readonly nowTimeText = computed<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

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
  }

  selectVibe(id: CloudDayVibeId): void {
    this.selectedVibeId.set(id);
    this.isVibePickerOpen.set(false);
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

  onTimelineRoadClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width) return;
    const clickX = event.clientX - rect.left;
    const rawRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const normalized = Math.max(0, Math.min(1, (rawRatio - 0.06) / 0.88));
    const mins = Math.round(480 + normalized * (1440 - 480));
    const h = Math.min(23, Math.floor(mins / 60));
    const m = Math.round((mins % 60) / 15) * 15;
    const formatted = `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    this.timeSelected.emit(formatted);
  }

  openInspectModal(note: CloudDayNote): void {
    this.cancelEditInspectedNote();
    this.inspectedNote.set(note);
  }

  closeInspectModal(): void {
    this.cancelEditInspectedNote();
    this.inspectedNote.set(null);
  }

  startEditInspectedNote(note: CloudDayNote): void {
    this.editTitleDraft = note.title || '';
    this.editTextDraft = note.text || '';
    this.isEditingInspectedNote.set(true);
  }

  cancelEditInspectedNote(): void {
    this.isEditingInspectedNote.set(false);
    this.editTitleDraft = '';
    this.editTextDraft = '';
  }

  saveEditedInspectedNote(note: CloudDayNote): void {
    const nextText = this.editTextDraft.trim();
    if (!nextText) return;
    const nextTitle = this.editTitleDraft.trim() || undefined;
    this.editNote.emit({
      noteId: note.id,
      title: nextTitle,
      text: nextText,
    });
    this.inspectedNote.set({
      ...note,
      title: nextTitle,
      text: nextText,
    });
    this.cancelEditInspectedNote();
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
