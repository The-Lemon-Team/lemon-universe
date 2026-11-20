import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TimelinesWorkspaceComponent } from './timelines-workspace.component';

describe('TimelinesWorkspaceComponent', () => {
  let fixture: ComponentFixture<TimelinesWorkspaceComponent>;
  let component: TimelinesWorkspaceComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelinesWorkspaceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TimelinesWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const boardsReq = httpMock.match((req) => req.url.includes('/timelines/boards'));
    for (const req of boardsReq) {
      req.flush([
        {
          id: 'board-personal-diary',
          slug: 'personal-diary',
          title: '📓 Личный Дневник (Private)',
          description: 'Тестовый дневник',
          icon: 'menu_book',
          colorTheme: 'emerald',
          vibeId: 'NATURE_ZEN',
          boardKind: 'CUSTOM_PROJECT',
          boardMode: 'DIARY',
          privacy: 'PRIVATE',
          ownerProfileId: '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
          seasonsStreamSlug: 'lemon-universe',
          seasonsFeedSlug: 'universe-personal-diary',
          isDefault: false,
          members: [],
        },
      ]);
    }
    const notesReq = httpMock.match((req) => req.url.includes('/timelines/notes'));
    for (const req of notesReq) {
      req.flush([]);
    }
    fixture.detectChanges();
  });

  it('should create the standalone TimeLines workspace', () => {
    expect(component).toBeTruthy();
  });

  it('should render independent boards and members/privacy button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Новый TimeLine');
    expect(compiled.textContent).toContain('Members');
    expect(compiled.textContent).toContain('Сводка Агента');
  });

  it('should render cloud bubbles view with bottom timeline by default and allow switching to diary', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Облачка');
    expect(compiled.querySelector('app-timeline-cloud-view')).toBeTruthy();
    expect(compiled.textContent).toContain('Хроно-Шкала: 08:00 — 24:00');

    component.viewMode.set('DIARY_FEED');
    fixture.detectChanges();
    expect(compiled.querySelector('app-timeline-cloud-view')).toBeNull();
  });
});
