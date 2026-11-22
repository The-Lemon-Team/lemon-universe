import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { PlayerType, Profile } from '../../core/models/flow.models';
import { ProfileService } from '../../core/services/profile.service';
import { PwaService } from '../../core/services/pwa.service';
import { ThemeService } from '../../core/services/theme.service';
import { TimelinesService } from '../services/timelines.service';

@Component({
  selector: 'app-timelines-shell',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, RouterOutlet, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timelines-shell.component.html'
})
export class TimelinesShellComponent {
  protected readonly profileService = inject(ProfileService);
  protected readonly pwa = inject(PwaService);
  protected readonly theme = inject(ThemeService);
  protected readonly timelinesService = inject(TimelinesService);

  readonly isNewAccountModalOpen = signal(false);
  newAccountType: PlayerType = 'AGENT';
  newAccountName = '';
  newAccountHandle = '';
  newAccountSeasonsUserId = '';
  newAccountSeasonsUserKey = '';

  selectProfile(profile: Profile): void {
    this.profileService.selectProfile(profile.id);
  }

  selectTimeline(boardId: string): void {
    this.timelinesService.selectBoard(boardId);
  }

  openNewAccountModal(): void {
    this.newAccountType = 'AGENT';
    this.newAccountName = '';
    this.newAccountHandle = '';
    this.newAccountSeasonsUserId = '';
    this.newAccountSeasonsUserKey = '';
    this.isNewAccountModalOpen.set(true);
  }

  closeNewAccountModal(): void {
    this.newAccountName = '';
    this.newAccountHandle = '';
    this.newAccountSeasonsUserId = '';
    this.newAccountSeasonsUserKey = '';
    this.isNewAccountModalOpen.set(false);
  }

  submitNewAccount(): void {
    const displayName = this.newAccountName.trim();
    const handle = this.newAccountHandle.trim();
    if (!displayName || !handle) return;

    this.profileService
      .registerProfile({
        handle,
        displayName,
        playerType: this.newAccountType,
        avatarIcon: this.newAccountType === 'AGENT' ? 'smart_toy' : 'person',
        seasonsUserId: this.newAccountSeasonsUserId.trim() || undefined,
        seasonsUserKey: this.newAccountSeasonsUserKey.trim() || undefined,
      })
      .subscribe({
        next: () => this.closeNewAccountModal(),
        error: () => this.closeNewAccountModal(),
      });
  }
}
