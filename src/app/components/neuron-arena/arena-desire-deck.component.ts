import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { NeuralTrainingSample } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentAvatarClasses } from './arena-ui.utils';

@Component({
  selector: 'app-arena-desire-deck',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-desire-deck.component.html'
})
export class ArenaDesireDeckComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;

  @Output() readonly openNewCardModal = new EventEmitter<void>();

  readonly bottomTab = signal<'voices' | 'dataset'>('voices');

  exportTrainingJsonl(): void {
    let samples: NeuralTrainingSample[] = [];
    this.arena.trainingSamples$.subscribe((s) => (samples = s)).unsubscribe();
    const jsonl = samples.map((s) => JSON.stringify(s)).join('\n');
    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuron-arena-persona-dataset-${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
