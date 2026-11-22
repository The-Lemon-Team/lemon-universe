import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { getAccentPillClasses } from '../../components/neuron-arena/arena-ui.utils';
import {
  CLOUD_DAY_VIBES,
  CLOUD_HOUR_MILESTONES,
  CELESTIAL_ORB_FULL_ARC_PATH,
  CelestialOrbState,
  CloudDayVibe,
  CloudDayVibeId,
  CloudNowIndicatorMode,
  TimelineCluster,
  getAccentStemClasses,
  getCelestialOrbState,
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
import { ArenaActorCard, CloudDayNote, CloudItemType, TimelineBoard, TimelineNodeCrossRef } from '../../core/models/flow.models';
import { getExtraTagsNotInText, mergeNoteTags } from '../../core/utils/hashtag.utils';

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

      @keyframes spinSlow {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes twinkleStar {
        0%,
        100% {
          opacity: 0.45;
          transform: scale(0.85);
        }
        50% {
          opacity: 1;
          transform: scale(1.15);
        }
      }

      .thought-pop {
        animation: thoughtPopIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .now-sun-glow {
        animation: pulseGlowRing 2.8s ease-in-out infinite;
        will-change: transform, opacity;
      }

      .orb-rays-spin {
        transform-origin: 32px 32px;
        animation: spinSlow 24s linear infinite;
      }

      .orb-star-twinkle {
        animation: twinkleStar 2.4s ease-in-out infinite;
      }

      .cloud-sky-canvas {
        contain: layout style paint;
      }
    `,
  ],
  template: `
    <div class="overflow-x-auto pb-1">
      <div
        class="relative bg-surface-container-lowest dark:bg-[#1b1e2a] rounded-3xl border-2 shadow-sm p-4 sm:p-5 min-h-[620px] min-w-[920px] flex flex-col justify-between transition-colors"
        [class]="currentVibe().stageBorderClass"
      >

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
            <!-- NOW Indicator Mode Switcher -->
            <div
              class="inline-flex items-center p-0.5 rounded-full bg-surface-container-high/90 border border-outline-variant/30 shadow-2xs"
              role="group"
              aria-label="Стиль индикатора «Сейчас»"
            >
              <button
                type="button"
                (click)="setNowIndicatorMode('beam')"
                class="px-2.5 py-1 rounded-full text-[11px] font-bold font-label-ui flex items-center gap-1 transition-all cursor-pointer"
                [class]="
                  nowIndicatorMode() === 'beam'
                    ? 'bg-amber-400/25 text-amber-900 dark:text-amber-200 shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                "
                title="Классический вертикальный луч времени"
              >
                <span>☀️</span>
                <span>Луч</span>
              </button>
              <button
                type="button"
                (click)="setNowIndicatorMode('orb')"
                class="px-2.5 py-1 rounded-full text-[11px] font-bold font-label-ui flex items-center gap-1 transition-all cursor-pointer"
                [class]="
                  nowIndicatorMode() === 'orb'
                    ? 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                "
                title="Небесный шар: идёт по дуге дня и превращается между луной и солнцем"
              >
                <span>🌗</span>
                <span>Светило</span>
              </button>
            </div>

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
        <div
          #skyCanvas
          (click)="onSkyCanvasClick($event)"
          (mousemove)="onSkyMouseMove($event)"
          (mouseleave)="hoverTimePreview.set(null)"
          [class.cursor-crosshair]="canPost()"
          class="cloud-sky-canvas relative z-10 flex-1 my-4 min-h-[540px] flex flex-col justify-end min-w-[900px] px-8 pb-4 pt-4 rounded-3xl overflow-hidden border border-outline-variant/20 shadow-inner isolate"
        >
          <!-- 1. DYNAMIC SKY GRADIENT & TIME-OF-DAY ATMOSPHERIC SECTORS -->
          <div class="absolute inset-0 pointer-events-none -z-10" [class]="currentVibe().skyGradient">
            <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/40 dark:to-slate-950/50"></div>

            <!-- Sector 1: Morning (08:00 — 12:00 = 25% width) -->
            <div class="absolute inset-y-0 left-0 w-[25%] flex flex-col justify-end p-3 border-r-2 border-dashed border-amber-500/35 pointer-events-none">
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[0] }}</div>
            </div>

            <!-- Sector 2: Midday / Afternoon (12:00 — 17:00 = 31.25% width) -->
            <div class="absolute inset-y-0 left-[25%] w-[31.25%] flex flex-col justify-end p-3 border-r-2 border-dashed border-sky-500/35 pointer-events-none">
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[1] }}</div>
            </div>

            <!-- Sector 3: Evening / Sunset (17:00 — 21:00 = 25% width) -->
            <div class="absolute inset-y-0 left-[56.25%] w-[25%] flex flex-col justify-end p-3 border-r-2 border-dashed border-purple-500/35 pointer-events-none">
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[2] }}</div>
            </div>

            <!-- Sector 4: Night / Starlight (21:00 — 24:00 = 18.75% width) -->
            <div class="absolute inset-y-0 left-[81.25%] right-0 flex flex-col justify-end p-3 pointer-events-none">
              <div class="text-3xl opacity-15 self-center mb-16 select-none">{{ currentVibe().atmosphereEmoji[3] }}</div>
            </div>
          </div>

          <!-- SECTOR LABELS OVERLAY (above NOW beam z-[2], below message cards z-10) -->
          <div class="absolute inset-x-0 top-0 pointer-events-none z-[5]">
            <div class="absolute top-0 left-0 w-[25%] p-3">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 border border-amber-400/40 text-[10px] font-bold font-label-code-sm shadow-2xs">
                <span>🌅</span>
                <span>Утро (08:00 — 12:00)</span>
              </div>
            </div>
            <div class="absolute top-0 left-[25%] w-[31.25%] p-3">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100/95 dark:bg-sky-950/90 text-sky-900 dark:text-sky-200 border border-sky-400/40 text-[10px] font-bold font-label-code-sm shadow-2xs">
                <span>☀️</span>
                <span>День (12:00 — 17:00)</span>
              </div>
            </div>
            <div class="absolute top-0 left-[56.25%] w-[25%] p-3">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100/95 dark:bg-purple-950/90 text-purple-900 dark:text-purple-200 border border-purple-400/40 text-[10px] font-bold font-label-code-sm shadow-2xs">
                <span>🌆</span>
                <span>Вечер (17:00 — 21:00)</span>
              </div>
            </div>
            <div class="absolute top-0 left-[81.25%] right-0 p-3">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100/95 dark:bg-indigo-950/90 text-indigo-900 dark:text-indigo-200 border border-indigo-400/40 text-[10px] font-bold font-label-code-sm shadow-2xs">
                <span>🌙</span>
                <span>Ночь (21:00 — 24:00)</span>
              </div>
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

          <!-- CELESTIAL ORB SKY ARC ("Светило": Moon ↔ Sun travelling across the day) -->
          @if (isTodaySelected() && nowIndicatorMode() === 'orb') {
            @if (celestialOrb(); as orb) {
              <div class="absolute inset-x-8 top-11 bottom-6 pointer-events-none z-[4]">
                <!-- Parabolic day orbit trail -->
                <svg
                  viewBox="0 0 1000 400"
                  preserveAspectRatio="none"
                  class="absolute inset-0 w-full h-full overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient [attr.id]="orbTrailGradId" gradientUnits="userSpaceOnUse" x1="-50" y1="0" x2="1050" y2="0">
                      <stop offset="0%" stop-color="#cbd5e1" stop-opacity="0" />
                      <stop offset="8%" stop-color="#cbd5e1" stop-opacity="0.55" />
                      <stop offset="30%" stop-color="#fbbf24" stop-opacity="0.75" />
                      <stop offset="65%" stop-color="#f97316" stop-opacity="0.75" />
                      <stop offset="92%" stop-color="#818cf8" stop-opacity="0.6" />
                      <stop offset="100%" stop-color="#818cf8" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                  <!-- Stretched endless sky arc resting along the horizon line at both canvas edges -->
                  <path
                    [attr.d]="celestialFullArcPath"
                    fill="none"
                    [attr.stroke]="'url(#' + orbTrailGradId + ')'"
                    stroke-width="2"
                    stroke-dasharray="6 8"
                    opacity="0.35"
                  />
                  <!-- Traveled arc from off-canvas edge right up to the orb -->
                  <path
                    [attr.d]="orb.traveledArcPath"
                    fill="none"
                    [attr.stroke]="'url(#' + orbTrailGradId + ')'"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </svg>

                <!-- Subtle tether line down to road bar -->
                <div
                  class="absolute bottom-0 -translate-x-1/2 w-0.5 border-l-2 border-dashed border-amber-500/40 dark:border-indigo-300/35"
                  [style.left.%]="orb.leftPercent"
                  [style.height.%]="orb.bottomPercent"
                ></div>

                <!-- Morphing Moon ↔ Sun Celestial Orb -->
                <div
                  class="absolute -translate-x-1/2 translate-y-1/2 pointer-events-auto group/orb cursor-default"
                  [style.left.%]="orb.leftPercent"
                  [style.bottom.%]="orb.bottomPercent"
                >
                  <div
                    class="relative w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover/orb:scale-110"
                    [style.filter]="'drop-shadow(0 0 12px ' + orb.glowColor + ')'"
                  >
                    <svg viewBox="0 0 64 64" class="w-14 h-14 overflow-visible" aria-hidden="true">
                      <defs>
                        <radialGradient [attr.id]="orbCoreGradId" cx="35%" cy="35%" r="70%">
                          <stop offset="0%" [attr.stop-color]="orb.coreColor" />
                          <stop offset="100%" [attr.stop-color]="orb.edgeColor" />
                        </radialGradient>
                        <mask [attr.id]="orbMaskId">
                          <rect x="0" y="0" width="64" height="64" fill="black" />
                          <circle cx="32" cy="32" r="18" fill="white" />
                          <circle [attr.cx]="orb.maskCx" [attr.cy]="orb.maskCy" r="16.5" fill="black" />
                        </mask>
                      </defs>

                      <!-- Soft outer halo -->
                      <circle cx="32" cy="32" r="23" [attr.fill]="orb.glowColor" opacity="0.35" />

                      <!-- Cartoon sun rays (fade in for morning/day, out for sunset/night) -->
                      @if (orb.sunRaysOpacity > 0.02) {
                        <g class="orb-rays-spin" [style.opacity]="orb.sunRaysOpacity">
                          @for (angle of [0, 45, 90, 135, 180, 225, 270, 315]; track angle) {
                            <rect
                              x="30.2"
                              y="4"
                              width="3.6"
                              height="7"
                              rx="1.8"
                              [attr.fill]="orb.edgeColor"
                              stroke="#ffffff"
                              stroke-width="1"
                              [attr.transform]="'rotate(' + angle + ' 32 32)'"
                            />
                          }
                        </g>
                      }

                      <!-- Night twinkling stars -->
                      @if (orb.starsOpacity > 0.02) {
                        <g [style.opacity]="orb.starsOpacity">
                          <path
                            d="M 10 14 L 11.5 18 L 15.5 19.5 L 11.5 21 L 10 25 L 8.5 21 L 4.5 19.5 L 8.5 18 Z"
                            fill="#fef08a"
                            class="orb-star-twinkle"
                          />
                          <path
                            d="M 54 12 L 55 15 L 58 16 L 55 17 L 54 20 L 53 17 L 50 16 L 53 15 Z"
                            fill="#e0e7ff"
                            class="orb-star-twinkle"
                          />
                          <circle cx="52" cy="50" r="1.8" fill="#fef08a" class="orb-star-twinkle" />
                        </g>
                      }

                      <!-- White sticker backing border behind masked Moon/Sun -->
                      <circle
                        cx="32"
                        cy="32"
                        r="19.5"
                        fill="#ffffff"
                        opacity="0.9"
                        [attr.mask]="'url(#' + orbMaskId + ')'"
                      />

                      <!-- Main Moon ↔ Sun disc -->
                      <g [attr.mask]="'url(#' + orbMaskId + ')'">
                        <circle cx="32" cy="32" r="18" [attr.fill]="'url(#' + orbCoreGradId + ')'" />
                        <!-- Playful highlight -->
                        <ellipse cx="25" cy="24" rx="5" ry="3" fill="#ffffff" opacity="0.45" transform="rotate(-25 25 24)" />
                        <!-- Subtle cartoon moon craters when in crescent phase -->
                        @if (orb.moonFactor > 0.2) {
                          <g [style.opacity]="orb.moonFactor * 0.45">
                            <circle cx="23" cy="36" r="2.8" fill="#94a3b8" />
                            <circle cx="38" cy="39" r="2" fill="#94a3b8" />
                            <circle cx="29" cy="22" r="1.6" fill="#94a3b8" />
                          </g>
                        }
                      </g>
                    </svg>
                  </div>

                  <!-- Hover info pill -->
                  <div class="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2.5 py-1 rounded-full bg-surface-container-lowest/95 dark:bg-slate-900/95 border border-outline-variant/40 shadow-md text-[10px] font-bold font-label-code-sm text-on-surface whitespace-nowrap opacity-0 group-hover/orb:opacity-100 transition-opacity pointer-events-none">
                    {{ orb.phaseEmoji }} {{ orb.phaseLabel }} · {{ nowTimeText() }} · {{ orbDayProgressPercent() }}% дня
                  </div>
                </div>
              </div>
            }
          }

          <!-- HOVER TIME GUIDE LINE -->
          @if (canPost() && hoverTimePreview(); as preview) {
            <div
              class="absolute top-12 bottom-10 -translate-x-1/2 pointer-events-none z-[3] flex flex-col items-center justify-end"
              [style.left.%]="preview.leftPercent"
            >
              <div class="w-0 flex-1 border-l-2 border-dashed border-primary/45"></div>
              <span class="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-mono font-bold shadow-md whitespace-nowrap mb-1">
                + {{ preview.time }}
              </span>
            </div>
          }

          @if (clusters().length === 0 && !draftTime()) {
            <div class="my-auto mx-auto px-6 py-5 rounded-3xl bg-white/85 dark:bg-slate-900/80 border border-outline-variant/40 shadow-md text-center max-w-md z-10 pointer-events-none">
              <div class="text-3xl mb-2">☁️</div>
              <p class="text-xs font-bold text-on-surface mb-1">Облако пока пустое</p>
              <p class="text-[11px] text-on-surface-variant">
                @if (canPost()) {
                  Кликните в любое место графика или по нижней шкале времени, чтобы сразу создать и отредактировать сообщение.
                } @else {
                  Записей за выбранный период пока нет.
                }
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
                  data-cloud-interactive="true"
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
                    (click)="openInspectModal(note, $event)"
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
                      «<app-hashtag-text [text]="note.text" [activeTag]="activeTagFilter()" (hashtagClick)="tagClick.emit($event)" />»
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
                        @if (getDisplayTags(note); as displayTags) {
                          @if (displayTags.length > 0) {
                            <div class="flex items-center gap-1 min-w-0 flex-wrap" (click)="$event.stopPropagation()">
                              @for (tag of displayTags.slice(0, 2); track tag) {
                                <button
                                  type="button"
                                  (click)="onTagChipClick(tag, $event)"
                                  class="text-[9px] font-mono px-1.5 py-0.2 rounded-full transition-colors cursor-pointer truncate max-w-[90px]"
                                  [class]="
                                    activeTagFilter() === tag
                                      ? 'bg-primary text-on-primary font-bold'
                                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                                  "
                                  [title]="'Фильтровать по хештегу #' + tag"
                                >
                                  #{{ tag }}
                                </button>
                              }
                              @if (displayTags.length > 2) {
                                <span class="text-[9px] font-mono text-outline">+{{ displayTags.length - 2 }}</span>
                              }
                            </div>
                          }
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
                <div
                  data-cloud-interactive="true"
                  class="flex flex-col items-center pointer-events-auto cursor-pointer"
                  (click)="openInspectModal(note, $event)"
                >
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

          <!-- INTERACTIVE DRAFT BUBBLE (CREATED ON CHART CLICK & IMMEDIATELY EDITABLE) -->
          @if (draftTime(); as activeDraftTime) {
            @if (draftActorView(); as actorView) {
              <div
                data-cloud-interactive="true"
                (click)="$event.stopPropagation()"
                (keydown.escape)="onDraftEscape($event)"
                class="absolute bottom-14 -translate-x-1/2 flex flex-col items-center z-40 pointer-events-none"
                [style.left.%]="getTimelinePercent(draftTimeMinutes())"
              >
                <!-- 1. LIVE EDITABLE BUBBLE CARD -->
                <div
                  class="relative w-[290px] sm:w-[340px] pointer-events-auto thought-pop"
                  [style.translate]="getBubbleShiftPercent(draftTimeMinutes(), 22, 48) + '% 0'"
                >
                  <div
                    class="relative p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border-2 border-primary ring-4 ring-primary/15 w-full flex flex-col gap-2"
                  >
                    <!-- Draft Header -->
                    <div class="flex items-center justify-between gap-1.5 flex-wrap">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <app-actor-avatar
                          [avatar]="actorView.avatarIcon"
                          containerClass="w-7 h-7 rounded-xl shadow-xs ring-2 ring-primary/30 flex-shrink-0"
                        />
                        <div class="flex flex-col min-w-0">
                          <div class="flex items-center gap-1">
                            <span class="text-xs font-bold text-on-surface truncate max-w-[110px]">
                              {{ actorView.name }}
                            </span>
                            <span class="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[9px] font-mono font-bold">
                              Новая
                            </span>
                          </div>
                          @if (showAllDates()) {
                            <span class="text-[9px] font-mono text-outline">{{ selectedDateKey() }}</span>
                          }
                        </div>
                      </div>

                      <div class="flex items-center gap-1 flex-shrink-0">
                        <app-time-picker-popover
                          [time]="activeDraftTime"
                          (timeChange)="draftTime.set($event)"
                          placement="up"
                          ariaLabel="Время новой записи"
                        />
                        <button
                          type="button"
                          (click)="cancelDraftNote()"
                          aria-label="Отменить создание записи"
                          title="Отменить (Esc)"
                          class="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
                        >
                          <span class="material-symbols-rounded text-base leading-none">close</span>
                        </button>
                      </div>
                    </div>

                    <!-- Type Switcher + Optional Title -->
                    <div class="flex items-center gap-1.5">
                      <div class="inline-flex items-center p-0.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex-shrink-0">
                        @for (t of draftEntryTypes; track t.value) {
                          <button
                            type="button"
                            (click)="draftType.set(t.value)"
                            class="px-1.5 py-0.5 rounded-md text-xs transition-colors cursor-pointer"
                            [class]="
                              draftType() === t.value
                                ? 'bg-primary text-on-primary shadow-2xs'
                                : 'text-on-surface-variant hover:text-on-surface'
                            "
                            [title]="t.label"
                            [attr.aria-label]="t.label"
                          >
                            {{ t.emoji }}
                          </button>
                        }
                      </div>

                      <input
                        type="text"
                        [ngModel]="draftTitle()"
                        (ngModelChange)="draftTitle.set($event)"
                        placeholder="Заголовок (опционально)"
                        class="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary/60"
                      />
                    </div>

                    <!-- Autofocused Message Textarea -->
                    <textarea
                      #draftTextarea
                      [ngModel]="draftText()"
                      (ngModelChange)="draftText.set($event)"
                      (keydown)="onDraftKeydown($event)"
                      rows="3"
                      placeholder="Напишите сообщение... (можно #хештеги, Enter — сохранить)"
                      class="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface leading-snug resize-y focus:outline-none focus:border-primary/60"
                    ></textarea>

                    <!-- Hashtag Selector -->
                    <app-hashtag-multiselect
                      [options]="hashtagOptions()"
                      [selectedTags]="draftSelectedTags()"
                      (selectedTagsChange)="draftSelectedTags.set($event)"
                      placement="up"
                      placeholder="Хештеги (#тег)..."
                      searchPlaceholder="Поиск или новый #хештег..."
                      ariaLabel="Хештеги новой записи"
                    />

                    @if (draftPreviewTags().length > 0) {
                      <div class="flex flex-wrap items-center gap-1">
                        @for (tag of draftPreviewTags(); track tag) {
                          <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-semibold">
                            #{{ tag }}
                          </span>
                        }
                      </div>
                    }

                    <!-- Footer Actions -->
                    <div class="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/20">
                      <span class="text-[10px] font-mono text-outline">
                        Enter — сохранить · Esc — отмена
                      </span>
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="cancelDraftNote()"
                          class="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          (click)="saveDraftNote()"
                          [disabled]="!draftText().trim()"
                          class="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-45 text-on-primary text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                        >
                          <span class="material-symbols-rounded text-xs leading-none">check</span>
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>

                    <!-- Triangular bottom tail pointing to candlestick column -->
                    <div
                      class="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-b-2 border-r-2 border-primary"
                      [style.left]="'calc(50% - ' + getBubbleShiftPercent(draftTimeMinutes(), 22, 48) + '%)'"
                    ></div>
                  </div>
                </div>

                <!-- 2. DRAFT CANDLESTICK STEM -->
                <div class="w-1.5 h-12 rounded-full bg-gradient-to-t from-primary via-primary/70 to-primary/40 shadow-xs my-0.5 pointer-events-none"></div>

                <!-- 3. DRAFT BASE PIN ON THE TIMELINE ROAD -->
                <div class="flex flex-col items-center pointer-events-auto">
                  <div class="w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary/30 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                    <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                  </div>
                  <span class="text-[9px] font-mono font-bold text-on-primary bg-primary px-1.5 py-0.2 rounded shadow-xs mt-0.5 whitespace-nowrap">
                    {{ activeDraftTime }}
                  </span>
                </div>
              </div>
            }
          }

          <!-- THE BOTTOM TIMELINE AXIS (ROAD BAR) -->
          <div class="relative w-full mt-auto pt-8 pb-1">
            <div
              #timelineRoadBar
              (click)="onTimelineRoadClick($event)"
              (mousemove)="onTimelineRoadMouseMove($event)"
              [class.cursor-pointer]="canPost()"
              class="relative w-full h-5 rounded-full bg-gradient-to-r from-amber-400 via-orange-300 via-sky-400 to-indigo-500 shadow-inner flex items-center group"
              [title]="canPost() ? 'Кликните в любую точку графика или шкалы, чтобы создать и отредактировать сообщение' : 'Шкала времени (08:00 — 24:00)'"
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
                @if (nowIndicatorMode() === 'beam') {
                  <!-- Vertical NOW beam (behind sector pills z-[5] and message cards z-10) -->
                  <div
                    class="absolute bottom-2.5 -translate-x-1/2 w-1.5 h-[1200px] rounded-full bg-gradient-to-t from-amber-500 via-amber-400/80 to-amber-300/20 ring-1 ring-white/40 shadow-[0_0_10px_rgba(245,158,11,0.45)] pointer-events-none z-[2]"
                    [style.left.%]="nowTimePercent()"
                  ></div>

                  <!-- Sun & badge pin on the road bar -->
                  <div
                    class="absolute bottom-[-16px] -translate-x-1/2 flex flex-col items-center pointer-events-none z-20"
                    [style.left.%]="nowTimePercent()"
                  >
                    <div class="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-xs now-sun-glow relative z-10">
                      ☀️
                    </div>
                    <span class="text-[9px] font-label-code-sm font-extrabold text-amber-900 dark:text-amber-200 bg-amber-300 dark:bg-amber-600 px-1.5 py-0.2 rounded-full shadow-xs -mt-1 whitespace-nowrap relative z-10">
                      Сейчас {{ nowTimeText() }}
                    </span>
                  </div>
                } @else {
                  <!-- Compact road-bar anchor pin for Celestial Orb mode -->
                  @if (celestialOrb(); as orb) {
                    <div
                      class="absolute bottom-[-16px] -translate-x-1/2 flex flex-col items-center pointer-events-none z-20"
                      [style.left.%]="orb.leftPercent"
                    >
                      <div
                        class="w-4 h-4 rounded-full border-2 border-white shadow-md now-sun-glow relative z-10"
                        [style.background]="'radial-gradient(circle at 35% 35%, ' + orb.coreColor + ', ' + orb.edgeColor + ')'"
                      ></div>
                      <span
                        class="text-[9px] font-label-code-sm font-extrabold px-1.5 py-0.2 rounded-full shadow-xs mt-0.5 whitespace-nowrap relative z-10"
                        [class]="orb.badgeClasses"
                      >
                        {{ orb.phaseEmoji }} {{ nowTimeText() }}
                      </span>
                    </div>
                  }
                }
              }
            </div>
          </div>
        </div>

        <!-- In-Cloud Bottom Info Strip -->
        <div class="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-amber-200/50 dark:border-outline-variant/30 text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <span class="text-base">✨</span>
            <span>
              @if (canPost()) {
                Кликните в любую точку графика или шкалы, чтобы сразу создать и отредактировать сообщение, или по облачку для деталей.
              } @else {
                Каждое сообщение прикреплено столбцом ко времени на нижней шкале. Кликните по облачку для деталей.
              }
            </span>
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
                  [ngModel]="editTextDraft()"
                  (ngModelChange)="editTextDraft.set($event)"
                  rows="4"
                  placeholder="Текст сообщения... (можно писать #хештеги)"
                  class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[13px] text-on-surface leading-snug resize-y"
                ></textarea>
                <app-hashtag-multiselect
                  [options]="hashtagOptions()"
                  [selectedTags]="editSelectedTags()"
                  (selectedTagsChange)="editSelectedTags.set($event)"
                  placeholder="Доп. #хештеги..."
                  searchPlaceholder="Поиск или новый #хештег..."
                  ariaLabel="Редактирование хештегов сообщения"
                />
                @if (editPreviewTags().length > 0) {
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="text-[10px] font-mono text-outline">Хештеги:</span>
                    @for (tag of editPreviewTags(); track tag) {
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                        #{{ tag }}
                      </span>
                    }
                  </div>
                }
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
                    [disabled]="!editTextDraft().trim()"
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

              <p class="text-[13px] text-on-surface leading-snug whitespace-pre-line">
                <app-hashtag-text [text]="note.text" [activeTag]="activeTagFilter()" (hashtagClick)="onModalTagClick($event)" />
              </p>
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

            @if (getDisplayTags(note); as displayTags) {
              @if (displayTags.length > 0) {
                <div class="flex flex-wrap gap-1">
                  @for (tag of displayTags; track tag) {
                    <button
                      type="button"
                      (click)="onModalTagClick(tag)"
                      class="text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                      [class]="
                        activeTagFilter() === tag
                          ? 'bg-primary text-on-primary font-bold'
                          : 'bg-primary/10 text-primary hover:bg-primary/20 font-semibold'
                      "
                      [title]="'Фильтровать по хештегу #' + tag"
                    >
                      #{{ tag }}
                    </button>
                  }
                </div>
              }
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
  readonly activeTagFilter = input<string | null>(null);
  readonly hashtagOptions = input<HashtagSelectOption[]>([]);
  readonly defaultActor = input<ArenaActorCard | null>(null);

  readonly timeSelected = output<string>();
  readonly createNote = output<{
    time: string;
    type: CloudItemType;
    title?: string;
    text: string;
    tags?: string[];
  }>();
  readonly deleteNote = output<string>();
  readonly editNote = output<{ noteId: string; title?: string; text: string; tags?: string[] }>();
  readonly crossLinkNote = output<CloudDayNote>();
  readonly jumpToCrossRef = output<TimelineNodeCrossRef>();
  readonly tagClick = output<string>();

  protected readonly hourMilestones = CLOUD_HOUR_MILESTONES;
  protected readonly vibes = CLOUD_DAY_VIBES;
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
  readonly clusterActiveIndices = signal<Record<string, number>>({});
  readonly inspectedNote = signal<CloudDayNote | null>(null);
  readonly isEditingInspectedNote = signal<boolean>(false);
  editTitleDraft = '';
  readonly editTextDraft = signal<string>('');
  readonly editSelectedTags = signal<string[]>([]);
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
  private static readonly NOW_MODE_STORAGE_KEY = 'lemon.timeline.nowIndicatorMode';
  private static nextOrbUid = 0;

  protected readonly orbUid = ++TimelineCloudViewComponent.nextOrbUid;
  protected readonly orbMaskId = `celestial-orb-mask-${this.orbUid}`;
  protected readonly orbCoreGradId = `celestial-orb-core-${this.orbUid}`;
  protected readonly orbTrailGradId = `celestial-orb-trail-${this.orbUid}`;
  protected readonly celestialFullArcPath = CELESTIAL_ORB_FULL_ARC_PATH;

  readonly nowIndicatorMode = signal<CloudNowIndicatorMode>(this.loadNowIndicatorMode());
  readonly nowMinutes = signal<number>(this.getCurrentMinutes());

  readonly nowTimePercent = computed<number>(() => getTimelinePercent(this.nowMinutes()));

  readonly nowTimeText = computed<string>(() => {
    const mins = this.nowMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  readonly celestialOrb = computed<CelestialOrbState>(() => getCelestialOrbState(this.nowMinutes()));

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
    this.draftTime.set(formattedTime);
  }

  cancelDraftNote(): void {
    this.draftTime.set(null);
    this.draftType.set('thought');
    this.draftTitle.set('');
    this.draftText.set('');
    this.draftSelectedTags.set([]);
  }

  saveDraftNote(): void {
    const time = this.draftTime();
    const text = this.draftText().trim();
    if (!time || !text || !this.canPost()) return;
    const title = this.draftTitle().trim() || undefined;
    const tags = mergeNoteTags(text, this.draftSelectedTags());
    this.createNote.emit({
      time,
      type: this.draftType(),
      title,
      text,
      tags,
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
  }

  closeInspectModal(): void {
    this.cancelEditInspectedNote();
    this.inspectedNote.set(null);
  }

  startEditInspectedNote(note: CloudDayNote): void {
    this.editTitleDraft = note.title || '';
    this.editTextDraft.set(note.text || '');
    this.editSelectedTags.set(getExtraTagsNotInText(note.text || '', note.tags));
    this.isEditingInspectedNote.set(true);
  }

  cancelEditInspectedNote(): void {
    this.isEditingInspectedNote.set(false);
    this.editTitleDraft = '';
    this.editTextDraft.set('');
    this.editSelectedTags.set([]);
  }

  saveEditedInspectedNote(note: CloudDayNote): void {
    const nextText = this.editTextDraft().trim();
    if (!nextText) return;
    const nextTitle = this.editTitleDraft.trim() || undefined;
    const mergedTags = mergeNoteTags(nextText, this.editSelectedTags());
    this.editNote.emit({
      noteId: note.id,
      title: nextTitle,
      text: nextText,
      tags: mergedTags,
    });
    this.inspectedNote.set({
      ...note,
      title: nextTitle,
      text: nextText,
      tags: mergedTags,
    });
    this.cancelEditInspectedNote();
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
