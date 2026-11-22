import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ArenaActorCard, ArenaActorCategory } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { ArenaHeroNotesModalComponent } from './arena-hero-notes-modal.component';
import { getAccentPillClasses } from './arena-ui.utils';
import { ArenaVoiceStudioComponent } from './arena-voice-studio.component';

@Component({
  selector: 'app-arena-actor-deck',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    ActorAvatarComponent,
    ArenaVoiceStudioComponent,
    ArenaHeroNotesModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-actor-deck.component.html'
})
export class ArenaActorDeckComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly selectedActorCategory = signal<'ALL' | ArenaActorCategory>('ALL');
  readonly selectedActorForNotes = signal<ArenaActorCard | null>(null);
  actorSearchQuery = '';

  readonly categoryFilters: { id: 'ALL' | ArenaActorCategory; label: string }[] = [
    { id: 'ALL', label: 'Все персонажи' },
    { id: 'HUMAN', label: '🏠 Главные герои, Друзья и Звёзды' },
    { id: 'MYTHIC', label: '⚡ Боги, Легенды и Религия' },
    { id: 'SAGE', label: '🧠 Учёные, Мудрецы и Тайная Ложа' },
    { id: 'CYBER', label: '💻 Программисты, Аниме и Антагонисты' },
  ];

  selectMainActor(actor: ArenaActorCard): void {
    this.arena.selectLeadActor(actor.id);
  }

  openHeroNotes(actor: ArenaActorCard, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedActorForNotes.set(actor);
  }

  filterActors(actors: ArenaActorCard[]): ArenaActorCard[] {
    const cat = this.selectedActorCategory();
    const q = this.actorSearchQuery.trim().toLowerCase();
    return actors.filter((a) => {
      if (cat !== 'ALL' && a.category !== cat) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.categoryLabel.toLowerCase().includes(q) ||
        a.affinities.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }
}
