import { Routes } from '@angular/router';
import { PartyGameHomeComponent } from './party-game-home.component';

export const partyGameRoutes: Routes = [
  {
    path: '',
    component: PartyGameHomeComponent,
    title: 'Главное Меню | Lemon Universe',
  },
  {
    path: 'field',
    loadComponent: () =>
      import('../components/neuron-arena/arena-field.component').then(
        (m) => m.ArenaFieldComponent,
      ),
    title: 'Игровое Поле & Схватки | Lemon Universe',
  },
  {
    path: 'cloud',
    loadComponent: () =>
      import('../components/neuron-arena/party-cloud.component').then(
        (m) => m.PartyCloudComponent,
      ),
    title: 'Хроно-Облако & TimeLines | Lemon Universe',
  },
  {
    path: 'cards',
    loadComponent: () =>
      import('../components/neuron-arena/party-cards.component').then(
        (m) => m.PartyCardsComponent,
      ),
    title: 'Карточки Желаний | Lemon Universe',
  },
  {
    path: 'heroes',
    loadComponent: () =>
      import('../components/neuron-arena/arena-heroes.component').then(
        (m) => m.ArenaHeroesComponent,
      ),
    title: 'Персонажи | Lemon Universe',
  },
  {
    path: 'chronicle',
    loadComponent: () =>
      import('../components/neuron-arena/party-chronicle.component').then(
        (m) => m.PartyChronicleComponent,
      ),
    title: 'Хроника Войсов & AI Датасет | Lemon Universe',
  },
  {
    path: 'roulette',
    loadComponent: () =>
      import('./party-roulette-page.component').then(
        (m) => m.PartyRoulettePageComponent,
      ),
    title: 'Колесо Фортуны & Рулетка | Lemon Universe',
  },
  {
    path: 'arena',
    redirectTo: 'field',
    pathMatch: 'full',
  },
];
