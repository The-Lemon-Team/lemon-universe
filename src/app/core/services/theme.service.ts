import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import {
  ThemeMode,
  ThemePaletteId,
  ThemeState,
  applyThemeToDocument,
  isValidMode,
  isValidPalette,
  loadThemeState,
  saveThemeState,
} from '@lemon/themes';
import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs';

export type Theme = ThemeMode;
export type { ThemePaletteId, ThemeState };

const LEGACY_ACTIONS_KEY = 'lemon-actions:theme';

/**
 * Manages Lemon Universe theme state powered by `@lemon/themes`:
 * - Palettes: `atom` (Lemon Atom) and `slate` (Lemon Slate)
 * - Modes: `light` and `dark`
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly stateSubject = new BehaviorSubject<ThemeState>(this.initialState());

  readonly state$: Observable<ThemeState> = this.stateSubject.asObservable();
  readonly theme$: Observable<Theme> = this.state$.pipe(
    map((s) => s.mode),
    distinctUntilChanged(),
  );
  readonly palette$: Observable<ThemePaletteId> = this.state$.pipe(
    map((s) => s.palette),
    distinctUntilChanged(),
  );

  constructor() {
    this.apply(this.stateSubject.value);
  }

  get currentState(): ThemeState {
    return this.stateSubject.value;
  }

  toggle(): void {
    const current = this.stateSubject.value;
    this.setState({
      ...current,
      mode: current.mode === 'dark' ? 'light' : 'dark',
    });
  }

  togglePalette(): void {
    const current = this.stateSubject.value;
    this.setState({
      ...current,
      palette: current.palette === 'atom' ? 'slate' : 'atom',
    });
  }

  set(theme: Theme): void {
    this.setState({
      ...this.stateSubject.value,
      mode: theme,
    });
  }

  setPalette(palette: ThemePaletteId): void {
    this.setState({
      ...this.stateSubject.value,
      palette,
    });
  }

  setState(state: ThemeState): void {
    this.stateSubject.next(state);
    this.apply(state);
    saveThemeState(state, { legacyModeStorageKey: LEGACY_ACTIONS_KEY });
  }

  private apply(state: ThemeState): void {
    applyThemeToDocument(state, this.document);
  }

  private initialState(): ThemeState {
    const base = loadThemeState({
      legacyModeStorageKey: LEGACY_ACTIONS_KEY,
      defaultPalette: 'atom',
      respectSystemMode: true,
    });

    const params = new URLSearchParams(this.document.defaultView?.location?.search ?? '');
    const fromTheme = params.get('theme');
    const fromPalette = params.get('palette');

    let palette: ThemePaletteId = base.palette;
    let mode: ThemeMode = base.mode;

    if (isValidPalette(fromPalette)) {
      palette = fromPalette;
    }

    if (fromTheme) {
      if (isValidMode(fromTheme)) {
        mode = fromTheme;
      } else {
        const [p, m] = fromTheme.split('-');
        if (isValidPalette(p)) palette = p;
        if (isValidMode(m)) mode = m;
      }
    }

    return { palette, mode };
  }
}
