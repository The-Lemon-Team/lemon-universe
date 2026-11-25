import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlowStatus, FlowType, TimelineBoard } from '../../core/models/flow.models';
import { TimelineBoardNavComponent } from './timeline-board-nav.component';

function makeBoard(partial: Partial<TimelineBoard>): TimelineBoard {
  return {
    id: partial.id ?? 'board-1',
    slug: partial.slug ?? 'board-1',
    title: partial.title ?? 'Борд 1',
    description: partial.description ?? '',
    icon: partial.icon ?? 'timeline',
    colorTheme: partial.colorTheme ?? 'amber',
    boardKind: partial.boardKind ?? 'CUSTOM_PROJECT',
    boardMode: partial.boardMode ?? 'TIMELINE',
    privacy: partial.privacy ?? 'PUBLIC',
    ownerProfileId: partial.ownerProfileId ?? '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    flowId: partial.flowId ?? null,
    flowType: partial.flowType ?? FlowType.CONTEXT,
    flowStatus: partial.flowStatus ?? FlowStatus.ACTIVE,
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-board-1',
    isDefault: false,
    members: [],
    ...partial,
  };
}

describe('TimelineBoardNavComponent', () => {
  let fixture: ComponentFixture<TimelineBoardNavComponent>;
  let component: TimelineBoardNavComponent;

  const boards: TimelineBoard[] = [
    makeBoard({ id: 'board-lemon-space', slug: 'lemon-space', title: '🏛️ Эмитент' }),
    makeBoard({ id: 'board-tower-earth', slug: 'tower-earth', title: '🜃 Башня Земли' }),
    makeBoard({ id: 'board-global-day', slug: 'global-day', title: '🌍 Глобальный Таймлайн' }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineBoardNavComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineBoardNavComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('filterTabs', [
      { id: 'ALL', label: 'Все доступные' },
      { id: 'TOWERS', label: '🏛️ Эмитент и Башни' },
    ]);
    fixture.componentRef.setInput('boardFilter', 'ALL');
    fixture.componentRef.setInput('filteredBoards', boards);
    fixture.componentRef.setInput('activeBoard', boards[0]);
    fixture.detectChanges();
  });

  it('should render single two-row card grid with tower badges and prev/next switching', () => {
    const el = fixture.nativeElement as HTMLElement;
    const twoRowGrid = el.querySelector('[data-test-id="board-nav-two-row-grid"]');
    expect(twoRowGrid).toBeTruthy();
    expect(twoRowGrid?.classList.contains('grid-rows-2')).toBeTrue();
    expect(el.textContent).toContain('Эмитент');
    expect(el.textContent).toContain('EARTH');
    expect(el.textContent).toContain('1/3');

    const activeBtn = el.querySelector('[aria-current="page"]');
    expect(activeBtn?.getAttribute('data-board-id')).toBe('board-lemon-space');

    const selected: TimelineBoard[] = [];
    component.boardSelect.subscribe((b) => selected.push(b));

    (el.querySelector('[data-test-id="board-nav-next"]') as HTMLButtonElement).click();
    expect(selected[0].id).toBe('board-tower-earth');

    (el.querySelector('[data-test-id="board-nav-prev"]') as HTMLButtonElement).click();
    expect(selected[1].id).toBe('board-global-day');
  });

  it('should emit search changes and scroll horizontally on arrow click', () => {
    const el = fixture.nativeElement as HTMLElement;
    const gridEl = component.boardGridRef()?.nativeElement as HTMLElement;
    const scrollToSpy = spyOn(gridEl, 'scrollTo').and.callThrough();

    (el.querySelector('[data-test-id="board-nav-scroll-right"]') as HTMLButtonElement).click();
    expect(scrollToSpy).toHaveBeenCalled();

    const searchEvents: string[] = [];
    component.searchChange.subscribe((q) => searchEvents.push(q));
    const input = el.querySelector('[data-test-id="board-nav-search"]') as HTMLInputElement;
    input.value = 'земл';
    input.dispatchEvent(new Event('input'));
    expect(searchEvents).toContain('земл');
  });
});
