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
  templateUrl: './cloud-themed-select.component.html'
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
