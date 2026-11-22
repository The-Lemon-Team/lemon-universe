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
  templateUrl: './hashtag-multiselect.component.html'
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
