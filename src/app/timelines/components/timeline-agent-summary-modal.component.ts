import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { ArenaActorCard, Profile, TimelineBoard } from '../../core/models/flow.models';

export interface AgentSummarySubmitPayload {
  agentProfileId: string;
  sourceBoardId: string;
  targetBoardId: string;
  actorId: string;
  title: string;
  text: string;
  tags: string[];
}

@Component({
  selector: 'app-timeline-agent-summary-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="onClose()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-agent-summary-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-violet-600 text-2xl">smart_toy</span>
              <div>
                <h2 id="tl-agent-summary-title" class="font-headline-sm text-base font-bold">
                  Сводка Агента (Antigravity → Основной Борд)
                </h2>
                <p class="text-[11px] text-on-surface-variant">
                  Агент публикует запись в свой TimeLine и отправляет кросс-ссылку на основной борд (если добавлен в members и совпадает приватность).
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="onClose()"
              aria-label="Закрыть"
              class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-xl">close</span>
            </button>
          </div>

          @if (errorMessage()) {
            <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-800 dark:text-rose-200 font-semibold">
              {{ errorMessage() }}
            </div>
          }

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label for="agent-prof-select" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Аккаунт агента:
              </label>
              <select
                id="agent-prof-select"
                [(ngModel)]="agentProfileDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                @for (prof of profiles(); track prof.id) {
                  <option [value]="prof.id">{{ prof.displayName }}</option>
                }
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label for="agent-actor-select" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Персонаж:
              </label>
              <select
                id="agent-actor-select"
                [(ngModel)]="actorDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                @for (actor of actors(); track actor.id) {
                  <option [value]="actor.id">{{ actor.name }}</option>
                }
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label for="agent-src-board" class="font-label-ui text-xs font-bold text-on-surface-variant">
                TimeLine Агента (источник сводки):
              </label>
              <select
                id="agent-src-board"
                [(ngModel)]="sourceBoardDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                @for (b of boards(); track b.id) {
                  <option [value]="b.id">[{{ b.privacy || 'PUBLIC' }}] {{ b.title }}</option>
                }
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label for="agent-tgt-board" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Основной борд (отправить ссылку):
              </label>
              <select
                id="agent-tgt-board"
                [(ngModel)]="targetBoardDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="">Без кросс-ссылки</option>
                @for (b of boards(); track b.id) {
                  <option [value]="b.id">[{{ b.privacy || 'PUBLIC' }}] {{ b.title }}</option>
                }
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label for="agent-sum-title" class="font-label-ui text-xs font-bold text-on-surface-variant">
              Заголовок сводки:
            </label>
            <input
              id="agent-sum-title"
              type="text"
              [(ngModel)]="titleDraft"
              placeholder="Напр. Сводка сессии Antigravity"
              class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label for="agent-sum-text" class="font-label-ui text-xs font-bold text-on-surface-variant">
              Текст сводки:
            </label>
            <textarea
              id="agent-sum-text"
              [(ngModel)]="textDraft"
              rows="3"
              placeholder="Что сделано, ключевые инсайты и ссылки..."
              class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface resize-none"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="!textDraft.trim()"
              class="px-4 py-2 rounded-xl bg-violet-600 text-white font-label-ui text-xs font-bold shadow-xs hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              🤖 Опубликовать сводку
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineAgentSummaryModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly boards = input<TimelineBoard[]>([]);
  readonly actors = input<ArenaActorCard[]>([]);
  readonly profiles = input<Profile[]>([]);
  readonly errorMessage = input<string | null>(null);

  readonly close = output<void>();
  readonly submitSummary = output<AgentSummarySubmitPayload>();

  agentProfileDraft = 'a7e49c10-9100-4b22-a811-9000a6e17001';
  actorDraft = 'actor-antigravity-agent';
  sourceBoardDraft = 'board-coding-sessions';
  targetBoardDraft = 'board-global-day';
  titleDraft = '';
  textDraft = '';

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const agentProf = this.profiles().find((p) => p.playerType === 'AGENT');
        if (agentProf) this.agentProfileDraft = agentProf.id;
        if (!this.boards().some((b) => b.id === this.sourceBoardDraft) && this.boards()[0]) {
          this.sourceBoardDraft = this.boards()[0].id;
        }
      } else {
        this.titleDraft = '';
        this.textDraft = '';
      }
    });
  }

  submit(): void {
    const text = this.textDraft.trim();
    if (!text) return;
    this.submitSummary.emit({
      agentProfileId: this.agentProfileDraft,
      sourceBoardId: this.sourceBoardDraft,
      targetBoardId: this.targetBoardDraft,
      actorId: this.actorDraft,
      title: this.titleDraft.trim() || 'Сводка Агента',
      text,
      tags: ['agent-summary', 'antigravity'],
    });
  }

  onClose(): void {
    this.titleDraft = '';
    this.textDraft = '';
    this.close.emit();
  }
}
