import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  BoardMemberRole,
  BoardPrivacy,
  Profile,
  TimelineBoard,
  TimelineBoardMode,
} from '../../core/models/flow.models';
import { roleLabel } from '../timelines.privacy';

@Component({
  selector: 'app-timeline-members-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen() && board(); as b) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="onClose()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-members-modal-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-primary text-2xl">group_add</span>
              <div>
                <h2 id="tl-members-modal-title" class="font-headline-sm text-base font-bold">
                  Участники (Members) и Приватность: {{ b.title }}
                </h2>
                <p class="text-[11px] text-on-surface-variant">
                  Добавьте пользователей или аккаунт AI-агентов (напр. Antigravity), чтобы они могли писать и присылать кросс-ссылки.
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

          <!-- Board Privacy & Mode Settings -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <div class="flex flex-col gap-1">
              <label for="tl-settings-privacy" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Поле видимости приватности:
              </label>
              <select
                id="tl-settings-privacy"
                [(ngModel)]="privacyDraft"
                [disabled]="!canManage()"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="PRIVATE">🔒 Приватный (PRIVATE)</option>
                <option value="PUBLIC">🌐 Публичный (PUBLIC)</option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label for="tl-settings-mode" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Режим борда:
              </label>
              <select
                id="tl-settings-mode"
                [(ngModel)]="modeDraft"
                [disabled]="!canManage()"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="DIARY">📓 Простой Дневник</option>
                <option value="TIMELINE">⏱️ TimeLine</option>
                <option value="AGENT_SUMMARY">🤖 Сводка Агентов</option>
                <option value="PARTY_CLOUD">☁️ Хроно-Облако</option>
              </select>
            </div>
          </div>

          <!-- Add Member Form -->
          @if (canManage()) {
            <div class="p-3.5 rounded-2xl bg-primary/5 border border-primary/25 flex flex-col gap-3">
              <span class="font-label-ui text-xs font-bold text-primary">
                + Добавить участника (Member) на этот борд
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  [(ngModel)]="newMemberProfileId"
                  aria-label="Выбрать аккаунт пользователя или агента"
                  class="sm:col-span-2 px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
                >
                  <option value="">Выберите аккаунт...</option>
                  @for (prof of profiles(); track prof.id) {
                    <option [value]="prof.id">
                      {{ prof.displayName }} ({{ prof.playerType || 'HUMAN' }})
                    </option>
                  }
                </select>

                <select
                  [(ngModel)]="newMemberRole"
                  aria-label="Роль участника"
                  class="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
                >
                  <option value="AGENT">🤖 AI-Агент (AGENT)</option>
                  <option value="MEMBER">👤 Участник (MEMBER)</option>
                  <option value="EDITOR">✏️ Редактор (EDITOR)</option>
                  <option value="VIEWER">👁️ Наблюдатель (VIEWER)</option>
                </select>
              </div>

              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-4 text-xs">
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="newMemberCanPost" />
                    <span>Может писать</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="newMemberCanCrossLink" />
                    <span>Может отправлять кросс-ссылки</span>
                  </label>
                </div>
                <button
                  type="button"
                  (click)="addMember()"
                  [disabled]="!newMemberProfileId"
                  class="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Добавить в Members
                </button>
              </div>
            </div>
          }

          <!-- Current Members List -->
          <div class="flex flex-col gap-2">
            <span class="font-label-ui text-xs font-bold text-on-surface-variant">
              Текущие участники ({{ (b.members || []).length }}):
            </span>
            @for (m of b.members || []; track m.profileId) {
              <div class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="material-symbols-rounded text-lg text-primary">
                    {{ m.role === 'AGENT' || m.profilePlayerType === 'AGENT' ? 'smart_toy' : 'person' }}
                  </span>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-bold truncate">
                      {{ resolveProfileName(m.profileId, m.profileDisplayName) }}
                    </span>
                    <span class="text-[10px] font-mono text-outline">
                      {{ getRoleLabel(m.role) }} · Запись: {{ m.canPost ? 'да' : 'нет' }} · Кросс-ссылки: {{ m.canCrossLink ? 'да' : 'нет' }}
                    </span>
                  </div>
                </div>

                @if (canManage() && b.ownerProfileId !== m.profileId) {
                  <button
                    type="button"
                    (click)="removeMember.emit(m.profileId)"
                    class="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                  >
                    Удалить
                  </button>
                }
              </div>
            } @empty {
              <p class="text-xs text-outline italic">Участники не назначены (доступ только у владельца).</p>
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
            @if (canManage()) {
              <button
                type="button"
                (click)="saveSettings()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-95 cursor-pointer"
              >
                Сохранить настройки
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineMembersModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly board = input<TimelineBoard | null>(null);
  readonly profiles = input<Profile[]>([]);
  readonly canManage = input<boolean>(false);

  readonly close = output<void>();
  readonly saveBoardSettings = output<{ privacy: BoardPrivacy; boardMode: TimelineBoardMode }>();
  readonly addOrUpdateMember = output<{
    profileId: string;
    role: BoardMemberRole;
    canPost: boolean;
    canCrossLink: boolean;
  }>();
  readonly removeMember = output<string>();

  privacyDraft: BoardPrivacy = 'PRIVATE';
  modeDraft: TimelineBoardMode = 'TIMELINE';
  newMemberProfileId = '';
  newMemberRole: BoardMemberRole = 'AGENT';
  newMemberCanPost = true;
  newMemberCanCrossLink = true;

  constructor() {
    effect(() => {
      const b = this.board();
      if (this.isOpen() && b) {
        this.privacyDraft = b.privacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
        this.modeDraft = b.boardMode || 'TIMELINE';
      }
    });
  }

  getRoleLabel(role: BoardMemberRole): string {
    return roleLabel(role);
  }

  resolveProfileName(profileId: string, fallback?: string): string {
    if (fallback) return fallback;
    return this.profiles().find((p) => p.id === profileId)?.displayName || profileId;
  }

  addMember(): void {
    if (!this.newMemberProfileId) return;
    this.addOrUpdateMember.emit({
      profileId: this.newMemberProfileId,
      role: this.newMemberRole,
      canPost: this.newMemberRole === 'VIEWER' ? false : this.newMemberCanPost,
      canCrossLink: this.newMemberRole === 'VIEWER' ? false : this.newMemberCanCrossLink,
    });
    this.newMemberProfileId = '';
  }

  saveSettings(): void {
    this.saveBoardSettings.emit({
      privacy: this.privacyDraft,
      boardMode: this.modeDraft,
    });
    this.onClose();
  }

  onClose(): void {
    this.newMemberProfileId = '';
    this.newMemberRole = 'AGENT';
    this.newMemberCanPost = true;
    this.newMemberCanCrossLink = true;
    this.close.emit();
  }
}
