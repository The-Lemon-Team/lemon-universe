import { ComponentFixture, TestBed } from '@angular/core/testing';
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
});
