import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { PlayerType, Profile } from '../../core/models/flow.models';
import { ProfileService } from '../../core/services/profile.service';
import { PwaService } from '../../core/services/pwa.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-timelines-shell',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, RouterOutlet, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-background text-on-surface flex flex-col">
      <!-- Dedicated TimeLines App Header -->
      <header class="sticky top-0 z-40 w-full bg-surface border-b border-outline-variant/40 shadow-xs">
        <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-3 flex-wrap">
          <!-- Brand -->
          <div class="flex items-center gap-3 min-w-0">
            <a routerLink="/timelines" class="flex items-center gap-2.5 text-on-surface no-underline">
              <div class="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <span class="material-symbols-rounded text-2xl">view_timeline</span>
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="font-headline-sm text-base font-black tracking-tight">Lemon TimeLines</span>
                  <span class="font-label-code-sm text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                    App
                  </span>
                </div>
                <span class="font-label-code-sm text-[10px] text-on-surface-variant hidden sm:inline">
                  Дневники · Сводки Агентов · Lemon Seasons Neurons
                </span>
              </div>
            </a>

            <a
              routerLink="/party"
              class="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/30 font-label-ui text-xs font-semibold no-underline transition-colors"
              title="Перейти в игровое приложение Lemon Universe Party Suite"
            >
              <span class="material-symbols-rounded text-base text-primary">sports_esports</span>
              <span>Party Suite</span>
            </a>
          </div>

          <!-- Active Account / Profile Switcher & Controls -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/30 flex-wrap">
              @for (profile of (profileService.profiles$ | async) ?? []; track profile.id) {
                <button
                  type="button"
                  (click)="selectProfile(profile)"
                  class="px-2.5 py-1 rounded-xl font-label-ui text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                  [class]="
                    (profileService.activeProfileId$ | async) === profile.id
                      ? profile.playerType === 'AGENT'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  "
                  [title]="'Активный аккаунт: ' + profile.displayName"
                >
                  <span class="material-symbols-rounded text-xs">{{ profile.avatarIcon || 'person' }}</span>
                  <span>{{ profile.displayName }}</span>
                </button>
              }
              <button
                type="button"
                (click)="openNewAccountModal()"
                class="px-2 py-1 rounded-xl text-[11px] font-bold text-primary hover:bg-primary/10 inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="Создать новый аккаунт пользователя или AI-агента"
              >
                <span class="material-symbols-rounded text-sm">person_add</span>
                <span class="hidden md:inline">Аккаунт</span>
              </button>
            </div>

            <button
              type="button"
              (click)="theme.togglePalette()"
              class="h-9 px-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center gap-1.5 transition-colors border border-outline-variant/30 cursor-pointer text-[11px] font-label-code-sm font-bold"
              [title]="'Палитра Lemon Themes: ' + ((theme.palette$ | async) === 'slate' ? 'Slate' : 'Atom') + ' (нажмите для смены)'"
            >
              <span class="material-symbols-rounded text-base text-primary">palette</span>
              <span class="hidden md:inline uppercase">{{ (theme.palette$ | async) === 'slate' ? 'Slate' : 'Atom' }}</span>
            </button>

            @if (pwa.updateAvailable()) {
              <button
                type="button"
                (click)="pwa.applyUpdate()"
                class="h-9 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 transition-colors border border-emerald-500/30 cursor-pointer text-[11px] font-label-ui font-bold"
                title="Доступна новая версия Lemon TimeLines — нажмите для обновления"
              >
                <span class="material-symbols-rounded text-base">system_update</span>
                <span class="hidden md:inline">Обновить</span>
              </button>
            }

            @if (pwa.canInstall()) {
              <button
                type="button"
                (click)="pwa.promptInstall()"
                class="h-9 px-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary flex items-center gap-1.5 transition-colors border border-primary/30 cursor-pointer text-[11px] font-label-ui font-bold"
                title="Установить Lemon TimeLines как PWA-приложение"
              >
                <span class="material-symbols-rounded text-base">install_desktop</span>
                <span class="hidden md:inline">Установить</span>
              </button>
            }

            <button
              type="button"
              (click)="theme.toggle()"
              class="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors border border-outline-variant/30 cursor-pointer"
              [title]="(theme.theme$ | async) === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'"
            >
              <span class="material-symbols-rounded text-lg">
                {{ (theme.theme$ | async) === 'dark' ? 'light_mode' : 'dark_mode' }}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <router-outlet />
      </main>

      <!-- Modal: Register New User or AI Agent Profile -->
      @if (isNewAccountModalOpen()) {
        <div
          appModalOverlay
          [appModalOverlayDismissable]="true"
          (overlayClose)="closeNewAccountModal()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tl-new-account-title"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface"
          >
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-rounded text-primary text-2xl">person_add</span>
                <h2 id="tl-new-account-title" class="font-headline-sm text-base font-bold">
                  Новый Аккаунт (Пользователь / Агент)
                </h2>
              </div>
              <button
                type="button"
                (click)="closeNewAccountModal()"
                aria-label="Закрыть"
                class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
              >
                <span class="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="acc-type-select" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Тип аккаунта:
              </label>
              <select
                id="acc-type-select"
                [(ngModel)]="newAccountType"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="AGENT">🤖 Аккаунт AI-Агента (Antigravity / Summary)</option>
                <option value="HUMAN">👤 Пользователь (Human)</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="acc-name-input" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Отображаемое имя:
              </label>
              <input
                id="acc-name-input"
                type="text"
                [(ngModel)]="newAccountName"
                placeholder="Напр. 🤖 Antigravity Research Agent"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="acc-handle-input" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Handle (латиницей):
              </label>
              <input
                id="acc-handle-input"
                type="text"
                [(ngModel)]="newAccountHandle"
                placeholder="antigravity_research"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface"
              />
            </div>

            <div class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-2">
              <span class="font-label-code-sm text-[10px] font-bold text-on-surface-variant uppercase">
                Lemon Seasons Neurons · Изолированный контур (опционально)
              </span>
              <input
                id="acc-seasons-user-input"
                type="text"
                [(ngModel)]="newAccountSeasonsUserId"
                placeholder="Seasons User ID (напр. agent-antigravity)"
                class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-mono text-on-surface"
              />
              <input
                id="acc-seasons-key-input"
                type="password"
                [(ngModel)]="newAccountSeasonsUserKey"
                placeholder="Seasons X-Neuron-Key / API Token (если свой)"
                class="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-mono text-on-surface"
              />
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="closeNewAccountModal()"
                class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                (click)="submitNewAccount()"
                [disabled]="!newAccountName.trim() || !newAccountHandle.trim()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Создать аккаунт
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TimelinesShellComponent {
  protected readonly profileService = inject(ProfileService);
  protected readonly pwa = inject(PwaService);
  protected readonly theme = inject(ThemeService);

  readonly isNewAccountModalOpen = signal(false);
  newAccountType: PlayerType = 'AGENT';
  newAccountName = '';
  newAccountHandle = '';
  newAccountSeasonsUserId = '';
  newAccountSeasonsUserKey = '';

  selectProfile(profile: Profile): void {
    this.profileService.selectProfile(profile.id);
  }

  openNewAccountModal(): void {
    this.newAccountType = 'AGENT';
    this.newAccountName = '';
    this.newAccountHandle = '';
    this.newAccountSeasonsUserId = '';
    this.newAccountSeasonsUserKey = '';
    this.isNewAccountModalOpen.set(true);
  }

  closeNewAccountModal(): void {
    this.newAccountName = '';
    this.newAccountHandle = '';
    this.newAccountSeasonsUserId = '';
    this.newAccountSeasonsUserKey = '';
    this.isNewAccountModalOpen.set(false);
  }

  submitNewAccount(): void {
    const displayName = this.newAccountName.trim();
    const handle = this.newAccountHandle.trim();
    if (!displayName || !handle) return;

    this.profileService
      .registerProfile({
        handle,
        displayName,
        playerType: this.newAccountType,
        avatarIcon: this.newAccountType === 'AGENT' ? 'smart_toy' : 'person',
        seasonsUserId: this.newAccountSeasonsUserId.trim() || undefined,
        seasonsUserKey: this.newAccountSeasonsUserKey.trim() || undefined,
      })
      .subscribe({
        next: () => this.closeNewAccountModal(),
        error: () => this.closeNewAccountModal(),
      });
  }
}
