import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Reusable, styled time picker popover component following the Lemon UI design system.
 * Supports quick shift presets (-15m, +15m, +1h), common minute shortcuts (:00, :15, :30, :45),
 * synchronized side-by-side hour & minute scroll lists, direct numeric inputs, and current time ("Сейчас").
 */
@Component({
  selector: 'app-time-picker-popover',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-picker-popover.component.html'
})
export class TimePickerPopoverComponent implements OnInit, OnDestroy {
  @ViewChild('triggerRef') triggerRef?: ElementRef<HTMLElement>;
  @ViewChild('panelRef') panelRef?: ElementRef<HTMLElement>;
  @ViewChild('hoursListRef') hoursListRef?: ElementRef<HTMLElement>;
  @ViewChild('minutesListRef') minutesListRef?: ElementRef<HTMLElement>;

  @ViewChildren('hourBtn') hourButtons?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('minBtn') minButtons?: QueryList<ElementRef<HTMLElement>>;

  readonly time = input<string>('12:00');
  readonly placement = input<'auto' | 'up' | 'down'>('up');
  readonly align = input<'left' | 'right'>('left');
  readonly ariaLabel = input<string>('Выбор времени');
  readonly disabled = input<boolean>(false);

  readonly timeChange = output<string>();

  readonly isOpen = signal<boolean>(false);
  readonly panelStyle = signal<Record<string, string>>({
    position: 'fixed',
    zIndex: '75',
    left: '0px',
    bottom: '0px',
    width: '288px',
  });

  readonly allHours = Array.from({ length: 24 }, (_, i) => i);
  readonly allMinutes = Array.from({ length: 60 }, (_, i) => i);
  readonly commonMinuteShortcuts = [0, 15, 30, 45];

  readonly currentHours = computed<number>(() => {
    const raw = this.time();
    const parts = (raw || '').split(':').map(Number);
    const h = parts[0];
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 12;
  });

  readonly currentMinutes = computed<number>(() => {
    const raw = this.time();
    const parts = (raw || '').split(':').map(Number);
    const m = parts[1];
    return Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0;
  });

  readonly displayTime = computed<string>(() => {
    return `${this.pad(this.currentHours())}:${this.pad(this.currentMinutes())}`;
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
    if (this.disabled()) return;
    event?.stopPropagation();
    const next = !this.isOpen();
    this.isOpen.set(next);

    if (next) {
      this.updatePosition();
      this.scheduleScrollToActive();
    }
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.isOpen.set(false);
  }

  setHour(h: number): void {
    this.emitTime(h, this.currentMinutes());
  }

  setMinute(m: number): void {
    this.emitTime(this.currentHours(), m);
  }

  shiftMinutes(delta: number): void {
    const total = (this.currentHours() * 60 + this.currentMinutes() + delta) % 1440;
    const normalized = (total + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    this.emitTime(h, m);
    this.scheduleScrollToActive();
  }

  setNow(): void {
    const now = new Date();
    this.emitTime(now.getHours(), now.getMinutes());
    this.scheduleScrollToActive();
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  private emitTime(hours: number, minutes: number): void {
    const formatted = `${this.pad(hours)}:${this.pad(minutes)}`;
    this.timeChange.emit(formatted);
  }

  private scheduleScrollToActive(): void {
    const scroll = () => {
      this.updatePosition();
      const currentH = this.currentHours();
      const currentM = this.currentMinutes();

      const hBtn = this.hourButtons?.get(currentH)?.nativeElement;
      if (hBtn) {
        hBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }

      const mBtn = this.minButtons?.get(currentM)?.nativeElement;
      if (mBtn) {
        mBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(scroll);
      });
    } else {
      setTimeout(scroll, 0);
    }
  }

  updatePosition(): void {
    const trigger = this.triggerRef?.nativeElement;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if ((rect.bottom < 0 || rect.top > vh) && rect.height > 0) {
      this.close();
      return;
    }

    const panelWidth = 288;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    let openUp = this.placement() === 'up';
    if (this.placement() === 'auto') {
      openUp = spaceBelow < 320 && spaceAbove > spaceBelow;
    }

    let left = this.align() === 'right' ? rect.right - panelWidth : rect.left;
    if (left + panelWidth > vw - 8) {
      left = vw - panelWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }

    const margin = 8;
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
      width: `${panelWidth}px`,
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
