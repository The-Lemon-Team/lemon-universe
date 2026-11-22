import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses, getAccentPillClasses, getBarBgClass } from './arena-ui.utils';

@Component({
  selector: 'app-arena-versus-view',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-versus-view.component.html'
})
export class ArenaVersusViewComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;
  protected readonly getBarBgClass = getBarBgClass;

  @Output() readonly inspectCardHistory = new EventEmitter<string>();
}
