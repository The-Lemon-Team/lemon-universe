import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActorAvatarComponent } from '../components/neuron-arena/actor-avatar.component';
import { NeuronArenaService } from '../core/services/neuron-arena.service';
import { PartyRealtimeService } from '../core/services/party-realtime.service';
import { PartySoundService } from './party-sound.service';

@Component({
  selector: 'app-party-game-home',
  standalone: true,
  imports: [AsyncPipe, RouterLink, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-game-home.component.html'
})
export class PartyGameHomeComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly realtime = inject(PartyRealtimeService);
  protected readonly sound = inject(PartySoundService);
}
