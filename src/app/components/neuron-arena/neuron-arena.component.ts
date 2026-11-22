import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ArenaGameSubMode } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ArenaActorDeckComponent } from './arena-actor-deck.component';
import { ArenaCombineViewComponent } from './arena-combine-view.component';
import { ArenaDesireDeckComponent } from './arena-desire-deck.component';
import { ArenaModalsComponent } from './arena-modals.component';
import { ArenaVersusViewComponent } from './arena-versus-view.component';
import { PartyCloudComponent } from './party-cloud.component';

@Component({
  selector: 'app-neuron-arena',
  standalone: true,
  imports: [
    AsyncPipe,
    ArenaActorDeckComponent,
    ArenaCombineViewComponent,
    ArenaVersusViewComponent,
    ArenaDesireDeckComponent,
    ArenaModalsComponent,
    PartyCloudComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './neuron-arena.component.html'
})
export class NeuronArenaComponent {
  protected readonly arena = inject(NeuronArenaService);

  readonly gameSubMode = signal<ArenaGameSubMode>('COMBINE');
  readonly showNewDesireCardModal = signal(false);
  readonly showNewActorModal = signal(false);
  readonly showNewParadoxModal = signal(false);

  openCardHistory(cardId: string): void {
    this.arena.inspectDesireCard(cardId);
    this.scrollToSection('desire-deck-section');
  }

  scrollToSection(elementId: string): void {
    if (typeof document !== 'undefined') {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
