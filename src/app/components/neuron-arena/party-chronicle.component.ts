import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NeuralTrainingSample } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaVoiceStudioComponent } from './arena-voice-studio.component';

@Component({
  selector: 'app-party-chronicle',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, ActorAvatarComponent, ArenaVoiceStudioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-chronicle.component.html'
})
export class PartyChronicleComponent {
  protected readonly arena = inject(NeuronArenaService);

  readonly activeSection = signal<'voices' | 'dataset'>('voices');
  readonly selectedIntent = signal<string>('ALL');
  voiceFilterQuery = '';

  readonly intentFilters = [
    { id: 'ALL', label: 'Все сэмплы' },
    { id: 'SUPPORT', label: 'Поддержка (SUPPORT)' },
    { id: 'COUNTER_PROPOSE', label: 'Альтернатива (COUNTER_PROPOSE)' },
    { id: 'COMBINE_PITCH', label: 'Совмещение (COMBINE_PITCH)' },
  ];

  getFilteredVoices(voices: any[]) {
    const q = this.voiceFilterQuery.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter(
      (v) =>
        v.actorName.toLowerCase().includes(q) ||
        v.text.toLowerCase().includes(q) ||
        (v.threadTitle && v.threadTitle.toLowerCase().includes(q)),
    );
  }

  getFilteredSamples(samples: NeuralTrainingSample[]): NeuralTrainingSample[] {
    const intent = this.selectedIntent();
    if (intent === 'ALL') return samples;
    return samples.filter((s) => s.intent === intent);
  }

  exportTrainingJsonl(): void {
    let samples: NeuralTrainingSample[] = [];
    this.arena.trainingSamples$.subscribe((s) => (samples = s)).unsubscribe();
    const jsonl = samples.map((s) => JSON.stringify(s)).join('\n');
    if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lemon-universe-persona-dataset-${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
