import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { HashtagTextComponent } from '../../core/components/hashtag-text.component';
import { SeasonsPersonalFeedEntry } from '../../core/models/flow.models';

@Component({
  selector: 'app-timeline-seasons-modal',
  standalone: true,
  imports: [ModalOverlayDirective, HashtagTextComponent],
  templateUrl: './timeline-seasons-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineSeasonsModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly personalFeedEntries = input<SeasonsPersonalFeedEntry[]>([]);
  readonly remoteFeedNotes = input<any[]>([]);
  readonly remoteFeedAccount = input<string | null>(null);
  readonly streamInfo = input<any | null>(null);
  readonly isEnsuringStream = input<boolean>(false);
  readonly streamSlug = input<string>('lemon-universe');

  readonly close = output<void>();
  readonly refreshRemote = output<void>();
  readonly ensureStream = output<void>();

  readonly seasonsModalTab = signal<'LOCAL' | 'REMOTE'>('LOCAL');

  selectTab(tab: 'LOCAL' | 'REMOTE'): void {
    this.seasonsModalTab.set(tab);
    if (tab === 'REMOTE') {
      this.refreshRemote.emit();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onRefresh(): void {
    this.refreshRemote.emit();
  }

  onEnsureStream(): void {
    this.ensureStream.emit();
  }
}
