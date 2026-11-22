import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { normalizeTag } from '../utils/hashtag.utils';

export interface HashtagSelectOption {
  tag: string;
  count?: number;
}

/**
 * Reusable multiselect input with search and optional inline creation of new `#hashtags`.
 * Uses viewport-aware fixed overlay positioning so it never gets clipped by parent overflow containers.
 */
@Component({
  selector: 'app-hashtag-multiselect',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full">
      <!-- Trigger Field -->
      <div
        #triggerRef
        role="combobox"
        tabindex="0"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="ariaLabel()"
        aria-haspopup="listbox"
        (click)="toggle($event)"
        (keydown.enter)="toggle($event)"
        (keydown.space)="onTriggerSpace($event)"
        class="w-full min-h-[34px] px-2.5 py-1 rounded-xl bg-surface-container-lowest border transition-colors cursor-pointer flex items-center justify-between gap-1.5 select-none"
        [class]="
          isOpen()
            ? 'border-primary/60 ring-1 ring-primary/25'
            : 'border-outline-variant/40 hover:border-outline-variant'
        "
      >
        <div class="flex items-center gap-1 flex-wrap min-w-0 flex-1">
          @if (prefixLabel()) {
            <span class="text-[11px] font-label-ui text-on-surface-variant font-medium flex-shrink-0 mr-0.5">
              {{ prefixLabel() }}
            </span>
          }

          @if (normalizedSelected().length > 0) {
            @for (tag of normalizedSelected(); track tag) {
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-mono font-semibold max-w-full"
              >
                <span class="truncate">#{{ tag }}</span>
                <button
                  type="button"
                  (click)="removeTag(tag, $event)"
                  class="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center hover:bg-primary/25 text-primary cursor-pointer flex-shrink-0"
                  [attr.aria-label]="'Убрать хештег #' + tag"
                >
                  <span class="material-symbols-rounded text-[11px] leading-none">close</span>
                </button>
              </span>
            }
          } @else {
            <span class="text-xs text-on-surface-variant/75 truncate">
              {{ placeholder() }}
            </span>
          }
        </div>

        <div class="flex items-center gap-0.5 flex-shrink-0">
          @if (normalizedSelected().length > 0) {
            <button
              type="button"
              (click)="clearAll($event)"
              class="w-4 h-4 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
              title="Очистить хештеги"
              aria-label="Очистить хештеги"
            >
              <span class="material-symbols-rounded text-xs">close</span>
            </button>
          }

          <span
            class="material-symbols-rounded text-base text-on-surface-variant transition-transform duration-150"
            [class.rotate-180]="isOpen()"
          >
            expand_more
          </span>
        </div>
      </div>

      <!-- Click-outside Backdrop & Floating Multiselect Panel -->
      @if (isOpen()) {
        <div
          class="fixed inset-0 z-[70]"
          (click)="close($event)"
          (mousedown)="$event.stopPropagation()"
          aria-hidden="true"
        ></div>

        <div
          #panelRef
          role="listbox"
          aria-multiselectable="true"
          [attr.aria-label]="ariaLabel()"
          class="fixed z-[75] rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-2 flex flex-col gap-1.5"
          [style.left]="panelStyle()['left']"
          [style.top]="panelStyle()['top']"
          [style.bottom]="panelStyle()['bottom']"
          [style.width]="panelStyle()['width']"
          [style.max-height]="panelStyle()['maxHeight']"
          (click)="$event.stopPropagation()"
          (mousedown)="$event.stopPropagation()"
        >
          <!-- Search / Create Input -->
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus-within:border-primary/50 transition-colors flex-shrink-0">
            <span class="material-symbols-rounded text-sm text-on-surface-variant">search</span>
            <input
              #searchInput
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              (keydown.enter)="onSearchEnter($event)"
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

          <!-- Optional Create New Hashtag Action -->
          @if (canCreateQueryTag()) {
            <button
              type="button"
              (click)="createAndSelectQueryTag()"
              class="w-full px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors flex-shrink-0"
            >
              <span class="inline-flex items-center gap-1.5 truncate">
                <span class="material-symbols-rounded text-sm">add_circle</span>
                <span class="truncate">Добавить #{{ normalizedSearchTag() }}</span>
              </span>
              <span class="text-[10px] font-mono opacity-80">Enter</span>
            </button>
          }

          <!-- Options List -->
          <div class="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto pr-0.5 max-h-52">
            @for (opt of filteredOptions(); track opt.tag) {
              <button
                type="button"
                role="option"
                [attr.aria-selected]="isSelected(opt.tag)"
                (click)="toggleTag(opt.tag)"
                class="w-full text-left px-2.5 py-1.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer flex-shrink-0"
                [class]="
                  isSelected(opt.tag)
                    ? 'bg-primary-container/35 text-on-surface font-bold border border-primary/30'
                    : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                "
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors"
                    [class]="
                      isSelected(opt.tag)
                        ? 'bg-primary border-primary text-on-primary'
                        : 'border-outline-variant/60 bg-surface-container-lowest'
                    "
                  >
                    @if (isSelected(opt.tag)) {
                      <span class="material-symbols-rounded text-xs leading-none">check</span>
                    }
                  </span>
                  <span class="text-xs font-mono truncate">#{{ opt.tag }}</span>
                </div>

                @if (opt.count !== undefined && opt.count > 0) {
                  <span class="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] font-mono text-outline flex-shrink-0">
                    {{ opt.count }}
                  </span>
                }
              </button>
            } @empty {
              <div class="px-3 py-3 text-center text-xs text-on-surface-variant italic">
                @if (allowCreate() && searchQuery().trim()) {
                  Нажмите Enter или кнопку выше, чтобы добавить хештег
                } @else {
                  Хештеги не найдены
                }
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="pt-1 border-t border-outline-variant/20 flex items-center justify-between gap-2 text-[10px] font-mono text-outline px-1 flex-shrink-0">
            <span>Выбрано: {{ normalizedSelected().length }}</span>
            <button
              type="button"
              (click)="close($event)"
              class="px-2 py-0.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-sans font-bold text-[11px] cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class HashtagMultiselectComponent implements OnInit, OnDestroy {
  @ViewChild('triggerRef') triggerRef?: ElementRef<HTMLElement>;
  @ViewChild('panelRef') panelRef?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly options = input<HashtagSelectOption[]>([]);
  readonly selectedTags = input<string[]>([]);
  readonly placeholder = input<string>('Выбрать #хештеги...');
  readonly searchPlaceholder = input<string>('Поиск или новый #хештег...');
  readonly prefixLabel = input<string>('');
  readonly placement = input<'auto' | 'down' | 'up'>('auto');
  readonly align = input<'left' | 'right'>('left');
  readonly allowCreate = input<boolean>(true);
  readonly panelWidthClass = input<string>('w-full min-w-[240px]');
  readonly ariaLabel = input<string>('Выбор хештегов');

  readonly selectedTagsChange = output<string[]>();

  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly panelStyle = signal<Record<string, string>>({
    position: 'fixed',
    zIndex: '75',
    left: '0px',
    top: '0px',
    width: '280px',
    maxHeight: '320px',
  });

  readonly normalizedSelected = computed<string[]>(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of this.selectedTags()) {
      const tag = normalizeTag(raw);
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        list.push(tag);
      }
    }
    return list;
  });

  readonly mergedOptions = computed<HashtagSelectOption[]>(() => {
    const map = new Map<string, HashtagSelectOption>();
    for (const opt of this.options()) {
      const tag = normalizeTag(opt.tag);
      if (!tag) continue;
      const existing = map.get(tag);
      if (!existing || (opt.count ?? 0) > (existing.count ?? 0)) {
        map.set(tag, { tag, count: opt.count });
      }
    }
    for (const tag of this.normalizedSelected()) {
      if (!map.has(tag)) {
        map.set(tag, { tag });
      }
    }
    return Array.from(map.values());
  });

  readonly normalizedSearchTag = computed<string>(() => normalizeTag(this.searchQuery()));

  readonly filteredOptions = computed<HashtagSelectOption[]>(() => {
    const q = this.searchQuery().trim().replace(/^#+/, '').toLowerCase();
    const list = this.mergedOptions();
    if (!q) return list;
    return list.filter((opt) => opt.tag.includes(q));
  });

  readonly canCreateQueryTag = computed<boolean>(() => {
    if (!this.allowCreate()) return false;
    const tag = this.normalizedSearchTag();
    if (!tag) return false;
    return !this.mergedOptions().some((opt) => opt.tag === tag);
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onWindowScroll, { capture: true, passive: true });
      window.addEventListener('resize', this.onWindowResize, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onWindowScroll, { capture: true });
      window.removeEventListener('resize', this.onWindowResize);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event?: KeyboardEvent): void {
    if (this.isOpen()) {
      event?.stopPropagation();
      event?.stopImmediatePropagation();
      this.close();
    }
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.updatePosition();
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          this.updatePosition();
          this.searchInput?.nativeElement?.focus();
        });
      } else {
        setTimeout(() => {
          this.updatePosition();
          this.searchInput?.nativeElement?.focus();
        }, 0);
      }
    } else {
      this.searchQuery.set('');
    }
  }

  onTriggerSpace(event: Event): void {
    event.preventDefault();
    this.toggle(event);
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  isSelected(tag: string): boolean {
    const normalized = normalizeTag(tag);
    return normalized ? this.normalizedSelected().includes(normalized) : false;
  }

  toggleTag(rawTag: string): void {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    const current = this.normalizedSelected();
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    this.selectedTagsChange.emit(next);
  }

  removeTag(rawTag: string, event: Event): void {
    event.stopPropagation();
    const tag = normalizeTag(rawTag);
    this.selectedTagsChange.emit(this.normalizedSelected().filter((t) => t !== tag));
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    this.selectedTagsChange.emit([]);
  }

  createAndSelectQueryTag(): void {
    const tag = this.normalizedSearchTag();
    if (!tag) return;
    const current = this.normalizedSelected();
    if (!current.includes(tag)) {
      this.selectedTagsChange.emit([...current, tag]);
    }
    this.searchQuery.set('');
  }

  onSearchEnter(event: Event): void {
    event.preventDefault();
    const tag = this.normalizedSearchTag();
    if (!tag) return;
    const exact = this.mergedOptions().find((opt) => opt.tag === tag);
    if (exact) {
      this.toggleTag(exact.tag);
      this.searchQuery.set('');
    } else if (this.allowCreate()) {
      this.createAndSelectQueryTag();
    }
  }

  updatePosition(): void {
    const trigger = this.triggerRef?.nativeElement;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // If trigger scrolled completely out of view, close dropdown
    if ((rect.bottom < 0 || rect.top > vh) && rect.height > 0) {
      this.close();
      return;
    }

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    let openUp = false;
    const placementMode = this.placement();
    if (placementMode === 'up') {
      openUp = true;
    } else if (placementMode === 'down') {
      openUp = spaceBelow < 150 && spaceAbove > spaceBelow;
    } else {
      // In 'auto' mode: prefer downwards if comfortable space (>= 260px),
      // otherwise upwards if spaceAbove is larger or spaceBelow is constrained (< 260px)
      if (spaceBelow < 260 && spaceAbove > spaceBelow) {
        openUp = true;
      } else if (spaceBelow >= 260) {
        openUp = false;
      } else {
        openUp = spaceAbove > spaceBelow;
      }
    }

    const triggerWidth = rect.width || 240;
    const panelWidth = Math.min(Math.max(triggerWidth, 240), Math.max(vw - 16, 240));

    let left = this.align() === 'right' ? rect.right - panelWidth : rect.left;
    left = Math.max(8, Math.min(left, vw - panelWidth - 8));

    const margin = 6;
    const availableHeight = openUp ? spaceAbove - margin - 12 : spaceBelow - margin - 12;
    const maxHeight = Math.max(160, Math.min(320, availableHeight > 0 ? availableHeight : 320));

    let parentOffsetLeft = 0;
    let parentOffsetTop = 0;
    let parentOffsetBottom = vh;

    const panel = this.panelRef?.nativeElement;
    if (panel && panel.offsetParent && panel.offsetParent !== document.body) {
      const pRect = panel.offsetParent.getBoundingClientRect();
      parentOffsetLeft = pRect.left;
      parentOffsetTop = pRect.top;
      parentOffsetBottom = pRect.bottom;
    }

    this.panelStyle.set({
      position: 'fixed',
      zIndex: '75',
      left: `${Math.round(left - parentOffsetLeft)}px`,
      width: `${Math.round(panelWidth)}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
      top: openUp ? 'auto' : `${Math.round(rect.bottom - parentOffsetTop + margin)}px`,
      bottom: openUp ? `${Math.round(parentOffsetBottom - rect.top + margin)}px` : 'auto',
    });
  }

  private onWindowScroll = (event: Event): void => {
    if (!this.isOpen()) return;
    const panel = this.panelRef?.nativeElement;
    if (panel && event.target && panel.contains(event.target as Node)) {
      return;
    }
    this.updatePosition();
  };

  private onWindowResize = (): void => {
    if (this.isOpen()) {
      this.updatePosition();
    }
  };
}
