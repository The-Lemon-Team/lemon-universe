import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { CloudDayNote, TimelineBoard } from '../../core/models/flow.models';

@Component({
  selector: 'app-timeline-crosslink-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sourceNote(); as src) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="onClose()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-crosslink-modal-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[88vh] overflow-hidden"
        >
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-violet-600 text-2xl">add_link</span>
              <h2 id="tl-crosslink-modal-title" class="font-headline-sm text-base font-bold">
                Связать сообщение из другого TimeLine
              </h2>
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

          <div class="px-3 py-2 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-xs flex items-center justify-between gap-2">
            <span>
              Поле видимости:
              <strong>{{ sourceBoard()?.privacy === 'PRIVATE' ? '🔒 PRIVATE' : '🌐 PUBLIC' }}</strong>
            </span>
            <span class="text-[11px] text-on-surface-variant">
              Доступны только доски с тем же уровнем приватности
            </span>
          </div>

          <input
            type="text"
            [(ngModel)]="relationLabelDraft"
            placeholder="Подпись связи (необязательно, напр. «Сводка агента»)"
            class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
          />

          <div class="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            @for (candidate of candidates(); track candidate.id) {
              <button
                type="button"
                (click)="pickCandidate(candidate)"
                class="p-3 rounded-2xl bg-surface-container-low hover:bg-violet-500/10 border border-outline-variant/30 hover:border-violet-500/40 text-left flex flex-col gap-1.5 transition-colors cursor-pointer"
              >
                <div class="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span class="font-bold text-violet-700 dark:text-violet-300">
                    {{ getBoardTitle(candidate.boardId || 'board-global-day') }}
                  </span>
                  <span class="text-outline">{{ candidate.dateKey }} · {{ candidate.time }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <app-actor-avatar [avatar]="candidate.actorAvatar" containerClass="w-5 h-5 rounded-md flex-shrink-0" />
                  <span class="text-xs font-bold text-on-surface">{{ candidate.actorName }}</span>
                </div>
                <p class="text-xs text-on-surface-variant line-clamp-2">{{ candidate.text }}</p>
              </button>
            } @empty {
              <div class="p-6 text-center text-xs text-outline italic">
                Нет доступных сообщений в других TimeLine с тем же уровнем приватности ({{ sourceBoard()?.privacy || 'PUBLIC' }}).
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineCrossLinkModalComponent {
  readonly sourceBoard = input<TimelineBoard | null>(null);
  readonly sourceNote = input<CloudDayNote | null>(null);
  readonly candidates = input<CloudDayNote[]>([]);
  readonly boards = input<TimelineBoard[]>([]);

  readonly close = output<void>();
  readonly attach = output<{ targetNote: CloudDayNote; relationLabel: string }>();

  relationLabelDraft = '';

  getBoardTitle(boardId: string): string {
    return this.boards().find((b) => b.id === boardId)?.title || boardId;
  }

  pickCandidate(targetNote: CloudDayNote): void {
    this.attach.emit({
      targetNote,
      relationLabel: this.relationLabelDraft.trim(),
    });
    this.relationLabelDraft = '';
  }

  onClose(): void {
    this.relationLabelDraft = '';
    this.close.emit();
  }
}
