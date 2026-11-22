import { Injectable, computed, signal } from '@angular/core';
import {
  OpenMeteoGeocodingAdapter,
  OpenMeteoWeatherAdapter,
  mapConditionToRepresentativeWmoCode,
} from './adapters/open-meteo.adapter';
import {
  DEFAULT_WEATHER_LOCATION,
  PRESET_WEATHER_LOCATIONS,
  PresetFallbackGeocodingAdapter,
  PresetFallbackWeatherAdapter,
} from './adapters/preset-fallback.adapter';
import {
  WEATHER_CONDITIONS_CATALOG,
  createNoteWeatherSnapshot,
  formatTemperatureC,
  getWeatherConditionMeta,
} from './adapters/timeline-celestial-weather.adapter';
import {
  GeocodingAdapterPort,
  NoteWeatherSnapshot,
  WeatherConditionCode,
  WeatherLocation,
  WeatherProviderAdapterPort,
  WeatherReading,
} from './weather.models';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private static readonly LOCATION_STORAGE_KEY = 'lemon.weather.location';
  private static readonly OVERRIDE_STORAGE_KEY = 'lemon.weather.overrideCondition';
  private static readonly SKY_ANIM_STORAGE_KEY = 'lemon.weather.skyAnimations';

  private geocodingAdapter: GeocodingAdapterPort = new OpenMeteoGeocodingAdapter();
  private fallbackGeocodingAdapter: GeocodingAdapterPort = new PresetFallbackGeocodingAdapter();
  private weatherProviderAdapter: WeatherProviderAdapterPort = new OpenMeteoWeatherAdapter();
  private fallbackWeatherAdapter: WeatherProviderAdapterPort = new PresetFallbackWeatherAdapter();

  readonly presetLocations: WeatherLocation[] = PRESET_WEATHER_LOCATIONS;
  readonly conditionsCatalog = WEATHER_CONDITIONS_CATALOG;

  readonly selectedLocation = signal<WeatherLocation>(this.loadSavedLocation());
  readonly liveReading = signal<WeatherReading>(
    this.buildInitialReading(this.selectedLocation()),
  );
  readonly conditionOverride = signal<WeatherConditionCode | null>(this.loadSavedOverride());
  readonly skyAnimationsEnabled = signal<boolean>(this.loadSavedSkyAnimations());
  readonly isLoading = signal<boolean>(false);

  /**
   * Effective weather reading combining live settlement data with optional manual weather preview override.
   */
  readonly currentReading = computed<WeatherReading>(() => {
    const base = this.liveReading();
    const override = this.conditionOverride();
    if (!override) return base;
    return {
      ...base,
      condition: override,
      wmoCode: mapConditionToRepresentativeWmoCode(override),
      provider: 'manual-override',
    };
  });

  readonly currentConditionMeta = computed(() =>
    getWeatherConditionMeta(this.currentReading().condition),
  );

  readonly currentTemperatureLabel = computed(() =>
    formatTemperatureC(this.currentReading().temperatureC),
  );

  /**
   * Allows replacing adapters in unit tests or when migrating to a backend microservice adapter.
   */
  configureAdapters(opts: {
    geocoding?: GeocodingAdapterPort;
    weatherProvider?: WeatherProviderAdapterPort;
  }): void {
    if (opts.geocoding) this.geocodingAdapter = opts.geocoding;
    if (opts.weatherProvider) this.weatherProviderAdapter = opts.weatherProvider;
  }

  async searchLocations(query: string, limit = 8): Promise<WeatherLocation[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.presetLocations.slice(0, limit);
    }

    const presetMatches = await this.fallbackGeocodingAdapter.searchLocations(trimmed, limit);
    try {
      const remoteMatches = await this.geocodingAdapter.searchLocations(trimmed, limit);
      const merged: WeatherLocation[] = [];
      const seen = new Set<string>();
      for (const item of [...presetMatches.filter((p) => !p.id.startsWith('custom-')), ...remoteMatches]) {
        const key = `${item.name.toLowerCase()}|${(item.country || '').toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
      return merged.length > 0 ? merged.slice(0, limit) : presetMatches.slice(0, limit);
    } catch {
      return presetMatches.slice(0, limit);
    }
  }

  async selectLocation(location: WeatherLocation, fetchRemote = true): Promise<WeatherReading> {
    this.selectedLocation.set(location);
    this.saveLocation(location);

    const immediate = await this.fallbackWeatherAdapter.fetchCurrentWeather(location);
    this.liveReading.set(immediate);

    if (!fetchRemote) {
      return this.currentReading();
    }

    return this.refreshWeather(location);
  }

  async refreshWeather(location = this.selectedLocation()): Promise<WeatherReading> {
    this.isLoading.set(true);
    try {
      const reading = await this.weatherProviderAdapter.fetchCurrentWeather(location);
      this.liveReading.set(reading);
      return this.currentReading();
    } catch {
      const fallback = await this.fallbackWeatherAdapter.fetchCurrentWeather(location);
      this.liveReading.set(fallback);
      return this.currentReading();
    } finally {
      this.isLoading.set(false);
    }
  }

  setConditionOverride(condition: WeatherConditionCode | null): void {
    this.conditionOverride.set(condition);
    try {
      if (condition) {
        localStorage.setItem(WeatherService.OVERRIDE_STORAGE_KEY, condition);
      } else {
        localStorage.removeItem(WeatherService.OVERRIDE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures
    }
  }

  setSkyAnimationsEnabled(enabled: boolean): void {
    this.skyAnimationsEnabled.set(enabled);
    try {
      localStorage.setItem(WeatherService.SKY_ANIM_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // Ignore storage failures
    }
  }

  /**
   * Captures a one-time immutable weather snapshot for attaching to a CloudDayNote.
   */
  captureSnapshot(timeMinutes?: number): NoteWeatherSnapshot {
    return createNoteWeatherSnapshot(
      this.currentReading(),
      this.selectedLocation(),
      timeMinutes,
    );
  }

  private buildInitialReading(location: WeatherLocation): WeatherReading {
    const preset = PRESET_WEATHER_LOCATIONS.find(
      (p) => p.id === location.id || p.name.toLowerCase() === location.name.toLowerCase(),
    );
    const condition = preset?.defaultCondition ?? 'partly_cloudy';
    const tempC = preset?.baseTempC ?? 16;
    const hour = new Date().getHours();
    const isDay = hour >= 7 && hour < 21;
    return {
      condition,
      wmoCode: mapConditionToRepresentativeWmoCode(condition),
      temperatureC: tempC,
      feelsLikeC: tempC - 1,
      humidityPercent: condition === 'rain' || condition === 'fog' ? 84 : 58,
      windSpeedKmh: condition === 'thunderstorm' ? 22 : 12,
      cloudCoverPercent: condition === 'clear' ? 10 : 55,
      isDay,
      observedAt: new Date().toISOString(),
      provider: 'preset-fallback',
    };
  }

  private loadSavedLocation(): WeatherLocation {
    try {
      const raw = localStorage.getItem(WeatherService.LOCATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WeatherLocation;
        if (
          parsed &&
          typeof parsed.name === 'string' &&
          Number.isFinite(parsed.latitude) &&
          Number.isFinite(parsed.longitude)
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_WEATHER_LOCATION;
  }

  private saveLocation(location: WeatherLocation): void {
    try {
      localStorage.setItem(WeatherService.LOCATION_STORAGE_KEY, JSON.stringify(location));
    } catch {
      // Ignore storage errors
    }
  }

  private loadSavedOverride(): WeatherConditionCode | null {
    try {
      const saved = localStorage.getItem(WeatherService.OVERRIDE_STORAGE_KEY) as WeatherConditionCode | null;
      if (saved && WEATHER_CONDITIONS_CATALOG.some((c) => c.code === saved)) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  }

  private loadSavedSkyAnimations(): boolean {
    try {
      const saved = localStorage.getItem(WeatherService.SKY_ANIM_STORAGE_KEY);
      if (saved === 'false') return false;
    } catch {
      // Ignore storage errors
    }
    return true;
  }
}
