import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getCelestialOrbState, resolveTimelineClickTime } from '../../components/neuron-arena/cloud-timeline.utils';
import { CloudDayNote } from '../../core/models/flow.models';
import { TimelineCloudViewComponent } from './timeline-cloud-view.component';

function makeNote(partial: Partial<CloudDayNote>): CloudDayNote {
  return {
    id: partial.id ?? 'note-1',
    dateKey: partial.dateKey ?? '2026-11-19',
    time: partial.time ?? '12:00',
    timeMinutes: partial.timeMinutes ?? 720,
    actorId: partial.actorId ?? 'actor-alexey',
    actorName: partial.actorName ?? 'Алексей',
    actorAvatar: partial.actorAvatar ?? 'person',
    actorAccent: partial.actorAccent ?? 'amber',
    type: partial.type ?? 'thought',
    text: partial.text ?? 'Тестовое сообщение в облачке',
    votesCount: partial.votesCount ?? 0,
    supporters: partial.supporters ?? [],
    createdAt: partial.createdAt ?? '2026-11-19T12:00:00.000Z',
    ...partial,
  };
}

describe('TimelineCloudViewComponent', () => {
  let fixture: ComponentFixture<TimelineCloudViewComponent>;
  let component: TimelineCloudViewComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TimelineCloudViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineCloudViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('notes', [
      makeNote({ id: 'n1', time: '10:00', timeMinutes: 600, text: 'Утренняя мысль' }),
      makeNote({ id: 'n2', time: '10:15', timeMinutes: 615, text: 'Вторая мысль в стопке', actorName: 'Миша' }),
      makeNote({ id: 'n3', time: '18:00', timeMinutes: 1080, text: 'Вечерняя заметка' }),
    ]);
    fixture.componentRef.setInput('selectedDateKey', '2026-11-19');
    fixture.componentRef.setInput('canPost', true);
    fixture.detectChanges();
  });

  it('should render bubbles and bottom timeline milestones', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Хроно-Облако');
    expect(el.textContent).toContain('08:00');
    expect(el.textContent).toContain('24:00');
    expect(el.textContent).toContain('3 сообщения');
    expect(el.textContent).toContain('Утренняя мысль');
    expect(el.textContent).toContain('Вечерняя заметка');
  });

  it('should cluster notes within 30 minutes and cycle through stack', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1/2');
    const nextBtn = el.querySelector('button[title="Следующее сообщение в стопке"]') as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    nextBtn.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('2/2');
    expect(el.textContent).toContain('Вторая мысль в стопке');
  });

  it('should open inspect modal when clicking a bubble and close it', () => {
    const note = component.notes()[2];
    component.openInspectModal(note);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('Вечерняя заметка');

    component.closeInspectModal();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should render inline hashtags, emit tagClick, and update tags on edit', () => {
    fixture.componentRef.setInput('notes', [
      makeNote({ id: 'n-tag', text: 'Обсудили #релиз и #идея', tags: ['релиз', 'идея', 'diary'] }),
    ]);
    fixture.detectChanges();

    const clickedTags: string[] = [];
    component.tagClick.subscribe((tag) => clickedTags.push(tag));

    const el = fixture.nativeElement as HTMLElement;
    const inlineBtn = Array.from(el.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === '#релиз',
    ) as HTMLButtonElement | undefined;
    expect(inlineBtn).toBeTruthy();
    inlineBtn?.click();
    expect(clickedTags).toContain('релиз');

    const editedPayloads: Array<{ noteId: string; title?: string; text: string; tags?: string[] }> = [];
    component.editNote.subscribe((p) => editedPayloads.push(p));

    const note = component.notes()[0];
    component.openInspectModal(note);
    component.startEditInspectedNote(note);
    expect(component.editSelectedTags()).toEqual(['diary']);
    component.editTextDraft.set('Обсудили #релиз и #финал');
    component.saveEditedInspectedNote(note);

    expect(editedPayloads[0].tags).toEqual(['релиз', 'финал', 'diary']);
  });

  it('should compute celestial orb morphing from moon to sun and back to moon', () => {
    const dawn = getCelestialOrbState(8 * 60);
    const noon = getCelestialOrbState(13 * 60 + 30);
    const night = getCelestialOrbState(22 * 60 + 30);

    expect(dawn.moonFactor).toBeGreaterThan(0.7);
    expect(dawn.phaseLabel).toBe('Рассвет');
    expect(noon.moonFactor).toBe(0);
    expect(noon.sunRaysOpacity).toBe(1);
    expect(noon.bottomPercent).toBeGreaterThan(dawn.bottomPercent);
    expect(night.moonFactor).toBeGreaterThan(0.75);
    expect(night.starsOpacity).toBeGreaterThan(0);
    expect(night.phaseLabel).toBe('Ночная луна');
  });

  it('should switch between beam and orb NOW indicator modes', () => {
    fixture.componentRef.setInput('showAllDates', true);
    fixture.detectChanges();

    component.setNowIndicatorMode('beam');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Сейчас');

    component.setNowIndicatorMode('orb');
    fixture.detectChanges();
    expect(el.textContent).toContain('% дня');
  });

  it('should resolve timeline click coordinates to 15-minute snapped timestamps', () => {
    const rect = { left: 0, width: 1000 };
    expect(resolveTimelineClickTime(0, rect)).toEqual({ time: '08:00', timeMinutes: 480 });
    expect(resolveTimelineClickTime(500, rect)).toEqual({ time: '16:00', timeMinutes: 960 });
    expect(resolveTimelineClickTime(1000, rect)).toEqual({ time: '23:45', timeMinutes: 1425 });
  });

  it('should immediately open an editable draft bubble on sky canvas click and emit createNote on save', () => {
    const el = fixture.nativeElement as HTMLElement;
    const sky = el.querySelector('.cloud-sky-canvas') as HTMLElement;
    expect(sky).toBeTruthy();

    spyOn(sky, 'getBoundingClientRect').and.returnValue({
      left: 0,
      width: 1000,
      top: 0,
      height: 540,
      right: 1000,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const selectedTimes: string[] = [];
    const createdPayloads: Array<{ time: string; type: string; title?: string; text: string; tags?: string[] }> = [];
    component.timeSelected.subscribe((t) => selectedTimes.push(t));
    component.createNote.subscribe((p) => createdPayloads.push(p));

    sky.dispatchEvent(new MouseEvent('click', { clientX: 500, bubbles: true }));
    fixture.detectChanges();

    expect(selectedTimes).toEqual(['16:00']);
    expect(component.draftTime()).toBe('16:00');
    expect(el.textContent).toContain('Новая');

    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    component.draftTitle.set('Встреча');
    component.draftType.set('proposal');
    component.draftText.set('Обсудить план #релиз');
    component.draftSelectedTags.set(['важно']);
    fixture.detectChanges();

    const saveBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Сохранить'),
    ) as HTMLButtonElement;
    expect(saveBtn).toBeTruthy();
    saveBtn.click();
    fixture.detectChanges();

    expect(createdPayloads.length).toBe(1);
    expect(createdPayloads[0]).toEqual({
      time: '16:00',
      type: 'proposal',
      title: 'Встреча',
      text: 'Обсудить план #релиз',
      tags: ['релиз', 'важно'],
    });
    expect(component.draftTime()).toBeNull();
  });

  it('should cancel draft bubble on Escape or Cancel and not open draft when canPost is false', () => {
    const el = fixture.nativeElement as HTMLElement;
    const sky = el.querySelector('.cloud-sky-canvas') as HTMLElement;
    spyOn(sky, 'getBoundingClientRect').and.returnValue({
      left: 0,
      width: 1000,
      top: 0,
      height: 540,
      right: 1000,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    sky.dispatchEvent(new MouseEvent('click', { clientX: 250, bubbles: true }));
    fixture.detectChanges();
    expect(component.draftTime()).toBeTruthy();

    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.draftTime()).toBeNull();

    fixture.componentRef.setInput('canPost', false);
    fixture.detectChanges();
    sky.dispatchEvent(new MouseEvent('click', { clientX: 500, bubbles: true }));
    fixture.detectChanges();
    expect(component.draftTime()).toBeNull();
  });

  it('should not trigger sky click draft creation when clicking an existing bubble', () => {
    const el = fixture.nativeElement as HTMLElement;
    const bubble = el.querySelector('[data-cloud-interactive="true"] .cursor-pointer') as HTMLElement;
    expect(bubble).toBeTruthy();
    bubble.click();
    fixture.detectChanges();

    expect(component.draftTime()).toBeNull();
    expect(component.inspectedNote()).toBeTruthy();
  });

  it('should open settlement & weather modal, switch location and weather mode, and update satellite & sky animations', async () => {
    fixture.componentRef.setInput('showAllDates', true);
    component.setNowIndicatorMode('orb');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const weatherTrigger = el.querySelector('[data-test-id="weather-location-trigger"]') as HTMLButtonElement;
    expect(weatherTrigger).toBeTruthy();
    weatherTrigger.click();
    fixture.detectChanges();

    expect(component.isWeatherModalOpen()).toBeTrue();
    expect(el.textContent).toContain('Погода и Населённый пункт');

    // Switch weather condition to rain and verify orb and sky atmosphere react
    const rainBtn = el.querySelector('[data-test-id="weather-condition-rain"]') as HTMLButtonElement;
    expect(rainBtn).toBeTruthy();
    rainBtn.click();
    fixture.detectChanges();

    expect(component.celestialWeatherOrb().condition).toBe('rain');
    expect(component.celestialWeatherOrb().rainDrops.length).toBeGreaterThan(0);

    const skyAtmo = el.querySelector('[data-test-id="sky-weather-atmosphere"]') as HTMLElement;
    expect(skyAtmo).toBeTruthy();
    expect(skyAtmo.getAttribute('data-weather-condition')).toBe('rain');

    // Switch to snow
    component.selectConditionOverride('snow');
    fixture.detectChanges();
    expect(component.celestialWeatherOrb().condition).toBe('snow');
    expect(component.celestialWeatherOrb().snowFlakes.length).toBe(4);
    expect(skyAtmo.getAttribute('data-weather-condition')).toBe('snow');

    component.closeWeatherModal();
    fixture.detectChanges();
    expect(component.isWeatherModalOpen()).toBeFalse();
  });

  it('should capture immutable weather snapshot in draft bubble and emit it in createNote', () => {
    const el = fixture.nativeElement as HTMLElement;
    const sky = el.querySelector('.cloud-sky-canvas') as HTMLElement;
    spyOn(sky, 'getBoundingClientRect').and.returnValue({
      left: 0,
      width: 1000,
      top: 0,
      height: 540,
      right: 1000,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    component.selectConditionOverride('rain');
    sky.dispatchEvent(new MouseEvent('click', { clientX: 500, bubbles: true }));
    fixture.detectChanges();

    const captureBtn = el.querySelector('[data-test-id="draft-capture-weather-btn"]') as HTMLButtonElement;
    expect(captureBtn).toBeTruthy();
    captureBtn.click();
    fixture.detectChanges();

    expect(component.draftWeather()).toBeTruthy();
    expect(component.draftWeather()?.condition).toBe('rain');
    expect(el.querySelector('[data-test-id="draft-weather-chip"]')).toBeTruthy();

    const createdPayloads: any[] = [];
    component.createNote.subscribe((p) => createdPayloads.push(p));

    component.draftText.set('Прогулка под дождём #погода');
    fixture.detectChanges();
    component.saveDraftNote();

    expect(createdPayloads.length).toBe(1);
    expect(createdPayloads[0].weather).toBeTruthy();
    expect(createdPayloads[0].weather.condition).toBe('rain');
    expect(createdPayloads[0].weather.label).toBe('Дождь');
  });

  it('should render captured weather badge on note bubble and allow stamping weather in inspect modal', () => {
    fixture.componentRef.setInput('notes', [
      makeNote({
        id: 'n-weather',
        time: '14:00',
        timeMinutes: 840,
        text: 'Снежный день',
        weather: {
          condition: 'snow',
          temperatureC: -4,
          feelsLikeC: -7,
          locationName: 'Новосибирск',
          label: 'Снег',
          icon: '❄️',
          capturedAt: '2026-11-19T14:00:00.000Z',
        },
      }),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-test-id="note-weather-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('-4°C');
    expect(badge?.textContent).toContain('Новосибирск');

    const editedPayloads: any[] = [];
    component.editNote.subscribe((p) => editedPayloads.push(p));

    component.selectConditionOverride('fog');
    component.openInspectModal(component.notes()[0]);
    fixture.detectChanges();

    expect(el.querySelector('[data-test-id="inspect-note-weather-card"]')).toBeTruthy();

    const stampBtn = el.querySelector('[data-test-id="inspect-stamp-weather-btn"]') as HTMLButtonElement;
    expect(stampBtn).toBeTruthy();
    stampBtn.click();
    fixture.detectChanges();

    expect(editedPayloads.length).toBe(1);
    expect(editedPayloads[0].weather?.condition).toBe('fog');
    expect(editedPayloads[0].weather?.label).toBe('Туман');
  });

  it('should render the Hashtag Cloud Satellite on the orbit and open the Lemon Watchers World Pulse modal on click', () => {
    fixture.componentRef.setInput('showAllDates', true);
    component.setNowIndicatorMode('orb');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const hashtagSat = el.querySelector('[data-test-id="hashtag-cloud-satellite"]') as HTMLElement;
    expect(hashtagSat).toBeTruthy();
    expect(hashtagSat.textContent).toContain('Пульс мира');
    expect(hashtagSat.textContent).toContain('#ИИ-агенты');

    hashtagSat.click();
    fixture.detectChanges();

    expect(component.isWorldPulseModalOpen()).toBeTrue();
    expect(el.textContent).toContain('Спутник «Облако Хештегов» · Главное в мире');
    expect(el.querySelector('[data-test-id="world-pulse-hashtag-cloud"]')).toBeTruthy();
    expect(el.querySelector('[data-test-id="world-pulse-best-moments"]')).toBeTruthy();
    expect(el.querySelector('[data-test-id="world-pulse-cards-grid"]')).toBeTruthy();

    // Filter by hashtag inside the modal
    const tagBtn = el.querySelector('[data-test-id="watcher-hashtag-орбита-дня"]') as HTMLButtonElement;
    expect(tagBtn).toBeTruthy();
    tagBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-test-id="selected-watcher-hashtag-banner"]')).toBeTruthy();

    component.closeWorldPulseModal();
    fixture.detectChanges();
    expect(component.isWorldPulseModalOpen()).toBeFalse();
  });

  it('should capture a world moment from the World Pulse modal or draft bubble and emit it in createNote', () => {
    fixture.componentRef.setInput('showAllDates', true);
    component.openWorldPulseModal();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const captureCardBtn = el.querySelector('[data-test-id="capture-best-moment-moment-ai-swarm"]') as HTMLButtonElement;
    expect(captureCardBtn).toBeTruthy();
    captureCardBtn.click();
    fixture.detectChanges();

    expect(component.isWorldPulseModalOpen()).toBeFalse();
    expect(component.draftTime()).toBeTruthy();
    expect(component.draftWorldMoment()).toBeTruthy();
    expect(component.draftWorldMoment()?.momentId).toBe('moment-ai-swarm');
    expect(el.querySelector('[data-test-id="draft-world-moment-chip"]')).toBeTruthy();

    const createdPayloads: any[] = [];
    component.createNote.subscribe((p) => createdPayloads.push(p));

    component.draftText.set('Зафиксировал главный момент мира в заметке');
    fixture.detectChanges();
    component.saveDraftNote();

    expect(createdPayloads.length).toBe(1);
    expect(createdPayloads[0].worldMoment).toBeTruthy();
    expect(createdPayloads[0].worldMoment.momentId).toBe('moment-ai-swarm');
    expect(createdPayloads[0].tags).toContain('ии-агенты');
  });

  it('should render captured world moment badge on note bubble and allow stamping world moment in inspect modal', () => {
    fixture.componentRef.setInput('notes', [
      makeNote({
        id: 'n-moment',
        time: '13:30',
        timeMinutes: 810,
        text: 'Мысль под спутником хештегов',
        worldMoment: {
          momentId: 'moment-solar-orbit',
          title: 'Спутники фиксируют идеальное окно солнечного резонанса',
          summary: 'Золотое атмосферное свечение над континентами.',
          hashtags: ['орбита-дня', 'полярное-сияние'],
          category: 'science',
          categoryLabel: 'Наука & Космос',
          icon: '🛰️',
          watcherName: 'lemon-watcher/orbital-sky',
          importanceLabel: '🛰️ Лучший момент орбиты',
          capturedAt: '2026-11-22T13:30:00.000Z',
        },
      }),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-test-id="note-world-moment-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Спутники фиксируют идеальное окно');
    expect(badge?.textContent).toContain('#орбита-дня');

    const editedPayloads: any[] = [];
    component.editNote.subscribe((p) => editedPayloads.push(p));

    component.openInspectModal(component.notes()[0]);
    fixture.detectChanges();

    expect(el.querySelector('[data-test-id="inspect-note-moment-card"]')).toBeTruthy();

    const stampBtn = el.querySelector('[data-test-id="inspect-stamp-moment-btn"]') as HTMLButtonElement;
    expect(stampBtn).toBeTruthy();
    stampBtn.click();
    fixture.detectChanges();

    expect(editedPayloads.length).toBe(1);
    expect(editedPayloads[0].worldMoment).toBeTruthy();
  });

  it('should render urban minimalist landscape by default and allow switching landscape variants in the appearance modal', () => {
    const el = fixture.nativeElement as HTMLElement;

    // Default landscape is URBAN_MINIMAL ("Городской минимализм")
    expect(component.selectedLandscapeId()).toBe('URBAN_MINIMAL');
    const horizonEl = el.querySelector('[data-test-id="cloud-horizon-landscape"]') as HTMLElement;
    expect(horizonEl).toBeTruthy();
    expect(horizonEl.getAttribute('data-landscape-id')).toBe('URBAN_MINIMAL');
    expect(el.querySelector('[data-test-id="cloud-landscape-lights"]')).toBeTruthy();

    // Every SVG path in the landscape must have an explicit soft gradient fill or fill="none" (never default black)
    const landscapePaths = Array.from(horizonEl.querySelectorAll('path'));
    expect(landscapePaths.length).toBeGreaterThanOrEqual(4);
    for (const p of landscapePaths) {
      const fillAttr = p.getAttribute('fill');
      expect(fillAttr).toBeTruthy();
      expect(fillAttr?.startsWith('url(#cloud-landscape-') || fillAttr === 'none' || fillAttr === '#ffffff').toBeTrue();
    }

    // Click appearance settings trigger button in header
    const triggerBtn = el.querySelector('[data-test-id="cloud-appearance-trigger"]') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();
    expect(triggerBtn.textContent).toContain('Вид: Город');
    triggerBtn.click();
    fixture.detectChanges();

    expect(component.isAppearanceModalOpen()).toBeTrue();
    expect(el.textContent).toContain('Внешний вид облачка и ландшафт');
    expect(el.textContent).toContain('Городской минимализм');
    expect(el.textContent).toContain('Горная гряда & Сосны');
    expect(el.textContent).toContain('Морской берег & Маяк');
    expect(el.textContent).toContain('Неоновый мегаполис');
    expect(el.textContent).toContain('Уютная долина & Холмы');
    expect(el.textContent).toContain('Городской пиксельарт');

    // Switch to PIXELART_URBAN (Городской пиксельарт)
    const pixelartOpt = el.querySelector('[data-test-id="cloud-landscape-option-PIXELART_URBAN"]') as HTMLButtonElement;
    expect(pixelartOpt).toBeTruthy();
    pixelartOpt.click();
    fixture.detectChanges();

    expect(component.selectedLandscapeId()).toBe('PIXELART_URBAN');
    expect(horizonEl.getAttribute('data-landscape-id')).toBe('PIXELART_URBAN');
    expect(triggerBtn.textContent).toContain('Вид: Пиксель-Сити');
    const pixelSvg = horizonEl.querySelector('svg');
    expect(pixelSvg?.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(el.querySelector('.pixelart-grid-backdrop')).toBeTruthy();

    // Switch to PIXELART_URBAN vibe
    const pixelartVibeBtn = el.querySelector('[data-test-id="cloud-appearance-vibe-PIXELART_URBAN"]') as HTMLButtonElement;
    expect(pixelartVibeBtn).toBeTruthy();
    pixelartVibeBtn.click();
    fixture.detectChanges();
    expect(component.selectedVibeId()).toBe('PIXELART_URBAN');

    // Switch to MOUNTAIN_PEAKS
    const mountainOpt = el.querySelector('[data-test-id="cloud-landscape-option-MOUNTAIN_PEAKS"]') as HTMLButtonElement;
    expect(mountainOpt).toBeTruthy();
    mountainOpt.click();
    fixture.detectChanges();

    expect(component.selectedLandscapeId()).toBe('MOUNTAIN_PEAKS');
    expect(horizonEl.getAttribute('data-landscape-id')).toBe('MOUNTAIN_PEAKS');
    expect(triggerBtn.textContent).toContain('Вид: Горы');

    // Toggle landscape lights off
    const lightsToggle = el.querySelector('[data-test-id="cloud-landscape-lights-toggle"]') as HTMLButtonElement;
    expect(lightsToggle).toBeTruthy();
    lightsToggle.click();
    fixture.detectChanges();
    expect(component.landscapeLightsEnabled()).toBeFalse();
    expect(el.querySelector('[data-test-id="cloud-landscape-lights"]')).toBeNull();

    // Switch to NONE (clean sky)
    const noneOpt = el.querySelector('[data-test-id="cloud-landscape-option-NONE"]') as HTMLButtonElement;
    expect(noneOpt).toBeTruthy();
    noneOpt.click();
    fixture.detectChanges();
    expect(component.selectedLandscapeId()).toBe('NONE');
    expect(el.querySelector('[data-test-id="cloud-horizon-landscape"]')).toBeNull();

    // Reset appearance back to default URBAN_MINIMAL
    const resetBtn = el.querySelector('[data-test-id="cloud-appearance-reset-btn"]') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    resetBtn.click();
    fixture.detectChanges();

    expect(component.selectedLandscapeId()).toBe('URBAN_MINIMAL');
    expect(component.landscapeLightsEnabled()).toBeTrue();
    expect(el.querySelector('[data-test-id="cloud-horizon-landscape"]')?.getAttribute('data-landscape-id')).toBe('URBAN_MINIMAL');

    component.closeAppearanceModal();
    fixture.detectChanges();
    expect(component.isAppearanceModalOpen()).toBeFalse();
  });

  it('should toggle screen sizes between standard, large, and ultra with appropriate canvas sizing and persistence', () => {
    const el = fixture.nativeElement as HTMLElement;

    // Default screen size is 'large' for expanded view
    expect(component.screenSize()).toBe('large');

    // Click ultra / wide screen button
    const ultraBtn = el.querySelector('[data-test-id="cloud-screen-size-ultra"]') as HTMLButtonElement;
    expect(ultraBtn).toBeTruthy();
    ultraBtn.click();
    fixture.detectChanges();

    expect(component.screenSize()).toBe('ultra');
    expect(localStorage.getItem('lemon.timeline.cloudScreenSize')).toBe('ultra');

    // Click standard screen button
    const standardBtn = el.querySelector('[data-test-id="cloud-screen-size-standard"]') as HTMLButtonElement;
    expect(standardBtn).toBeTruthy();
    standardBtn.click();
    fixture.detectChanges();

    expect(component.screenSize()).toBe('standard');
    expect(localStorage.getItem('lemon.timeline.cloudScreenSize')).toBe('standard');

    // Click large screen button
    const largeBtn = el.querySelector('[data-test-id="cloud-screen-size-large"]') as HTMLButtonElement;
    expect(largeBtn).toBeTruthy();
    largeBtn.click();
    fixture.detectChanges();

    expect(component.screenSize()).toBe('large');
    expect(localStorage.getItem('lemon.timeline.cloudScreenSize')).toBe('large');
  });

  it('should toggle fullscreen mode and exit via button or Escape key', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(component.isFullscreen()).toBeFalse();

    const fullscreenBtn = el.querySelector('[data-test-id="cloud-fullscreen-toggle"]') as HTMLButtonElement;
    expect(fullscreenBtn).toBeTruthy();
    expect(fullscreenBtn.textContent).toContain('Во весь экран');

    fullscreenBtn.click();
    fixture.detectChanges();

    expect(component.isFullscreen()).toBeTrue();
    expect(fullscreenBtn.textContent).toContain('Свернуть');

    // Check root container has fullscreen classes applied
    const rootEl = el.querySelector('#cloudRoot') as HTMLElement;
    expect(rootEl.classList.contains('fixed')).toBeTrue();
    expect(rootEl.classList.contains('inset-0')).toBeTrue();
    expect(rootEl.classList.contains('z-50')).toBeTrue();

    // Escape exits fullscreen
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.isFullscreen()).toBeFalse();
    expect(rootEl.classList.contains('fixed')).toBeFalse();
  });

  it('should toggle card density and compute staggered candlestick stem heights across 5-6 tiers for 10-50 messages', () => {
    const el = fixture.nativeElement as HTMLElement;

    // Default card density is 'compact' (optimized for 10–50 messages)
    expect(component.cardDensity()).toBe('compact');

    const densityBtn = el.querySelector('[data-test-id="cloud-card-density-toggle"]') as HTMLButtonElement;
    expect(densityBtn).toBeTruthy();
    expect(densityBtn.textContent).toContain('Компактные');

    densityBtn.click();
    fixture.detectChanges();

    expect(component.cardDensity()).toBe('normal');
    expect(densityBtn.textContent).toContain('Стандартные');
    expect(localStorage.getItem('lemon.timeline.cloudCardDensity')).toBe('normal');

    densityBtn.click();
    fixture.detectChanges();
    expect(component.cardDensity()).toBe('compact');

    // Test stem height tiers in 'large' screen mode (5 vertical tiers)
    component.setScreenSize('large');
    const h0 = component.getCardStemHeight(0);
    const h1 = component.getCardStemHeight(1);
    const h2 = component.getCardStemHeight(2);
    const h3 = component.getCardStemHeight(3);
    const h4 = component.getCardStemHeight(4);
    const h5 = component.getCardStemHeight(5); // cycles back to tier 0

    expect(h0).toBe(50);
    expect(h1).toBe(108);
    expect(h2).toBe(166);
    expect(h3).toBe(224);
    expect(h4).toBe(282);
    expect(h5).toBe(50);

    // Adjacent messages have a height difference of 58px which prevents vertical collision with compact cards (~65px height)
    expect(h1 - h0).toBe(58);
    expect(h2 - h1).toBe(58);

    // Test ultra screen mode (6 vertical tiers)
    component.setScreenSize('ultra');
    expect(component.getCardStemHeight(0)).toBe(55);
    expect(component.getCardStemHeight(1)).toBe(120);
    expect(component.getCardStemHeight(5)).toBe(380);
    expect(component.getCardStemHeight(6)).toBe(55); // cycles back to tier 0
  });

  it('should focus cluster note from focusedNoteId input, emit inspect/close events, and emit copyNoteLink', () => {
    const inspected: CloudDayNote[] = [];
    const copied: CloudDayNote[] = [];
    let closedCount = 0;

    component.noteInspected.subscribe((n) => inspected.push(n));
    component.copyNoteLink.subscribe((n) => copied.push(n));
    component.noteInspectClosed.subscribe(() => {
      closedCount += 1;
    });

    // Deep-link focuses n2 (the second note in the 10:00-10:15 cluster)
    fixture.componentRef.setInput('focusedNoteId', 'n2');
    fixture.detectChanges();

    expect(component.inspectedNote()?.id).toBe('n2');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('2/2');

    const copyBtn = el.querySelector('[data-test-id="inspect-copy-link-btn"]') as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();
    copyBtn.click();
    expect(copied.map((n) => n.id)).toEqual(['n2']);

    component.closeInspectModal();
    fixture.detectChanges();
    expect(component.inspectedNote()).toBeNull();
    expect(closedCount).toBe(1);

    // Direct user click on a bubble emits noteInspected
    const n3 = component.notes()[2];
    component.openInspectModal(n3);
    expect(inspected.map((n) => n.id)).toEqual(['n3']);
  });
});
