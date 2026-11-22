import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ArenaActorCard, ArenaActorCategory } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import { getAccentPillClasses } from './arena-ui.utils';
import { ArenaVoiceStudioComponent } from './arena-voice-studio.component';

type HeroSortOption = 'NAME' | 'CHARISMA' | 'ANALYTICAL' | 'REBEL' | 'VOICES';

@Component({
  selector: 'app-arena-heroes',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, ActorAvatarComponent, ArenaVoiceStudioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-heroes.component.html'
})
export class ArenaHeroesComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly router = inject(Router);
  protected readonly getAccentPillClasses = getAccentPillClasses;

  readonly selectedActorCategory = signal<'ALL' | ArenaActorCategory>('ALL');
  readonly sortOption = signal<HeroSortOption>('NAME');
  actorSearchQuery = '';

  readonly categoryFilters: { id: 'ALL' | ArenaActorCategory; label: string }[] = [
    { id: 'ALL', label: 'Все персонажи' },
    { id: 'HUMAN', label: '🏠 Главные герои и Друзья' },
    { id: 'MYTHIC', label: '⚡ Боги и Легенды' },
    { id: 'SAGE', label: '🧠 Учёные и Мудрецы' },
    { id: 'CYBER', label: '💻 Программисты и Кибер' },
  ];

  selectMainActor(actor: ArenaActorCard): void {
    this.arena.selectLeadActor(actor.id);
  }

  enterArenaWithActor(actor: ArenaActorCard): void {
    this.arena.selectLeadActor(actor.id);
    this.router.navigate(['/party']);
  }

  getCategoryCount(catId: 'ALL' | ArenaActorCategory, actors: ArenaActorCard[]): number {
    if (catId === 'ALL') return actors.length;
    return actors.filter((a) => a.category === catId).length;
  }

  getFilteredActors(actors: ArenaActorCard[]): ArenaActorCard[] {
    const cat = this.selectedActorCategory();
    const q = this.actorSearchQuery.trim().toLowerCase();
    const sort = this.sortOption();

    let result = actors.filter((a) => {
      if (cat !== 'ALL' && a.category !== cat) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.categoryLabel.toLowerCase().includes(q) ||
        a.quote.toLowerCase().includes(q) ||
        a.affinities.some((tag) => tag.toLowerCase().includes(q))
      );
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'CHARISMA':
          return b.traits.charisma - a.traits.charisma;
        case 'ANALYTICAL':
          return b.traits.analytical - a.traits.analytical;
        case 'REBEL':
          return b.traits.rebelVersus - a.traits.rebelVersus;
        case 'VOICES':
          return b.voicesCount - a.voicesCount;
        case 'NAME':
        default:
          return a.name.localeCompare(b.name, 'ru');
      }
    });

    return result;
  }
}
