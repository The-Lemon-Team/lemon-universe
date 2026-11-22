import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CombineActivitySuggestion } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaCombineHistoryComponent } from './arena-combine-history.component';
import { getAccentAvatarClasses, getAccentPillClasses } from './arena-ui.utils';

@Component({
  selector: 'app-arena-combine-view',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, ActorAvatarComponent, ArenaCombineHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-combine-view.component.html'
})
export class ArenaCombineViewComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  combineNewIdeaTitle = '';
  replacementInputByCardId: Record<string, string> = {};

  submitCombineIdea(): void {
    const cleanTitle = this.combineNewIdeaTitle.trim();
    if (!cleanTitle) return;
    this.arena.proposeNewCombineSuggestion({
      title: cleanTitle,
      pinImmediately: true,
    });
    this.combineNewIdeaTitle = '';
  }

  triggerBoredReplacement(pinned: CombineActivitySuggestion): void {
    const replacementTitle = (this.replacementInputByCardId[pinned.id] || 'Слушать подкаст').trim();
    this.arena.replaceBoredSuggestionWithNewCard(pinned.id, replacementTitle || 'Слушать подкаст');
    delete this.replacementInputByCardId[pinned.id];
  }
}
