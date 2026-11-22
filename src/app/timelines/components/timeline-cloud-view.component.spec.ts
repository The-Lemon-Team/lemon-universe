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
});
