import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { TimelineBoard } from '../../core/models/flow.models';
import { ApiService } from '../../core/services/api.service';

export interface ProjectariumLinkView {
  id: string;
  standSlug: string;
  label?: string | null;
  projectariumUrl?: string | null;
  tokenPrefix: string;
  scopes: string[];
  boardIds: string[];
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-timeline-projectarium-modal',
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
        aria-labelledby="tl-projectarium-modal-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-primary text-2xl">hub</span>
              <div>
                <h2 id="tl-projectarium-modal-title" class="font-headline-sm text-base font-bold">
                  Привязка Projectarium ↔ TimeLines
                </h2>
                <p class="text-[11px] text-on-surface-variant">
                  Выдайте токен стенду Projectarium, чтобы синхронизировать хронику и события в обе стороны.
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="onClose()"
              aria-label="Закрыть"
              class="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span class="material-symbols-rounded text-lg">close</span>
            </button>
          </div>

          @if (issuedToken(); as token) {
            <div class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-amber-300">
                  Токен создан — скопируйте сейчас, повторно он не показывается
                </span>
                <button
                  type="button"
                  (click)="copyToken(token)"
                  class="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-200 transition-colors"
                >
                  {{ copied() ? 'Скопировано' : 'Скопировать' }}
                </button>
              </div>
              <code class="text-xs break-all select-all bg-black/30 rounded-xl px-3 py-2 font-mono text-amber-100">
                {{ token }}
              </code>
            </div>
          }

          @if (errorMsg(); as err) {
            <div class="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
              {{ err }}
            </div>
          }

          <div class="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4 flex flex-col gap-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Новая привязка
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-on-surface-variant">Stand Slug *</span>
                <input
                  type="text"
                  [(ngModel)]="standSlug"
                  placeholder="lemon-universe"
                  class="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-on-surface-variant">URL стенда (опционально)</span>
                <input
                  type="text"
                  [(ngModel)]="projectariumUrl"
                  placeholder="http://localhost:4200/projectarium"
                  class="rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </label>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-xs text-on-surface-variant">Доступные TimeLine-доски *</span>
              <div class="flex flex-wrap gap-2">
                @for (b of boards(); track b.id) {
                  <button
                    type="button"
                    (click)="toggleBoard(b.id)"
                    [class]="
                      selectedBoardIds().includes(b.id)
                        ? 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary transition-colors'
                        : 'px-3 py-1.5 rounded-xl text-xs bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors'
                    "
                  >
                    {{ b.title }}
                  </button>
                }
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div class="flex items-center gap-4 text-xs">
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="scopeRead" />
                  <span>chronicle:read</span>
                </label>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="scopeWrite" />
                  <span>chronicle:write</span>
                </label>
              </div>
              <button
                type="button"
                [disabled]="saving()"
                (click)="createLink()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {{ saving() ? 'Создание...' : 'Выдать токен' }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <h3 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Активные привязки ({{ links().length }})
            </h3>
            @if (links().length === 0) {
              <p class="text-xs text-on-surface-variant py-2">Пока нет привязанных стендов Projectarium.</p>
            }
            @for (link of links(); track link.id) {
              <div class="rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold">{{ link.standSlug }}</span>
                    <code class="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {{ link.tokenPrefix }}…
                    </code>
                    @if (link.revokedAt) {
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error font-semibold">
                        Отозван
                      </span>
                    }
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    Доски: {{ link.boardIds.length }} · Права: {{ link.scopes.join(', ') }}
                  </div>
                </div>
                @if (!link.revokedAt) {
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="rotate(link.id)"
                      class="px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs transition-colors"
                    >
                      Ротировать
                    </button>
                    <button
                      type="button"
                      (click)="revoke(link.id)"
                      class="px-2.5 py-1 rounded-xl bg-error/15 hover:bg-error/25 text-error text-xs transition-colors"
                    >
                      Отозвать
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <div class="flex justify-end border-t border-outline-variant/20 pt-3">
            <button
              type="button"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-semibold hover:bg-surface-container-highest transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineProjectariumModalComponent {
  private readonly api = inject(ApiService);

  readonly isOpen = input(false);
  readonly boards = input<TimelineBoard[]>([]);
  readonly activeBoardId = input<string | null>(null);
  readonly actorProfileId = input<string | null>(null);
  readonly closed = output<void>();

  readonly links = signal<ProjectariumLinkView[]>([]);
  readonly selectedBoardIds = signal<string[]>([]);
  readonly issuedToken = signal<string | null>(null);
  readonly copied = signal(false);
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  standSlug = '';
  projectariumUrl = '';
  scopeRead = true;
  scopeWrite = true;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const activeId = this.activeBoardId();
        if (activeId && this.selectedBoardIds().length === 0) {
          this.selectedBoardIds.set([activeId]);
        }
        this.loadLinks();
      }
    });
  }

  onClose(): void {
    this.standSlug = '';
    this.projectariumUrl = '';
    this.scopeRead = true;
    this.scopeWrite = true;
    this.selectedBoardIds.set([]);
    this.issuedToken.set(null);
    this.copied.set(false);
    this.errorMsg.set(null);
    this.closed.emit();
  }

  toggleBoard(boardId: string): void {
    const cur = this.selectedBoardIds();
    this.selectedBoardIds.set(
      cur.includes(boardId) ? cur.filter((id) => id !== boardId) : [...cur, boardId],
    );
  }

  loadLinks(): void {
    this.api.listProjectariumLinks(this.actorProfileId()).subscribe({
      next: (rows) => this.links.set(rows || []),
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось загрузить привязки.'),
    });
  }

  createLink(): void {
    const slug = this.standSlug.trim();
    const boardIds = this.selectedBoardIds();
    const scopes: ('chronicle:read' | 'chronicle:write')[] = [];
    if (this.scopeRead) scopes.push('chronicle:read');
    if (this.scopeWrite) scopes.push('chronicle:write');

    if (!slug || boardIds.length === 0 || scopes.length === 0) {
      this.errorMsg.set('Укажите Stand Slug, хотя бы одну доску и хотя бы одно право.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set(null);
    this.api
      .createProjectariumLink(
        {
          standSlug: slug,
          boardIds,
          scopes,
          projectariumUrl: this.projectariumUrl.trim() || undefined,
        },
        this.actorProfileId(),
      )
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.issuedToken.set(res?.token || null);
          this.copied.set(false);
          this.loadLinks();
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(err?.error?.message || 'Ошибка создания привязки.');
        },
      });
  }

  rotate(linkId: string): void {
    this.api.rotateProjectariumLink(linkId, this.actorProfileId()).subscribe({
      next: (res) => {
        this.issuedToken.set(res?.token || null);
        this.copied.set(false);
        this.loadLinks();
      },
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось ротировать токен.'),
    });
  }

  revoke(linkId: string): void {
    this.api.revokeProjectariumLink(linkId, this.actorProfileId()).subscribe({
      next: () => this.loadLinks(),
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось отозвать токен.'),
    });
  }

  copyToken(token: string): void {
    navigator.clipboard?.writeText(token).then(() => this.copied.set(true));
  }
}
