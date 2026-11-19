import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let doc: Document;

  beforeEach(() => {
    localStorage.removeItem('lemon_theme_state');
    localStorage.removeItem('lemon_theme_mode');
    localStorage.removeItem('lemon-actions:theme');

    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    doc.documentElement.removeAttribute('data-theme');
    doc.documentElement.removeAttribute('data-theme-mode');
    doc.documentElement.classList.remove('dark', 'light');
  });

  it('should toggle between light and dark mode', async () => {
    service.setState({ palette: 'atom', mode: 'light' });
    expect(doc.documentElement.getAttribute('data-theme')).toBe('atom');
    expect(doc.documentElement.classList.contains('light')).toBeTrue();
    expect(doc.documentElement.classList.contains('dark')).toBeFalse();

    service.toggle();
    expect(await firstValueFrom(service.theme$)).toBe('dark');
    expect(doc.documentElement.classList.contains('dark')).toBeTrue();
    expect(doc.documentElement.getAttribute('data-theme-mode')).toBe('dark');
  });

  it('should toggle between atom and slate palettes', async () => {
    service.setState({ palette: 'atom', mode: 'dark' });
    expect(await firstValueFrom(service.palette$)).toBe('atom');
    expect(doc.documentElement.getAttribute('data-theme')).toBe('atom');

    service.togglePalette();
    expect(await firstValueFrom(service.palette$)).toBe('slate');
    expect(doc.documentElement.getAttribute('data-theme')).toBe('slate');
    expect(doc.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('should support setting slate light and atom light themes', () => {
    service.setState({ palette: 'slate', mode: 'light' });
    expect(doc.documentElement.getAttribute('data-theme')).toBe('slate');
    expect(doc.documentElement.getAttribute('data-theme-mode')).toBe('light');
    expect(doc.documentElement.classList.contains('light')).toBeTrue();

    service.setPalette('atom');
    expect(doc.documentElement.getAttribute('data-theme')).toBe('atom');
    expect(doc.documentElement.getAttribute('data-theme-mode')).toBe('light');
  });
});
