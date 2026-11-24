import { Routes } from '@angular/router';
import { TimelinesShellComponent } from './components/timelines-shell.component';
import { TimelinesWorkspaceComponent } from './components/timelines-workspace.component';

export const timelinesRoutes: Routes = [
  {
    path: '',
    component: TimelinesShellComponent,
    children: [
      {
        path: '',
        component: TimelinesWorkspaceComponent,
        title: 'TimeLines & Дневники | Lemon Universe',
      },
      {
        path: 'notes/:noteId',
        component: TimelinesWorkspaceComponent,
        title: 'Сообщение TimeLine | Lemon Universe',
      },
      {
        path: ':boardSlug/notes/:noteId',
        component: TimelinesWorkspaceComponent,
        title: 'Сообщение TimeLine | Lemon Universe',
      },
      {
        path: ':boardSlug',
        component: TimelinesWorkspaceComponent,
        title: 'TimeLine Board | Lemon Universe',
      },
    ],
  },
];
