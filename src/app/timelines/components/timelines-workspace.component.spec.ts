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
});
