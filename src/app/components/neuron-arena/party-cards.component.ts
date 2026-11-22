import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ArenaDesireCard } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { getAccentAvatarClasses } from './arena-ui.utils';

@Component({
  selector: 'app-party-cards',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-cards.component.html'
})
export class PartyCardsComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  private readonly router = inject(Router);

  readonly selectedCategory = signal<string>('ALL');
  searchQuery = '';

  readonly categories = [
    { id: 'ALL', label: 'Все Карточки' },
    { id: 'Еда & Напитки', label: '🍕 Еда & Напитки' },
    { id: 'Игры & Драйв', label: '🎮 Игры & Драйв' },
    { id: 'Уют & Кино', label: '🍿 Кино & Отдых' },
    { id: 'Развитие', label: '📚 Развитие & Проекты' },
  ];

  playCardAndNavigate(card: ArenaDesireCard): void {
    this.arena.playDesireCardToField(card.id);
    this.router.navigate(['/party']);
  }

  getFilteredCards(cards: ArenaDesireCard[]): ArenaDesireCard[] {
    const cat = this.selectedCategory();
    const q = this.searchQuery.trim().toLowerCase();

    return cards.filter((c) => {
      if (cat !== 'ALL' && c.category !== cat) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.analyticsInsight.toLowerCase().includes(q)
      );
    });
  }
}
