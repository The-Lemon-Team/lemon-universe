import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, label, [role="button"], [role="dialog"], [data-no-drag-scroll]';

/**
 * Enhances horizontal scroll containers with vertical-wheel horizontal scrolling
 * and optional drag-to-scroll panning without interfering with clicks or text selection.
 */
@Directive({
  selector: '[appHorizontalScrollUx]',
  exportAs: 'appHorizontalScrollUx',
  standalone: true,
})
export class HorizontalScrollUxDirective {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly appHorizontalScrollDrag = input<boolean>(false);
  readonly appHorizontalWheelFactor = input<number>(1);

  private isPointerDown = false;
  private isDragging = false;
  private startX = 0;
  private startScrollLeft = 0;
  private suppressNextClick = false;

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    const container = this.host.nativeElement;
    if (container.scrollWidth <= container.clientWidth + 1) return;

    const target = event.target as HTMLElement | null;
    if (this.hasNestedVerticalScroll(target, container)) return;

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || event.deltaY === 0) {
      return;
    }

    const lineMultiplier = event.deltaMode === 1 ? 28 : event.deltaMode === 2 ? container.clientWidth * 0.8 : 1;
    const delta = event.deltaY * lineMultiplier * this.appHorizontalWheelFactor();
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + delta));

    if (Math.abs(nextScrollLeft - container.scrollLeft) < 0.5) {
      return;
    }

    container.scrollLeft = nextScrollLeft;
    event.preventDefault();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.appHorizontalScrollDrag() || event.button !== 0) return;

    const container = this.host.nativeElement;
    if (container.scrollWidth <= container.clientWidth + 1) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;

    this.isPointerDown = true;
    this.isDragging = false;
    this.startX = event.clientX;
    this.startScrollLeft = container.scrollLeft;
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isPointerDown) return;

    const dx = event.clientX - this.startX;
    if (!this.isDragging && Math.abs(dx) > 6) {
      this.isDragging = true;
      this.suppressNextClick = true;
    }

    if (this.isDragging) {
      this.host.nativeElement.scrollLeft = this.startScrollLeft - dx;
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.isDragging = false;
  }

  consumeSuppressedClick(): boolean {
    if (!this.suppressNextClick) return false;
    this.suppressNextClick = false;
    return true;
  }

  private hasNestedVerticalScroll(target: HTMLElement | null, boundary: HTMLElement): boolean {
    let cursor = target;
    while (cursor && cursor !== boundary) {
      if (cursor.tagName === 'TEXTAREA' || cursor.tagName === 'SELECT') {
        return true;
      }
      if (cursor.scrollHeight > cursor.clientHeight + 2 && typeof getComputedStyle === 'function') {
        const overflowY = getComputedStyle(cursor).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return true;
        }
      }
      cursor = cursor.parentElement;
    }
    return false;
  }
}
