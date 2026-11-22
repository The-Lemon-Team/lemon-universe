import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';

@Component({
  selector: 'app-arena-combine-history',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-combine-history.component.html'
})
export class ArenaCombineHistoryComponent {
  protected readonly arena = inject(NeuronArenaService);
}
