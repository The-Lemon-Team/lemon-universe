import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  BoardMemberRole,
  BoardPrivacy,
  Profile,
  TimelineBoard,
  TimelineBoardMode,
} from '../../core/models/flow.models';
import { roleLabel } from '../timelines.privacy';

@Component({
  selector: 'app-timeline-members-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-members-modal.component.html'
})
export class TimelineMembersModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly board = input<TimelineBoard | null>(null);
  readonly profiles = input<Profile[]>([]);
  readonly canManage = input<boolean>(false);

  readonly close = output<void>();
  readonly saveBoardSettings = output<{ privacy: BoardPrivacy; boardMode: TimelineBoardMode }>();
  readonly addOrUpdateMember = output<{
    profileId: string;
    role: BoardMemberRole;
    canPost: boolean;
    canCrossLink: boolean;
  }>();
  readonly removeMember = output<string>();

  privacyDraft: BoardPrivacy = 'PRIVATE';
  modeDraft: TimelineBoardMode = 'TIMELINE';
  newMemberProfileId = '';
  newMemberRole: BoardMemberRole = 'AGENT';
  newMemberCanPost = true;
  newMemberCanCrossLink = true;

  constructor() {
    effect(() => {
      const b = this.board();
      if (this.isOpen() && b) {
        this.privacyDraft = b.privacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
        this.modeDraft = b.boardMode || 'TIMELINE';
      }
    });
  }

  getRoleLabel(role: BoardMemberRole): string {
    return roleLabel(role);
  }

  resolveProfileName(profileId: string, fallback?: string): string {
    if (fallback) return fallback;
    return this.profiles().find((p) => p.id === profileId)?.displayName || profileId;
  }

  addMember(): void {
    if (!this.newMemberProfileId) return;
    this.addOrUpdateMember.emit({
      profileId: this.newMemberProfileId,
      role: this.newMemberRole,
      canPost: this.newMemberRole === 'VIEWER' ? false : this.newMemberCanPost,
      canCrossLink: this.newMemberRole === 'VIEWER' ? false : this.newMemberCanCrossLink,
    });
    this.newMemberProfileId = '';
  }

  saveSettings(): void {
    this.saveBoardSettings.emit({
      privacy: this.privacyDraft,
      boardMode: this.modeDraft,
    });
    this.onClose();
  }

  onClose(): void {
    this.newMemberProfileId = '';
    this.newMemberRole = 'AGENT';
    this.newMemberCanPost = true;
    this.newMemberCanCrossLink = true;
    this.close.emit();
  }
}
