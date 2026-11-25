import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HorizontalScrollUxDirective } from './horizontal-scroll-ux.directive';

@Component({
  standalone: true,
  imports: [HorizontalScrollUxDirective],
  template: `
    <div
      #scroller="appHorizontalScrollUx"
      appHorizontalScrollUx
      [appHorizontalScrollDrag]="true"
      class="scroller"
      style="width: 300px; overflow-x: auto;"
    >
      <div class="inner" style="width: 1200px; height: 80px;">
        <button type="button" class="btn">Кнопка</button>
      </div>
    </div>
  `,
})
class TestHostComponent {}

describe('HorizontalScrollUxDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let scrollerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    scrollerEl = fixture.nativeElement.querySelector('.scroller') as HTMLElement;

    Object.defineProperty(scrollerEl, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(scrollerEl, 'scrollWidth', { configurable: true, value: 1200 });
  });

  it('should convert vertical mouse wheel deltaY into horizontal scrollLeft', () => {
    const event = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    spyOn(event, 'preventDefault');

    scrollerEl.dispatchEvent(event);

    expect(scrollerEl.scrollLeft).toBe(120);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should pan horizontally on drag and ignore drag starting on buttons', () => {
    const inner = fixture.nativeElement.querySelector('.inner') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 110 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(scrollerEl.scrollLeft).toBe(90);

    const btn = fixture.nativeElement.querySelector('.btn') as HTMLElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(scrollerEl.scrollLeft).toBe(90);
  });
});
