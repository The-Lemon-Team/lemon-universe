import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from './actor-avatar.component';

export type CloudSelectTone = 'default' | 'amber' | 'emerald' | 'indigo' | 'violet' | 'rose';

export interface CloudSelectOption<T = string | null> {
  value: T;
  label: string;
  subtitle?: string;
  materialIcon?: string;
  emoji?: string;
  avatarIcon?: string;
  badge?: string | number;
  tone?: CloudSelectTone;
}

/**
 * Reusable site-themed dropdown select supporting Material icons, emojis,
 * character SVG avatars, optional search, and upward/downward placement.
 */
@Component({
  selector: 'app-cloud-themed-select',
  standalone: true,
  imports: [FormsModule, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block max-w-full">
      <!-- Trigger Button -->
      <button
        type="button"
        (click)="toggle($event)"
        class="group inline-flex items-center justify-between gap-2 border transition-colors cursor-pointer select-none max-w-full"
        [class]="resolvedTriggerClass()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="ariaLabel()"
        aria-haspopup="listbox"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          @if (prefixLabel()) {
            <span class="text-[11px] font-label-ui text-on-surface-variant font-medium flex-shrink-0">
              {{ prefixLabel() }}
            </span>
          }

          @if (selectedOption(); as active) {
            @if (active.avatarIcon) {
              <app-actor-avatar
                [avatar]="active.avatarIcon"
                [containerClass]="compact() ? 'w-4 h-4 rounded-md flex-shrink-0' : 'w-5 h-5 rounded-md flex-shrink-0'"
              />
            } @else if (active.emoji) {
              <span class="text-sm leading-none flex-shrink-0">{{ active.emoji }}</span>
            } @else if (active.materialIcon) {
              <span
                class="material-symbols-rounded flex-shrink-0"
                [class]="(compact() ? 'text-sm ' : 'text-base ') + getIconToneClass(active.tone)"
              >
                {{ active.materialIcon }}
              </span>
            }

            <span
              class="font-label-ui truncate"
              [class]="compact() ? 'text-xs font-semibold text-on-surface' : 'text-xs font-bold text-on-surface'"
            >
              {{ active.label }}
            </span>

            @if (active.badge !== undefined && active.badge !== null && active.badge !== '') {
              <span
                class="px-1.5 py-0.2 rounded-full text-[10px] font-label-code-sm font-bold flex-shrink-0"
                [class]="getBadgeToneClass(active.tone)"
              >
                {{ active.badge }}
              </span>
            }
          } @else {
            @if (placeholderIcon()) {
              <span
                class="material-symbols-rounded text-on-surface-variant flex-shrink-0"
                [class]="compact() ? 'text-sm' : 'text-base'"
              >
                {{ placeholderIcon() }}
              </span>
            }
            <span class="font-label-ui text-xs font-medium text-on-surface-variant truncate">
              {{ placeholder() }}
            </span>
          }
        </div>

        <div class="flex items-center gap-0.5 flex-shrink-0">
          @if (showClearButton()) {
            <span
              role="button"
              tabindex="0"
              (click)="clearSelection($event)"
              (keydown.enter)="clearSelection($event)"
              class="w-4 h-4 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
              title="Сбросить выбор"
              aria-label="Сбросить выбор"
            >
              <span class="material-symbols-rounded text-xs">close</span>
            </span>
          }

          <span
            class="material-symbols-rounded text-on-surface-variant transition-transform duration-150 flex-shrink-0"
            [class.rotate-180]="isOpen()"
            [class.text-sm]="compact()"
            [class.text-base]="!compact()"
          >
            expand_more
          </span>
        </div>
      </button>

      <!-- Click-outside Backdrop & Floating Dropdown Panel -->
      @if (isOpen()) {
        <div
          class="fixed inset-0 z-40"
          (click)="close()"
          aria-hidden="true"
        ></div>

        <div
          role="listbox"
          [attr.aria-label]="ariaLabel()"
          class="absolute z-50 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl p-1.5 flex flex-col gap-1 max-w-[calc(100vw-2rem)]"
          [class]="panelPositionClass() + ' ' + panelWidthClass()"
          (click)="$event.stopPropagation()"
        >
          @if (searchable()) {
            <div class="px-1 pt-0.5 pb-1 border-b border-outline-variant/20">
              <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
                <span class="material-symbols-rounded text-sm text-on-surface-variant">search</span>
                <input
                  type="text"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  [placeholder]="searchPlaceholder()"
                  class="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none"
                />
                @if (searchQuery()) {
                  <button
                    type="button"
                    (click)="searchQuery.set('')"
                    class="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center"
                    aria-label="Очистить поиск"
                  >
                    <span class="material-symbols-rounded text-xs">close</span>
                  </button>
                }
              </div>
            </div>
          }

          <div class="flex flex-col gap-0.5 max-h-64 overflow-y-auto pr-0.5">
            @for (opt of filteredOptions(); track trackOption($index, opt)) {
              <button
                type="button"
                role="option"
                [attr.aria-selected]="isSelected(opt)"
                (click)="selectOption(opt)"
                class="w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between gap-2.5 cursor-pointer group"
                [class]="
                  isSelected(opt)
                    ? 'bg-primary-container/35 text-on-surface font-bold border border-primary/30'
                    : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                "
              >
                <div class="flex items-center gap-2 min-w-0">
                  @if (opt.avatarIcon) {
                    <app-actor-avatar
                      [avatar]="opt.avatarIcon"
                      containerClass="w-7 h-7 rounded-xl flex-shrink-0 shadow-2xs"
                    />
                  } @else if (opt.emoji) {
                    <span class="w-7 h-7 rounded-xl bg-surface-container-high/70 flex items-center justify-center text-sm flex-shrink-0">
                      {{ opt.emoji }}
                    </span>
                  } @else if (opt.materialIcon) {
                    <span class="w-7 h-7 rounded-xl bg-surface-container-high/70 flex items-center justify-center flex-shrink-0">
                      <span class="material-symbols-rounded text-base" [class]="getIconToneClass(opt.tone)">
                        {{ opt.materialIcon }}
                      </span>
                    </span>
                  }

                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-label-ui truncate" [class.text-on-surface]="isSelected(opt)">
                      {{ opt.label }}
                    </span>
                    @if (opt.subtitle) {
                      <span class="text-[10px] font-body-sm text-on-surface-variant/80 truncate">
                        {{ opt.subtitle }}
                      </span>
                    }
                  </div>
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                  @if (opt.badge !== undefined && opt.badge !== null && opt.badge !== '') {
                    <span
                      class="px-1.5 py-0.2 rounded-full text-[10px] font-label-code-sm font-bold"
                      [class]="getBadgeToneClass(opt.tone)"
                    >
                      {{ opt.badge }}
                    </span>
                  }
                  @if (isSelected(opt)) {
                    <span class="material-symbols-rounded text-sm text-primary">check</span>
                  }
                </div>
              </button>
            } @empty {
              <div class="px-3 py-4 text-center text-xs text-on-surface-variant italic">
                Ничего не найдено
              </div>
            }
          </div>

          @if (footerActionLabel()) {
            <div class="pt-1 mt-0.5 border-t border-outline-variant/20">
              <button
                type="button"
                (click)="triggerFooterAction()"
                class="w-full px-2.5 py-1.5 rounded-xl hover:bg-surface-container-low text-primary font-label-ui text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                @if (footerActionIcon()) {
                  <span class="material-symbols-rounded text-sm">{{ footerActionIcon() }}</span>
                }
                <span>{{ footerActionLabel() }}</span>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CloudThemedSelectComponent<T = string | null> {
  readonly options = input.required<CloudSelectOption<T>[]>();
  readonly value = input<T | null>(null);
  readonly placeholder = input<string>('Выбрать...');
  readonly placeholderIcon = input<string>('');
  readonly prefixLabel = input<string>('');
  readonly searchable = input<boolean>(false);
  readonly searchPlaceholder = input<string>('Поиск...');
  readonly placement = input<'down' | 'up'>('down');
  readonly align = input<'left' | 'right'>('left');
  readonly clearable = input<boolean>(false);
  readonly clearValue = input<T | null>(null);
  readonly panelWidthClass = input<string>('w-72');
  readonly triggerClass = input<string>('');
  readonly ariaLabel = input<string>('Выбрать значение');
  readonly compact = input<boolean>(false);
  readonly highlightActive = input<boolean>(false);
  readonly footerActionLabel = input<string>('');
  readonly footerActionIcon = input<string>('');

  readonly valueChange = output<T>();
  readonly footerAction = output<void>();

  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  readonly selectedOption = computed<CloudSelectOption<T> | null>(() => {
    const cur = this.value();
    return this.options().find((o) => o.value === cur) ?? null;
  });

  readonly filteredOptions = computed<CloudSelectOption<T>[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.options();
    if (!q) return list;
    return list.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle?.toLowerCase().includes(q) ?? false),
    );
  });

  readonly showClearButton = computed<boolean>(() => {
    if (!this.clearable()) return false;
    return this.value() !== this.clearValue();
  });

  readonly panelPositionClass = computed<string>(() => {
    const vertical = this.placement() === 'up' ? 'bottom-full mb-2' : 'top-full mt-2';
    const horizontal = this.align() === 'right' ? 'right-0' : 'left-0';
    return `${vertical} ${horizontal}`;
  });

  readonly resolvedTriggerClass = computed<string>(() => {
    const custom = this.triggerClass();
    if (custom) return custom;
    const size = this.compact() ? 'px-2.5 py-1 rounded-xl' : 'px-3 py-1.5 rounded-2xl';
    const active = this.highlightActive() && this.value() !== this.clearValue();
    const tone = active
      ? 'bg-primary-container/25 hover:bg-primary-container/35 border-primary/40 shadow-2xs'
      : 'bg-surface-container-low/80 hover:bg-surface-container border-outline-variant/30 shadow-2xs';
    return `${size} ${tone}`;
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  toggle(event?: MouseEvent): void {
    event?.stopPropagation();
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.searchQuery.set('');
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  selectOption(opt: CloudSelectOption<T>): void {
    this.valueChange.emit(opt.value);
    this.close();
  }

  clearSelection(event: Event): void {
    event.stopPropagation();
    this.valueChange.emit(this.clearValue() as T);
    this.close();
  }

  triggerFooterAction(): void {
    this.close();
    this.footerAction.emit();
  }

  isSelected(opt: CloudSelectOption<T>): boolean {
    return opt.value === this.value();
  }

  trackOption(index: number, opt: CloudSelectOption<T>): string {
    return opt.value === null || opt.value === undefined
      ? `__null_${index}`
      : String(opt.value);
  }

  getIconToneClass(tone?: CloudSelectTone): string {
    switch (tone) {
      case 'amber':
        return 'text-amber-600 dark:text-amber-300';
      case 'emerald':
        return 'text-emerald-600 dark:text-emerald-300';
      case 'indigo':
        return 'text-indigo-600 dark:text-indigo-300';
      case 'violet':
        return 'text-violet-600 dark:text-violet-300';
      case 'rose':
        return 'text-rose-600 dark:text-rose-300';
      default:
        return 'text-primary';
    }
  }

  getBadgeToneClass(tone?: CloudSelectTone): string {
    switch (tone) {
      case 'amber':
        return 'bg-amber-400/20 text-amber-800 dark:text-amber-200';
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
      case 'indigo':
        return 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200';
      case 'violet':
        return 'bg-violet-500/15 text-violet-800 dark:text-violet-200';
      case 'rose':
        return 'bg-rose-500/15 text-rose-800 dark:text-rose-200';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }
}
