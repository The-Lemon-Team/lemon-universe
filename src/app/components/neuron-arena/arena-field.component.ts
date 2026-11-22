import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArenaGameSubMode } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaCombineViewComponent } from './arena-combine-view.component';
import { getAccentPillClasses } from './arena-ui.utils';
import { ArenaVersusViewComponent } from './arena-versus-view.component';

@Component({
  selector: 'app-arena-field',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    ActorAvatarComponent,
    ArenaCombineViewComponent,
    ArenaVersusViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-field.component.html'
})
export class ArenaFieldComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentPillClasses = getAccentPillClasses;
  private readonly router = inject(Router);

  readonly gameSubMode = signal<ArenaGameSubMode>('COMBINE');

  openCardHistory(cardId: string): void {
    this.arena.inspectDesireCard(cardId);
    this.router.navigate(['/party/cards']);
  }

  scrollToSection(elementId: string): void {
    if (typeof document !== 'undefined') {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
