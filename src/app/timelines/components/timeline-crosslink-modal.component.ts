import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActorAvatarComponent } from '../../components/neuron-arena/actor-avatar.component';
import { HashtagTextComponent } from '../../core/components/hashtag-text.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { CloudDayNote, TimelineBoard } from '../../core/models/flow.models';
import { mergeNoteTags } from '../../core/utils/hashtag.utils';

@Component({
  selector: 'app-timeline-crosslink-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective, ActorAvatarComponent, HashtagTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-crosslink-modal.component.html'
})
export class TimelineCrossLinkModalComponent {
  readonly sourceBoard = input<TimelineBoard | null>(null);
  readonly sourceNote = input<CloudDayNote | null>(null);
  readonly candidates = input<CloudDayNote[]>([]);
  readonly boards = input<TimelineBoard[]>([]);

  readonly close = output<void>();
  readonly attach = output<{ targetNote: CloudDayNote; relationLabel: string }>();

  relationLabelDraft = '';
  readonly filterQuery = signal<string>('');

  readonly filteredCandidates = computed<CloudDayNote[]>(() => {
    const q = this.filterQuery().trim().toLowerCase();
    const list = this.candidates();
    if (!q) return list;
    const tagNeedle = q.replace(/^#+/, '');
    return list.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.actorName.toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        mergeNoteTags(c.text, c.tags).some((t) => t.includes(tagNeedle)),
    );
  });

  getCandidateTags(note: CloudDayNote): string[] {
    return mergeNoteTags(note.text || '', note.tags);
  }

  getBoardTitle(boardId: string): string {
    return this.boards().find((b) => b.id === boardId)?.title || boardId;
  }

  pickCandidate(targetNote: CloudDayNote): void {
    this.attach.emit({
      targetNote,
      relationLabel: this.relationLabelDraft.trim(),
    });
    this.relationLabelDraft = '';
    this.filterQuery.set('');
  }

  onClose(): void {
    this.relationLabelDraft = '';
    this.filterQuery.set('');
    this.close.emit();
  }
}
