import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TimelinesWorkspaceComponent } from './timelines-workspace.component';

describe('TimelinesWorkspaceComponent', () => {
  let fixture: ComponentFixture<TimelinesWorkspaceComponent>;
  let component: TimelinesWorkspaceComponent;
  let httpMock: HttpTestingController;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [TimelinesWorkspaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
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

  it('should extract inline hashtags on submit and filter notes by hashtag', () => {
    component.composerText.set('Новая заметка с #Идея и #Релиз');
    component.composerSelectedTags.set(['diary', 'идея']);
    expect(component.composerPreviewTags()).toEqual(['идея', 'релиз', 'diary']);

    component.submitEntry();
    const createReqs = httpMock.match((req) => req.method === 'POST' && req.url.includes('/timelines/notes'));
    expect(createReqs.length).toBe(1);
    expect(createReqs[0].request.body.tags).toEqual(['идея', 'релиз', 'diary']);
    createReqs[0].flush(createReqs[0].request.body);
    fixture.detectChanges();

    expect(component.boardHashtagCounts().map((i) => i.tag)).toContain('релиз');

    component.toggleTagFilter('релиз');
    expect(component.visibleNotes().length).toBe(1);

    component.toggleTagFilter('несуществующий');
    expect(component.visibleNotes().length).toBe(0);
  });

  it('should support board-level hashtags on TimeLine creation and filtering', () => {
    component.handleCreateBoard({
      title: 'Проектный Борд',
      description: 'Задачи по #Релиз',
      hashtags: ['архитектура', '#релиз'],
      boardMode: 'TIMELINE',
      privacy: 'PUBLIC',
      defaultActorId: 'actor-alexey',
      seasonsFeedSlug: 'universe-project',
      memberProfileIds: [],
    });

    const createBoardReqs = httpMock.match(
      (req) => req.method === 'POST' && req.url.includes('/timelines/boards'),
    );
    expect(createBoardReqs.length).toBe(1);
    expect(createBoardReqs[0].request.body.hashtags).toEqual(['релиз', 'архитектура']);
    createBoardReqs[0].flush(createBoardReqs[0].request.body);
    fixture.detectChanges();

    expect(component.allBoardHashtags().map((i) => i.tag)).toContain('архитектура');
    component.toggleBoardHashtagFilter('архитектура');
    expect(component.filteredBoards().length).toBe(1);
    expect(component.filteredBoards()[0].title).toBe('Проектный Борд');
  });

  it('should trigger submitEntry on Enter keydown in composer and ignore Shift+Enter', () => {
    spyOn(component, 'submitEntry');

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    spyOn(enterEvent, 'preventDefault');
    component.onComposerKeydown(enterEvent);

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(component.submitEntry).toHaveBeenCalledTimes(1);

    const shiftEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
    spyOn(shiftEnterEvent, 'preventDefault');
    component.onComposerKeydown(shiftEnterEvent);

    expect(shiftEnterEvent.preventDefault).not.toHaveBeenCalled();
    expect(component.submitEntry).toHaveBeenCalledTimes(1);
  });

  it('should render TimePickerPopoverComponent when composer is expanded and update composerTime', () => {
    component.composerExpanded.set(true);
    fixture.detectChanges();

    const timePickerEl = fixture.nativeElement.querySelector('app-time-picker-popover');
    expect(timePickerEl).toBeTruthy();

    component.composerTime.set('18:30');
    fixture.detectChanges();
    expect(timePickerEl.textContent).toContain('18:30');
  });

  it('should persist a note created interactively from the cloud view via handleCloudCreateNote', () => {
    component.handleCloudCreateNote({
      time: '15:30',
      type: 'proposal',
      title: 'Точка на графике',
      text: 'Создано кликом по графику #идея',
      tags: ['идея'],
    });

    const createReqs = httpMock.match((req) => req.method === 'POST' && req.url.includes('/timelines/notes'));
    expect(createReqs.length).toBe(1);
    expect(createReqs[0].request.body.time).toBe('15:30');
    expect(createReqs[0].request.body.type).toBe('proposal');
    expect(createReqs[0].request.body.title).toBe('Точка на графике');
    expect(createReqs[0].request.body.text).toBe('Создано кликом по графику #идея');
    createReqs[0].flush(createReqs[0].request.body);
    fixture.detectChanges();

    expect(component.composerTime()).toBe('15:30');
    expect(component.visibleNotes().some((n) => n.text.includes('Создано кликом по графику'))).toBeTrue();
  });

  it('should capture weather snapshot in bottom composer and send it when creating a note', () => {
    const el = fixture.nativeElement as HTMLElement;
    const weatherBtn = el.querySelector('[data-test-id="composer-capture-weather-btn"]') as HTMLButtonElement;
    expect(weatherBtn).toBeTruthy();

    weatherBtn.click();
    fixture.detectChanges();
    expect(component.composerWeather()).toBeTruthy();
    expect(el.querySelector('[data-test-id="composer-weather-chip"]')).toBeTruthy();

    component.composerText.set('Заметка с зафиксированной погодой');
    component.submitEntry();

    const createReqs = httpMock.match((req) => req.method === 'POST' && req.url.includes('/timelines/notes'));
    expect(createReqs.length).toBe(1);
    expect(createReqs[0].request.body.weather).toBeTruthy();
    expect(createReqs[0].request.body.weather.locationName).toBeTruthy();
    createReqs[0].flush(createReqs[0].request.body);
    fixture.detectChanges();

    expect(component.composerWeather()).toBeNull();
  });

  it('should capture world moment snapshot in bottom composer and send it when creating a note', () => {
    const el = fixture.nativeElement as HTMLElement;
    const momentBtn = el.querySelector('[data-test-id="composer-capture-moment-btn"]') as HTMLButtonElement;
    expect(momentBtn).toBeTruthy();

    momentBtn.click();
    fixture.detectChanges();
    expect(component.composerWorldMoment()).toBeTruthy();
    expect(el.querySelector('[data-test-id="composer-moment-chip"]')).toBeTruthy();

    component.composerText.set('Заметка с зафиксированным моментом мира');
    component.submitEntry();

    const createReqs = httpMock.match((req) => req.method === 'POST' && req.url.includes('/timelines/notes'));
    expect(createReqs.length).toBe(1);
    expect(createReqs[0].request.body.worldMoment).toBeTruthy();
    expect(createReqs[0].request.body.worldMoment.title).toBeTruthy();
    createReqs[0].flush(createReqs[0].request.body);
    fixture.detectChanges();

    expect(component.composerWorldMoment()).toBeNull();
  });

  it('should resolve a deep-linked note route, switch dateKey, clear conflicting tag filter, and highlight the note', () => {
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    component.composerText.set('Сообщение для диплинка #релиз');
    component.selectedDateKey.set('2026-11-10');
    component.submitEntry();

    const createReqs = httpMock.match((req) => req.method === 'POST' && req.url.includes('/timelines/notes'));
    expect(createReqs.length).toBe(1);
    const createdNote = { ...createReqs[0].request.body, id: 'note-deep-1', boardId: 'board-personal-diary' };
    createReqs[0].flush(createdNote);
    fixture.detectChanges();

    // Switch to another date and conflicting tag filter
    component.selectedDateKey.set('2026-11-23');
    component.selectedTagFilter.set('другой-тег');
    component.viewMode.set('DIARY_FEED');
    fixture.detectChanges();

    // Trigger deep-link via /timelines/notes/:noteId (no boardSlug)
    paramMap$.next(convertToParamMap({ noteId: 'note-deep-1' }));
    fixture.detectChanges();

    expect(component.selectedDateKey()).toBe('2026-11-10');
    expect(component.selectedTagFilter()).toBeNull();
    expect(component.highlightedNoteId()).toBe('note-deep-1');
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/timelines', 'personal-diary', 'notes', 'note-deep-1'],
      { replaceUrl: true },
    );

    const el = fixture.nativeElement as HTMLElement;
    const article = el.querySelector('[data-note-id="note-deep-1"]');
    expect(article).toBeTruthy();
    expect(article?.classList.contains('ring-2')).toBeTrue();
  });

  it('should navigate to target note route when jumping to cross-ref or pinned note', () => {
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    component.jumpToCrossRef({
      id: 'xref-1',
      targetBoardId: 'board-personal-diary',
      targetBoardTitle: 'Личный Дневник',
      targetBoardIcon: 'menu_book',
      targetNoteId: 'note-target-99',
      targetDateKey: '2026-11-18',
      targetTime: '14:00',
      targetActorId: 'actor-easy',
      targetActorName: 'Easy (Изи)',
      targetActorAvatar: 'easy',
      targetSnippet: 'Тест',
      relationLabel: 'Ссылка',
    });

    expect(component.selectedDateKey()).toBe('2026-11-18');
    expect(component.highlightedNoteId()).toBe('note-target-99');
    expect(navigateSpy).toHaveBeenCalledWith([
      '/timelines',
      'personal-diary',
      'notes',
      'note-target-99',
    ]);

    component.pinnedSidebarOpen.set(true);
    component.jumpToPinnedNote({
      id: 'note-pinned-7',
      boardId: 'board-personal-diary',
      dateKey: '2026-11-19',
      time: '09:30',
      timeMinutes: 570,
      actorId: 'actor-easy',
      actorName: 'Easy (Изи)',
      actorAvatar: 'easy',
      actorAccent: 'cyan',
      type: 'thought',
      text: 'Закреплено',
      votesCount: 1,
      supporters: [],
      createdAt: '2026-11-19T09:30:00.000Z',
    });

    expect(component.pinnedSidebarOpen()).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith([
      '/timelines',
      'personal-diary',
      'notes',
      'note-pinned-7',
    ]);
  });

  it('should fallback to GET /timelines/notes/:noteId and report error when deep-linked note is missing', () => {
    paramMap$.next(convertToParamMap({ boardSlug: 'personal-diary', noteId: 'missing-note-404' }));
    fixture.detectChanges();

    const lookupReqs = httpMock.match(
      (req) => req.method === 'GET' && req.url.includes('/timelines/notes/missing-note-404'),
    );
    expect(lookupReqs.length).toBe(1);
    lookupReqs[0].flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(component.statusMessage()).toContain('Сообщение не найдено');
  });
});
