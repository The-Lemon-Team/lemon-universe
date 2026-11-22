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
  template: `
    <div class="relative inline-block max-w-full">
      <!-- Trigger Button -->
      <button
        #triggerRef
        type="button"
        (click)="toggle($event)"
        [disabled]="disabled()"
        class="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high border text-xs font-mono font-semibold text-on-surface inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-[0.98] select-none disabled:opacity-50 disabled:cursor-not-allowed"
        [class]="
          isOpen()
            ? 'border-primary ring-1 ring-primary/25 bg-surface-container-high text-primary shadow-xs'
            : 'border-outline-variant/40 hover:border-outline-variant'
        "
        aria-haspopup="dialog"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="ariaLabel() + ': ' + displayTime()"
        [title]="'Выбрать время (сейчас: ' + displayTime() + ')'"
      >
        <span class="material-symbols-rounded text-xs text-primary leading-none">schedule</span>
        <span class="tabular-nums tracking-wide font-bold">{{ displayTime() }}</span>
        <span
          class="material-symbols-rounded text-[14px] text-on-surface-variant transition-transform duration-150 leading-none"
          [class.rotate-180]="isOpen()"
        >
          expand_more
        </span>
      </button>

      <!-- Transparent Outside Backdrop & Floating Picker Panel -->
      @if (isOpen()) {
        <div
          class="fixed inset-0 z-[70]"
          (click)="close($event)"
          (mousedown)="$event.stopPropagation()"
          aria-hidden="true"
        ></div>

        <div
          #panelRef
          role="dialog"
          aria-modal="false"
          [attr.aria-label]="ariaLabel()"
          class="fixed z-[75] w-72 rounded-2xl bg-surface-container-lowest/98 backdrop-blur-md border border-outline-variant/50 shadow-2xl p-3 flex flex-col gap-2.5 select-none"
          [style.left]="panelStyle()['left']"
          [style.top]="panelStyle()['top']"
          [style.bottom]="panelStyle()['bottom']"
          (click)="$event.stopPropagation()"
          (mousedown)="$event.stopPropagation()"
        >
          <!-- Header: Title, Current Time display & Close button -->
          <div class="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-rounded text-sm text-primary">schedule</span>
              <span class="text-xs font-bold text-on-surface">Выбор времени</span>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-sm font-mono font-black text-primary px-2 py-0.5 rounded-lg bg-primary/10 tabular-nums">
                {{ displayTime() }}
              </span>
              <button
                type="button"
                (click)="close($event)"
                class="w-6 h-6 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
                aria-label="Закрыть выбор времени"
                title="Закрыть"
              >
                <span class="material-symbols-rounded text-xs">close</span>
              </button>
            </div>
          </div>

          <!-- Quick Relative Presets Bar -->
          <div class="flex items-center justify-between gap-1 flex-wrap">
            <button
              type="button"
              (click)="shiftMinutes(-30)"
              class="px-1.5 py-0.5 rounded-md bg-surface-container-low hover:bg-primary/15 hover:text-primary text-[10px] font-mono text-on-surface-variant cursor-pointer transition-colors"
              title="На 30 минут назад"
            >
              -30м
            </button>
            <button
              type="button"
              (click)="shiftMinutes(-15)"
              class="px-1.5 py-0.5 rounded-md bg-surface-container-low hover:bg-primary/15 hover:text-primary text-[10px] font-mono text-on-surface-variant cursor-pointer transition-colors"
              title="На 15 минут назад"
            >
              -15м
            </button>
            <button
              type="button"
              (click)="setNow()"
              class="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold inline-flex items-center gap-0.5 cursor-pointer hover:bg-primary/25 transition-colors"
              title="Текущее системное время"
            >
              <span class="material-symbols-rounded text-[10px]">timer</span>
              <span>Сейчас</span>
            </button>
            <button
              type="button"
              (click)="shiftMinutes(15)"
              class="px-1.5 py-0.5 rounded-md bg-surface-container-low hover:bg-primary/15 hover:text-primary text-[10px] font-mono text-on-surface-variant cursor-pointer transition-colors"
              title="На 15 минут вперёд"
            >
              +15м
            </button>
            <button
              type="button"
              (click)="shiftMinutes(60)"
              class="px-1.5 py-0.5 rounded-md bg-surface-container-low hover:bg-primary/15 hover:text-primary text-[10px] font-mono text-on-surface-variant cursor-pointer transition-colors"
              title="На 1 час вперёд"
            >
              +1ч
            </button>
          </div>

          <!-- Quick Minute Shortcuts (:00, :15, :30, :45) -->
          <div class="flex items-center gap-1">
            <span class="text-[10px] font-mono text-outline mr-0.5">Круглое:</span>
            @for (min of commonMinuteShortcuts; track min) {
              <button
                type="button"
                (click)="setMinute(min)"
                class="flex-1 py-0.5 rounded-md border text-[10px] font-mono font-bold transition-colors cursor-pointer text-center"
                [class]="
                  currentMinutes() === min
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                "
              >
                :{{ pad(min) }}
              </button>
            }
          </div>

          <!-- Side-by-Side Dual Column Scroll: Hours & Minutes -->
          <div class="grid grid-cols-2 gap-2">
            <!-- Left: Hours Column -->
            <div class="flex flex-col gap-1">
              <div class="text-[10px] font-mono font-bold text-outline text-center">
                Часы (00–23)
              </div>
              <div
                #hoursListRef
                class="h-36 overflow-y-auto rounded-xl bg-surface-container-low/70 border border-outline-variant/30 p-1 flex flex-col gap-0.5 scrollbar-thin scroll-smooth"
              >
                @for (h of allHours; track h) {
                  <button
                    #hourBtn
                    type="button"
                    (click)="setHour(h)"
                    class="w-full py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer text-center"
                    [class]="
                      currentHours() === h
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                    "
                  >
                    {{ pad(h) }}
                  </button>
                }
              </div>
            </div>

            <!-- Right: Minutes Column -->
            <div class="flex flex-col gap-1">
              <div class="text-[10px] font-mono font-bold text-outline text-center">
                Минуты (00–59)
              </div>
              <div
                #minutesListRef
                class="h-36 overflow-y-auto rounded-xl bg-surface-container-low/70 border border-outline-variant/30 p-1 flex flex-col gap-0.5 scrollbar-thin scroll-smooth"
              >
                @for (m of allMinutes; track m) {
                  <button
                    #minBtn
                    type="button"
                    (click)="setMinute(m)"
                    class="w-full py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer text-center"
                    [class]="
                      currentMinutes() === m
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                    "
                  >
                    :{{ pad(m) }}
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Footer: Direct Manual Stepper & Done Button -->
          <div class="flex items-center justify-between gap-2 border-t border-outline-variant/20 pt-2">
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="shiftMinutes(-1)"
                class="p-1 rounded-md bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-bold border border-outline-variant/30 cursor-pointer"
                title="-1 минута"
              >
                -1м
              </button>
              <button
                type="button"
                (click)="shiftMinutes(1)"
                class="p-1 rounded-md bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-bold border border-outline-variant/30 cursor-pointer"
                title="+1 минута"
              >
                +1м
              </button>
            </div>

            <button
              type="button"
              (click)="close($event)"
              class="px-3 py-1 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:opacity-95 active:scale-[0.98] cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      }
    </div>
  `,
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
