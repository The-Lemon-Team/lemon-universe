import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaActorCard,
  BoardPrivacy,
  Profile,
  TimelineBoard,
  TimelineBoardMode,
} from '../../core/models/flow.models';
import { getExtraTagsNotInText, mergeNoteTags } from '../../core/utils/hashtag.utils';

export interface CreateBoardSubmitPayload {
  title: string;
  description: string;
  hashtags: string[];
  boardMode: TimelineBoardMode;
  privacy: BoardPrivacy;
  defaultActorId: string;
  seasonsFeedSlug: string;
  memberProfileIds: string[];
}

export interface EditBoardSubmitPayload {
  title: string;
  description: string;
  hashtags: string[];
  boardMode: TimelineBoardMode;
  privacy: BoardPrivacy;
  defaultActorId: string;
  seasonsFeedSlug: string;
}

@Component({
  selector: 'app-timeline-board-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective, HashtagMultiselectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-board-modal.component.html'
})
export class TimelineBoardModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly editingBoard = input<TimelineBoard | null>(null);
  readonly actors = input<ArenaActorCard[]>([]);
  readonly profiles = input<Profile[]>([]);
  readonly activeProfileId = input<string>('');
  readonly hashtagOptions = input<HashtagSelectOption[]>([]);

  readonly close = output<void>();
  readonly create = output<CreateBoardSubmitPayload>();
  readonly save = output<EditBoardSubmitPayload>();

  titleDraft = '';
  readonly descriptionDraft = signal<string>('');
  readonly selectedHashtags = signal<string[]>([]);
  modeDraft: TimelineBoardMode = 'DIARY';
  privacyDraft: BoardPrivacy = 'PRIVATE';
  defaultActorDraft = '';
  feedSlugDraft = '';
  readonly selectedMembers = signal<string[]>([]);

  readonly resolvedHashtagOptions = computed<HashtagSelectOption[]>(() => {
    const map = new Map<string, number | undefined>();
    for (const opt of this.hashtagOptions()) {
      map.set(opt.tag, opt.count);
    }
    for (const def of ['проект', 'дневник', 'работа', 'личное', 'агенты']) {
      if (!map.has(def)) map.set(def, undefined);
    }
    return Array.from(map.entries()).map(([tag, count]) => ({ tag, count }));
  });

  readonly previewHashtags = computed<string[]>(() =>
    mergeNoteTags(this.descriptionDraft(), this.selectedHashtags()),
  );

  constructor() {
    effect(
      () => {
        if (!this.isOpen()) return;
        const board = this.editingBoard();
        if (board) {
          this.titleDraft = board.title || '';
          this.descriptionDraft.set(board.description || '');
          this.selectedHashtags.set(
            getExtraTagsNotInText(board.description || '', board.hashtags),
          );
          this.modeDraft = board.boardMode || 'DIARY';
          this.privacyDraft = board.privacy || 'PRIVATE';
          this.defaultActorDraft = board.defaultActorId || this.actors()[0]?.id || '';
          this.feedSlugDraft = board.seasonsFeedSlug || '';
          this.selectedMembers.set([]);
        } else if (!this.defaultActorDraft && this.actors().length > 0) {
          this.defaultActorDraft = this.actors()[0].id;
        }
      },
      { allowSignalWrites: true },
    );
  }

  otherProfiles(): Profile[] {
    const active = this.activeProfileId();
    return this.profiles().filter((p) => p.id !== active);
  }

  toggleMember(profileId: string): void {
    this.selectedMembers.update((list) =>
      list.includes(profileId) ? list.filter((id) => id !== profileId) : [...list, profileId],
    );
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  submit(): void {
    const title = this.titleDraft.trim();
    if (!title) return;
    const description = this.descriptionDraft().trim();
    const hashtags = mergeNoteTags(description, this.selectedHashtags());
    const defaultActorId = this.defaultActorDraft || this.actors()[0]?.id || 'actor-alexey';
    if (this.editingBoard()) {
      this.save.emit({
        title,
        description,
        hashtags,
        boardMode: this.modeDraft,
        privacy: this.privacyDraft,
        defaultActorId,
        seasonsFeedSlug: this.feedSlugDraft.trim(),
      });
    } else {
      this.create.emit({
        title,
        description,
        hashtags,
        boardMode: this.modeDraft,
        privacy: this.privacyDraft,
        defaultActorId,
        seasonsFeedSlug: this.feedSlugDraft.trim(),
        memberProfileIds: this.selectedMembers(),
      });
    }
    this.resetForm();
  }

  private resetForm(): void {
    this.titleDraft = '';
    this.descriptionDraft.set('');
    this.selectedHashtags.set([]);
    this.modeDraft = 'DIARY';
    this.privacyDraft = 'PRIVATE';
    this.defaultActorDraft = '';
    this.feedSlugDraft = '';
    this.selectedMembers.set([]);
  }
}
