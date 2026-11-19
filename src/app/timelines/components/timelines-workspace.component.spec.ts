import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TimelinesWorkspaceComponent } from './timelines-workspace.component';

describe('TimelinesWorkspaceComponent', () => {
  let fixture: ComponentFixture<TimelinesWorkspaceComponent>;
  let component: TimelinesWorkspaceComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelinesWorkspaceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelinesWorkspaceComponent);
    component = fixture.componentInstance;
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
});
