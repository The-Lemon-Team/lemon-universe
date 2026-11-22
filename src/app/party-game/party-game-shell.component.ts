import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActorAvatarComponent } from '../components/neuron-arena/actor-avatar.component';
import { ArenaModalsComponent } from '../components/neuron-arena/arena-modals.component';
import { NeuronArenaService } from '../core/services/neuron-arena.service';
import { PartyRealtimeService } from '../core/services/party-realtime.service';
import { ThemeService } from '../core/services/theme.service';
import { PartySoundService } from './party-sound.service';

@Component({
  selector: 'app-party-game-shell',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ActorAvatarComponent,
    ArenaModalsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-game-shell.component.html'
})
export class PartyGameShellComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly realtime = inject(PartyRealtimeService);
  protected readonly sound = inject(PartySoundService);
  protected readonly theme = inject(ThemeService);

  protected readonly isRoomMenuOpen = signal(false);

  toggleRoomMenu(): void {
    this.isRoomMenuOpen.update((v) => !v);
  }

  selectRoom(roomId: string): void {
    this.realtime.switchRoom(roomId);
    this.isRoomMenuOpen.set(false);
  }
}
