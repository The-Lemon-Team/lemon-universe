import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { ArenaActorCategory } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { IconCatalogItem } from '../icon-picker/icon-catalog';
import { IconPickerComponent } from '../icon-picker/icon-picker.component';

@Component({
  selector: 'app-arena-modals',
  standalone: true,
  imports: [AsyncPipe, FormsModule, ModalOverlayDirective, IconPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-modals.component.html'
})
export class ArenaModalsComponent {
  protected readonly arena = inject(NeuronArenaService);

  @Input() showNewDesireCardModal = false;
  @Input() showNewActorModal = false;
  @Input() showNewParadoxModal = false;

  @Output() readonly closeNewDesireCardModal = new EventEmitter<void>();
  @Output() readonly closeNewActorModal = new EventEmitter<void>();
  @Output() readonly closeNewParadoxModal = new EventEmitter<void>();

  newCardTitle = '';
  newCardCategory = 'Настолки & Азарт';
  newCardIcon = 'casino';
  newCardDescription = '';
  newCardPlayImmediately = true;
  suggestedCategoryNotice = '';

  onCardIconSelected(item: IconCatalogItem): void {
    // If the category hasn't been heavily customized by user or matches the previous default,
    // smartly adapt the category to match the chosen icon!
    if (!this.newCardCategory.trim() || this.newCardCategory === 'Настолки & Азарт') {
      if (item.suggestedCategory) {
        this.newCardCategory = item.suggestedCategory;
        this.suggestedCategoryNotice = `✨ Категория: «${item.suggestedCategory}»`;
        setTimeout(() => {
          this.suggestedCategoryNotice = '';
        }, 3500);
      }
    }
  }

  newActorName = '';
  newActorTitle = '';
  newActorCategory: ArenaActorCategory = 'MYTHIC';
  newActorFavoriteDesire = 'Поиграть в настольную игру';
  newActorQuote = '';
  newActorPhilosophy = '';

  newParadoxTitle = '';
  newParadoxStarterCardId = 'card-drink-beer';
  newParadoxQuestion = '';

  onCloseDesireCardModal(): void {
    this.newCardTitle = '';
    this.newCardDescription = '';
    this.newCardCategory = 'Настолки & Азарт';
    this.newCardIcon = 'casino';
    this.suggestedCategoryNotice = '';
    this.closeNewDesireCardModal.emit();
  }

  onCloseActorModal(): void {
    this.newActorName = '';
    this.newActorTitle = '';
    this.newActorQuote = '';
    this.newActorPhilosophy = '';
    this.closeNewActorModal.emit();
  }

  onCloseParadoxModal(): void {
    this.newParadoxTitle = '';
    this.newParadoxQuestion = '';
    this.closeNewParadoxModal.emit();
  }

  submitNewDesireCard(): void {
    if (!this.newCardTitle.trim()) return;
    this.arena.createDesireCard({
      title: this.newCardTitle,
      category: this.newCardCategory,
      description: this.newCardDescription,
      icon: this.newCardIcon,
      colorTheme: 'violet',
      playImmediately: this.newCardPlayImmediately,
    });
    this.newCardTitle = '';
    this.newCardDescription = '';
    this.newCardCategory = 'Настолки & Азарт';
    this.newCardIcon = 'casino';
    this.suggestedCategoryNotice = '';
    this.closeNewDesireCardModal.emit();
  }

  submitNewActor(): void {
    if (!this.newActorName.trim()) return;
    this.arena.createActorCard({
      name: this.newActorName,
      title: this.newActorTitle,
      category: this.newActorCategory,
      avatarIcon: this.newActorCategory === 'MYTHIC' ? 'zeus' : 'alexey',
      accentColor: this.newActorCategory === 'MYTHIC' ? 'emerald' : 'amber',
      quote: this.newActorQuote,
      paradoxPhilosophy: this.newActorPhilosophy,
      favoriteDesire: this.newActorFavoriteDesire,
    });
    this.newActorName = '';
    this.newActorTitle = '';
    this.newActorQuote = '';
    this.newActorPhilosophy = '';
    this.closeNewActorModal.emit();
  }

  submitNewParadox(): void {
    if (!this.newParadoxTitle.trim()) return;
    this.arena.createParadoxField({
      title: this.newParadoxTitle,
      occasionTag: 'Тимбилдинг · Битва Карточек Желаний',
      contextStory:
        'Новый раунд командной синхронизации: персонажи выбрасывают карточки желаний из колоды и проверяют, что выйдет вперёд на этот раз!',
      paradoxQuestion:
        this.newParadoxQuestion.trim() ||
        'Какая карточка желания соберёт максимальный резонанс команды в этом периоде?',
      starterDesireCardId: this.newParadoxStarterCardId,
    });
    this.newParadoxTitle = '';
    this.newParadoxQuestion = '';
    this.closeNewParadoxModal.emit();
  }
}
