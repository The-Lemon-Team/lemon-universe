import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  CloudSelectOption,
  CloudThemedSelectComponent,
} from './cloud-themed-select.component';

@Component({
  standalone: true,
  imports: [CloudThemedSelectComponent],
  template: `
    <app-cloud-themed-select
      [options]="options()"
      [value]="selected()"
      [searchable]="true"
      [clearable]="true"
      [clearValue]="null"
      placeholder="Выберите героя"
      footerActionLabel="Показать всех"
      (valueChange)="selected.set($event)"
      (footerAction)="footerClicked.set(true)"
    />
  `,
})
class TestHostComponent {
  readonly options = signal<CloudSelectOption<string | null>[]>([
    { value: null, label: 'Все герои', materialIcon: 'groups', badge: 2 },
    { value: 'actor-alexey', label: 'Алексей', subtitle: 'Лидер', avatarIcon: 'alexey', badge: 3 },
    { value: 'actor-hades', label: 'Аид', subtitle: 'Шеф', emoji: '🔥', badge: 1 },
  ]);
  readonly selected = signal<string | null>(null);
  readonly footerClicked = signal<boolean>(false);
}

describe('CloudThemedSelectComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render active option label, icon and badge on trigger', () => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-haspopup="listbox"]');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Все герои');
    expect(trigger.textContent).toContain('2');
  });

  it('should open listbox, filter options by search query, and emit valueChange on option click', () => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-haspopup="listbox"]');
    trigger.click();
    fixture.detectChanges();

    const listbox = fixture.nativeElement.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();

    const searchInput: HTMLInputElement = listbox.querySelector('input[type="text"]');
    expect(searchInput).toBeTruthy();
    searchInput.value = 'Аид';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = listbox.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Аид');

    (options[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.selected()).toBe('actor-hades');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('should clear selection via clear button and close on Escape', () => {
    host.selected.set('actor-alexey');
    fixture.detectChanges();

    const clearBtn: HTMLElement = fixture.nativeElement.querySelector('[aria-label="Сбросить выбор"]');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    fixture.detectChanges();

    expect(host.selected()).toBeNull();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-haspopup="listbox"]');
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('should trigger footerAction and close dropdown', () => {
    const selectDebug = fixture.debugElement.query(By.directive(CloudThemedSelectComponent));
    const selectCmp = selectDebug.componentInstance as CloudThemedSelectComponent<string | null>;

    selectCmp.toggle();
    fixture.detectChanges();

    selectCmp.triggerFooterAction();
    fixture.detectChanges();

    expect(host.footerClicked()).toBeTrue();
    expect(selectCmp.isOpen()).toBeFalse();
  });
});
