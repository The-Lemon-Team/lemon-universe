import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HashtagMultiselectComponent } from './hashtag-multiselect.component';

describe('HashtagMultiselectComponent', () => {
  let fixture: ComponentFixture<HashtagMultiselectComponent>;
  let component: HashtagMultiselectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashtagMultiselectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HashtagMultiselectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', [
      { tag: 'идея', count: 5 },
      { tag: 'релиз', count: 3 },
      { tag: 'дневник', count: 1 },
    ]);
    fixture.componentRef.setInput('selectedTags', ['идея']);
    fixture.detectChanges();
  });

  it('should filter options by search query and toggle multiselect without closing', () => {
    const emitted: string[][] = [];
    component.selectedTagsChange.subscribe((tags) => emitted.push(tags));

    component.toggle();
    fixture.detectChanges();
    expect(component.isOpen()).toBeTrue();

    component.searchQuery.set('рел');
    fixture.detectChanges();
    expect(component.filteredOptions().map((o) => o.tag)).toEqual(['релиз']);

    component.toggleTag('релиз');
    expect(emitted[0]).toEqual(['идея', 'релиз']);
    expect(component.isOpen()).toBeTrue();
  });

  it('should create and select a new hashtag from search query when allowCreate is true', () => {
    const emitted: string[][] = [];
    component.selectedTagsChange.subscribe((tags) => emitted.push(tags));

    component.toggle();
    component.searchQuery.set('#новинка');
    fixture.detectChanges();

    expect(component.canCreateQueryTag()).toBeTrue();
    component.createAndSelectQueryTag();

    expect(emitted[0]).toEqual(['идея', 'новинка']);
    expect(component.searchQuery()).toBe('');
  });

  it('should remove a selected tag chip without opening dropdown', () => {
    const emitted: string[][] = [];
    component.selectedTagsChange.subscribe((tags) => emitted.push(tags));

    const el = fixture.nativeElement as HTMLElement;
    const removeBtn = el.querySelector('button[aria-label="Убрать хештег #идея"]') as HTMLButtonElement;
    expect(removeBtn).toBeTruthy();
    removeBtn.click();

    expect(emitted[0]).toEqual([]);
    expect(component.isOpen()).toBeFalse();
  });
});
