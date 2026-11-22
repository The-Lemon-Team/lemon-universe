import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeuronArenaService } from '../core/services/neuron-arena.service';
import { PartyRealtimeService } from '../core/services/party-realtime.service';
import { PartyRouletteComponent } from './party-roulette.component';

@Component({
  selector: 'app-party-roulette-page',
  standalone: true,
  imports: [AsyncPipe, RouterLink, PartyRouletteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-roulette-page.component.html'
})
export class PartyRoulettePageComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly realtime = inject(PartyRealtimeService);
}
