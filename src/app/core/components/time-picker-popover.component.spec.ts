import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimePickerPopoverComponent } from './time-picker-popover.component';

describe('TimePickerPopoverComponent', () => {
  let component: TimePickerPopoverComponent;
  let fixture: ComponentFixture<TimePickerPopoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimePickerPopoverComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimePickerPopoverComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('time', '21:41');
    fixture.detectChanges();
  });

  it('should create and format initial time correctly', () => {
    expect(component).toBeTruthy();
    expect(component.currentHours()).toBe(21);
    expect(component.currentMinutes()).toBe(41);
    expect(component.displayTime()).toBe('21:41');
  });

  it('should toggle open state on trigger click', () => {
    expect(component.isOpen()).toBeFalse();

    component.toggle();
    expect(component.isOpen()).toBeTrue();

    component.toggle();
    expect(component.isOpen()).toBeFalse();
  });

  it('should not open when disabled is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    component.toggle();
    expect(component.isOpen()).toBeFalse();
  });

  it('should emit updated time when an hour is selected', () => {
    spyOn(component.timeChange, 'emit');

    component.setHour(9);
    expect(component.timeChange.emit).toHaveBeenCalledWith('09:41');
  });

  it('should emit updated time when a minute is selected', () => {
    spyOn(component.timeChange, 'emit');

    component.setMinute(15);
    expect(component.timeChange.emit).toHaveBeenCalledWith('21:15');
  });

  it('should shift minutes correctly with shiftMinutes(+15)', () => {
    spyOn(component.timeChange, 'emit');

    component.shiftMinutes(15);
    expect(component.timeChange.emit).toHaveBeenCalledWith('21:56');
  });

  it('should shift minutes correctly across midnight with shiftMinutes', () => {
    fixture.componentRef.setInput('time', '23:55');
    fixture.detectChanges();

    spyOn(component.timeChange, 'emit');

    component.shiftMinutes(15);
    expect(component.timeChange.emit).toHaveBeenCalledWith('00:10');
  });

  it('should shift backwards across midnight with shiftMinutes(-30)', () => {
    fixture.componentRef.setInput('time', '00:15');
    fixture.detectChanges();

    spyOn(component.timeChange, 'emit');

    component.shiftMinutes(-30);
    expect(component.timeChange.emit).toHaveBeenCalledWith('23:45');
  });

  it('should set current system time with setNow()', () => {
    spyOn(component.timeChange, 'emit');

    const before = new Date();
    component.setNow();

    const expectedHours = String(before.getHours()).padStart(2, '0');
    const expectedMinutes = String(before.getMinutes()).padStart(2, '0');
    expect(component.timeChange.emit).toHaveBeenCalledWith(`${expectedHours}:${expectedMinutes}`);
  });

  it('should close on Escape keydown', () => {
    component.isOpen.set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    spyOn(event, 'stopPropagation');

    component.onEscapeKey(event);

    expect(component.isOpen()).toBeFalse();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('should close when close() is invoked', () => {
    component.isOpen.set(true);
    component.close();
    expect(component.isOpen()).toBeFalse();
  });
});
