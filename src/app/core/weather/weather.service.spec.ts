import { TestBed } from '@angular/core/testing';
import { getCelestialOrbState } from '../../components/neuron-arena/cloud-timeline.utils';
import {
  PRESET_WEATHER_LOCATIONS,
  WeatherService,
  adaptCelestialOrbForWeather,
  adaptSkyCanvasWeatherAtmosphere,
  createNoteWeatherSnapshot,
  formatTemperatureC,
  mapWmoCodeToCondition,
} from './index';

describe('Weather Module & Adapters', () => {
  let service: WeatherService;

  beforeEach(() => {
    localStorage.removeItem('lemon.weather.location');
    localStorage.removeItem('lemon.weather.overrideCondition');
    localStorage.removeItem('lemon.weather.skyAnimations');

    TestBed.configureTestingModule({});
    service = TestBed.inject(WeatherService);
  });

  it('should map WMO weather codes to canonical WeatherConditionCode values', () => {
    expect(mapWmoCodeToCondition(0)).toBe('clear');
    expect(mapWmoCodeToCondition(1)).toBe('partly_cloudy');
    expect(mapWmoCodeToCondition(2, 80)).toBe('cloudy');
    expect(mapWmoCodeToCondition(3, 95)).toBe('overcast');
    expect(mapWmoCodeToCondition(45)).toBe('fog');
    expect(mapWmoCodeToCondition(53)).toBe('drizzle');
    expect(mapWmoCodeToCondition(61)).toBe('rain');
    expect(mapWmoCodeToCondition(65)).toBe('heavy_rain');
    expect(mapWmoCodeToCondition(73)).toBe('snow');
    expect(mapWmoCodeToCondition(95)).toBe('thunderstorm');
  });

  it('should adapt CelestialOrbState for rain, snow, fog, cloudy, and thunderstorm', () => {
    const noonOrb = getCelestialOrbState(14 * 60);

    const rainOrb = adaptCelestialOrbForWeather(
      noonOrb,
      {
        condition: 'rain',
        wmoCode: 61,
        temperatureC: 12,
        feelsLikeC: 10,
        isDay: true,
        observedAt: '2026-11-22T14:00:00Z',
        provider: 'preset-fallback',
      },
      'Санкт-Петербург',
    );
    expect(rainOrb.condition).toBe('rain');
    expect(rainOrb.locationName).toBe('Санкт-Петербург');
    expect(rainOrb.temperatureLabel).toBe('+12°C');
    expect(rainOrb.orbCloudOpacity).toBeGreaterThan(0.9);
    expect(rainOrb.rainDrops.length).toBeGreaterThan(0);
    expect(rainOrb.effectiveSunRaysOpacity).toBeLessThan(noonOrb.sunRaysOpacity);

    const snowOrb = adaptCelestialOrbForWeather(
      noonOrb,
      {
        condition: 'snow',
        wmoCode: 73,
        temperatureC: -5,
        feelsLikeC: -8,
        isDay: true,
        observedAt: '2026-11-22T14:00:00Z',
        provider: 'preset-fallback',
      },
      'Новосибирск',
    );
    expect(snowOrb.temperatureLabel).toBe('-5°C');
    expect(snowOrb.snowFlakes.length).toBe(4);
    expect(snowOrb.rainDrops.length).toBe(0);

    const fogOrb = adaptCelestialOrbForWeather(
      noonOrb,
      {
        condition: 'fog',
        wmoCode: 45,
        temperatureC: 9,
        feelsLikeC: 8,
        isDay: true,
        observedAt: '2026-11-22T14:00:00Z',
        provider: 'preset-fallback',
      },
      'Калининград',
    );
    expect(fogOrb.fogBands.length).toBe(3);

    const stormOrb = adaptCelestialOrbForWeather(
      noonOrb,
      {
        condition: 'thunderstorm',
        wmoCode: 95,
        temperatureC: 19,
        feelsLikeC: 18,
        isDay: true,
        observedAt: '2026-11-22T14:00:00Z',
        provider: 'preset-fallback',
      },
      'Токио',
    );
    expect(stormOrb.showLightning).toBeTrue();
    expect(stormOrb.rainDrops.length).toBe(5);
  });

  it('should compute SkyCanvasWeatherAtmosphere particle specs for window animations', () => {
    const rainAtmo = adaptSkyCanvasWeatherAtmosphere('rain');
    expect(rainAtmo.rainStreaks.length).toBeGreaterThan(15);
    expect(rainAtmo.driftingClouds.length).toBeGreaterThan(0);

    const snowAtmo = adaptSkyCanvasWeatherAtmosphere('snow');
    expect(snowAtmo.snowParticles.length).toBeGreaterThan(15);

    const fogAtmo = adaptSkyCanvasWeatherAtmosphere('fog');
    expect(fogAtmo.fogWaves.length).toBe(3);

    const stormAtmo = adaptSkyCanvasWeatherAtmosphere('thunderstorm');
    expect(stormAtmo.hasThunderLightning).toBeTrue();
    expect(stormAtmo.rainStreaks.length).toBeGreaterThan(25);
  });

  it('should select a settlement, support condition overrides, and capture an immutable NoteWeatherSnapshot', async () => {
    const spb = PRESET_WEATHER_LOCATIONS.find((l) => l.id === 'preset-spb')!;
    await service.selectLocation(spb, false);

    expect(service.selectedLocation().name).toBe('Санкт-Петербург');
    expect(service.currentReading().condition).toBe('rain');

    service.setConditionOverride('snow');
    expect(service.currentReading().condition).toBe('snow');
    expect(service.currentReading().provider).toBe('manual-override');

    const snapshot = service.captureSnapshot(14 * 60);
    expect(snapshot.locationName).toBe('Санкт-Петербург');
    expect(snapshot.condition).toBe('snow');
    expect(snapshot.label).toBe('Снег');
    expect(snapshot.icon).toBe('❄️');
    expect(snapshot.latitude).toBeCloseTo(59.9343, 2);
    expect(formatTemperatureC(snapshot.temperatureC)).toContain('°C');
  });

  it('should create day vs night emoji in createNoteWeatherSnapshot', () => {
    const loc = PRESET_WEATHER_LOCATIONS[0];
    const reading = service.currentReading();
    service.setConditionOverride('clear');

    const daySnap = createNoteWeatherSnapshot(service.currentReading(), loc, 13 * 60);
    const nightSnap = createNoteWeatherSnapshot(service.currentReading(), loc, 23 * 60);

    expect(daySnap.icon).toBe('☀️');
    expect(nightSnap.icon).toBe('🌙');
    expect(reading).toBeTruthy();
  });
});
