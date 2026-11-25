import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimelineBoard } from '../../core/models/flow.models';
import { mergeNoteTags } from '../../core/utils/hashtag.utils';
import { HorizontalScrollUxDirective } from '../directives/horizontal-scroll-ux.directive';

export type BoardFilterTab = 'ALL' | 'TOWERS' | 'DIARY' | 'AGENT_SUMMARY' | 'PRIVATE' | 'PUBLIC';

const TOWER_BADGE_MAP: Record<string, string> = {
  'board-lemon-space': 'Эмитент',
  'board-tower-earth': 'EARTH',
  'board-tower-water': 'WATER',
  'board-tower-fire': 'FIRE',
  'board-tower-air': 'AIR',
};

/**
 * Single-view board navigator rendering boards as a two-row horizontal card grid
 * with instant search, tower/category filters, prev/next stepping, and wheel/drag scroll.
 */
@Component({
  selector: 'app-timeline-board-nav',
  standalone: true,
  imports: [FormsModule, HorizontalScrollUxDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-board-nav.component.html',
})
export class TimelineBoardNavComponent {
  readonly filterTabs = input.required<Array<{ id: BoardFilterTab; label: string }>>();
  readonly boardFilter = input.required<BoardFilterTab>();
  readonly filteredBoards = input.required<TimelineBoard[]>();
  readonly activeBoard = input<TimelineBoard | null>(null);
  readonly selectedBoardHashtag = input<string | null>(null);
  readonly allBoardHashtags = input<Array<{ tag: string; count: number }>>([]);
  readonly boardCounts = input<Record<string, number>>({});
  readonly personalFeedCount = input<number>(0);
  readonly boardSearchQuery = input<string>('');
  readonly boardsLoaded = input<boolean>(true);

  readonly filterChange = output<BoardFilterTab>();
  readonly searchChange = output<string>();
  readonly boardSelect = output<TimelineBoard>();
  readonly hashtagToggle = output<string>();
  readonly hashtagClear = output<void>();
  readonly openAgentSummary = output<void>();
  readonly openPersonalFeed = output<void>();
  readonly openCreateBoard = output<void>();

  readonly boardGridRef = viewChild<ElementRef<HTMLElement>>('boardGrid');
  private pendingScrollTarget: number | null = null;
  private pendingScrollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeBoardIndex = computed<number>(() => {
    const activeId = this.activeBoard()?.id;
    if (!activeId) return -1;
    return this.filteredBoards().findIndex((b) => b.id === activeId);
  });

  readonly canStepBoards = computed<boolean>(() => this.filteredBoards().length > 1);

  constructor() {
    effect(() => {
      const activeId = this.activeBoard()?.id;
      this.filteredBoards();
      const container = this.boardGridRef()?.nativeElement;
      if (!activeId || !container) return;

      queueMicrotask(() => {
        const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(activeId) : activeId;
        const card = container.querySelector(`[data-board-id="${escaped}"]`) as HTMLElement | null;
        if (!card) return;
        this.scrollCardIntoHorizontalView(card, container);
      });
    });
  }

  getBoardHashtags(board: TimelineBoard): string[] {
    return mergeNoteTags(board.description || '', board.hashtags || []);
  }

  getBoardCount(boardId: string): number {
    return this.boardCounts()[boardId] ?? 0;
  }

  getTowerBadge(board: TimelineBoard): string | null {
    return TOWER_BADGE_MAP[board.id] ?? null;
  }

  stepBoard(delta: -1 | 1): void {
    const list = this.filteredBoards();
    if (list.length === 0) return;
    const idx = this.activeBoardIndex();
    const baseIdx = idx >= 0 ? idx : 0;
    const nextIdx = (baseIdx + delta + list.length) % list.length;
    this.boardSelect.emit(list[nextIdx]);
  }

  scrollGrid(deltaPx: number): void {
    const grid = this.boardGridRef()?.nativeElement;
    if (!grid) return;
    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    const base = this.pendingScrollTarget ?? grid.scrollLeft;
    const nextLeft = Math.max(0, Math.min(maxScroll, base + deltaPx));
    this.pendingScrollTarget = nextLeft;
    if (this.pendingScrollTimer) clearTimeout(this.pendingScrollTimer);
    this.pendingScrollTimer = setTimeout(() => {
      this.pendingScrollTarget = null;
    }, 450);
    grid.scrollTo({ left: nextLeft, behavior: 'smooth' });
  }

  selectBoardFromNav(board: TimelineBoard): void {
    this.boardSelect.emit(board);
  }

  private scrollCardIntoHorizontalView(card: HTMLElement, container: HTMLElement): void {
    const cLeft = container.scrollLeft;
    const cRight = cLeft + container.clientWidth;
    const cardLeft = card.offsetLeft;
    const cardRight = cardLeft + card.offsetWidth;

    if (cardLeft < cLeft) {
      container.scrollTo({ left: Math.max(0, cardLeft - 8), behavior: 'smooth' });
    } else if (cardRight > cRight) {
      container.scrollTo({ left: cardRight - container.clientWidth + 8, behavior: 'smooth' });
    }
  }
}
