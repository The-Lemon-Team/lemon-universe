import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { ArenaActorCard, Profile, TimelineBoard } from '../../core/models/flow.models';
import { mergeNoteTags } from '../../core/utils/hashtag.utils';

export interface AgentSummarySubmitPayload {
  agentProfileId: string;
  sourceBoardId: string;
  targetBoardId: string;
  actorId: string;
  title: string;
  text: string;
  tags: string[];
}

@Component({
  selector: 'app-timeline-agent-summary-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective, HashtagMultiselectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-agent-summary-modal.component.html'
})
export class TimelineAgentSummaryModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly boards = input<TimelineBoard[]>([]);
  readonly actors = input<ArenaActorCard[]>([]);
  readonly profiles = input<Profile[]>([]);
  readonly hashtagOptions = input<HashtagSelectOption[]>([]);
  readonly errorMessage = input<string | null>(null);

  readonly close = output<void>();
  readonly submitSummary = output<AgentSummarySubmitPayload>();

  agentProfileDraft = 'a7e49c10-9100-4b22-a811-9000a6e17001';
  actorDraft = 'actor-antigravity-agent';
  sourceBoardDraft = 'board-coding-sessions';
  targetBoardDraft = 'board-global-day';
  titleDraft = '';
  readonly textDraft = signal<string>('');
  readonly selectedTags = signal<string[]>([]);

  readonly previewTags = computed<string[]>(() => {
    const manualAndInline = mergeNoteTags(this.textDraft(), this.selectedTags());
    return Array.from(new Set(['agent-summary', 'antigravity', ...manualAndInline]));
  });

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          const agentProf = this.profiles().find((p) => p.playerType === 'AGENT');
          if (agentProf) this.agentProfileDraft = agentProf.id;
          if (!this.boards().some((b) => b.id === this.sourceBoardDraft) && this.boards()[0]) {
            this.sourceBoardDraft = this.boards()[0].id;
          }
        } else {
          this.titleDraft = '';
          this.textDraft.set('');
          this.selectedTags.set([]);
        }
      },
      { allowSignalWrites: true },
    );
  }

  submit(): void {
    const text = this.textDraft().trim();
    if (!text) return;
    this.submitSummary.emit({
      agentProfileId: this.agentProfileDraft,
      sourceBoardId: this.sourceBoardDraft,
      targetBoardId: this.targetBoardDraft,
      actorId: this.actorDraft,
      title: this.titleDraft.trim() || 'Сводка Агента',
      text,
      tags: this.previewTags(),
    });
  }

  onClose(): void {
    this.titleDraft = '';
    this.textDraft.set('');
    this.selectedTags.set([]);
    this.close.emit();
  }
}
