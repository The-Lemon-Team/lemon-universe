import { CelestialOrbState } from '../../../components/neuron-arena/cloud-timeline.utils';
import {
  NoteWeatherSnapshot,
  WeatherConditionCode,
  WeatherLocation,
  WeatherReading,
} from '../weather.models';

export interface WeatherConditionMeta {
  code: WeatherConditionCode;
  label: string;
  dayEmoji: string;
  nightEmoji: string;
  pillClasses: string;
  description: string;
}

export const WEATHER_CONDITIONS_CATALOG: WeatherConditionMeta[] = [
  {
    code: 'clear',
    label: 'Ясно',
    dayEmoji: '☀️',
    nightEmoji: '🌙',
    pillClasses: 'bg-amber-400/20 text-amber-900 dark:text-amber-200 border-amber-400/40',
    description: 'Чистое небо без облаков, максимальное сияние солнца или звёзд.',
  },
  {
    code: 'partly_cloudy',
    label: 'Малооблачно',
    dayEmoji: '⛅',
    nightEmoji: '☁️',
    pillClasses: 'bg-sky-400/20 text-sky-900 dark:text-sky-200 border-sky-400/40',
    description: 'Лёгкие пушистые облачка рядом со светилом.',
  },
  {
    code: 'cloudy',
    label: 'Облачно',
    dayEmoji: '🌥️',
    nightEmoji: '☁️',
    pillClasses: 'bg-slate-400/20 text-slate-800 dark:text-slate-200 border-slate-400/40',
    description: 'Плотная облачность, мягкий рассеянный свет.',
  },
  {
    code: 'overcast',
    label: 'Пасмурно',
    dayEmoji: '☁️',
    nightEmoji: '☁️',
    pillClasses: 'bg-slate-500/25 text-slate-900 dark:text-slate-200 border-slate-500/40',
    description: 'Двухслойные кучевые облака укрывают небо.',
  },
  {
    code: 'fog',
    label: 'Туман',
    dayEmoji: '🌫️',
    nightEmoji: '🌫️',
    pillClasses: 'bg-teal-400/20 text-teal-900 dark:text-teal-200 border-teal-400/40',
    description: 'Стелющаяся дымка и мягкие волны тумана над шкалой времени.',
  },
  {
    code: 'drizzle',
    label: 'Морось',
    dayEmoji: '🌦️',
    nightEmoji: '🌧️',
    pillClasses: 'bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border-cyan-500/40',
    description: 'Мелкий моросящий дождик сквозь просветы облаков.',
  },
  {
    code: 'rain',
    label: 'Дождь',
    dayEmoji: '🌧️',
    nightEmoji: '🌧️',
    pillClasses: 'bg-blue-500/20 text-blue-900 dark:text-blue-200 border-blue-500/40',
    description: 'Дождевые капли у спутника и косые струи дождя в окне облака.',
  },
  {
    code: 'heavy_rain',
    label: 'Ливень',
    dayEmoji: '⛈️',
    nightEmoji: '🌧️',
    pillClasses: 'bg-indigo-500/25 text-indigo-950 dark:text-indigo-200 border-indigo-500/45',
    description: 'Густые дождевые тучи и интенсивные потоки ливня.',
  },
  {
    code: 'snow',
    label: 'Снег',
    dayEmoji: '❄️',
    nightEmoji: '❄️',
    pillClasses: 'bg-sky-300/25 text-sky-950 dark:text-sky-100 border-sky-300/50',
    description: 'Парящие снежинки вокруг спутника и мягкий снегопад в окне.',
  },
  {
    code: 'thunderstorm',
    label: 'Гроза',
    dayEmoji: '🌩️',
    nightEmoji: '⛈️',
    pillClasses: 'bg-violet-500/25 text-violet-950 dark:text-violet-200 border-violet-500/45',
    description: 'Грозовой фронт с разрядами молний у спутника и всполохами в небе.',
  },
];

export function getWeatherConditionMeta(condition: WeatherConditionCode): WeatherConditionMeta {
  return (
    WEATHER_CONDITIONS_CATALOG.find((c) => c.code === condition) ?? WEATHER_CONDITIONS_CATALOG[0]
  );
}

export function formatTemperatureC(tempC: number): string {
  const rounded = Math.round(tempC);
  if (rounded > 0) return `+${rounded}°C`;
  return `${rounded}°C`;
}

export function createNoteWeatherSnapshot(
  reading: WeatherReading,
  location: WeatherLocation,
  timeMinutes?: number,
): NoteWeatherSnapshot {
  const isNight =
    timeMinutes !== undefined ? timeMinutes < 420 || timeMinutes >= 1230 : !reading.isDay;
  const meta = getWeatherConditionMeta(reading.condition);
  return {
    condition: reading.condition,
    wmoCode: reading.wmoCode,
    temperatureC: Math.round(reading.temperatureC),
    feelsLikeC: Math.round(reading.feelsLikeC),
    humidityPercent: reading.humidityPercent,
    windSpeedKmh: reading.windSpeedKmh,
    locationName: location.name,
    region: location.region,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    label: meta.label,
    icon: isNight ? meta.nightEmoji : meta.dayEmoji,
    capturedAt: new Date().toISOString(),
  };
}

export interface OrbRainDropSpec {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delaySec: number;
}

export interface OrbSnowFlakeSpec {
  id: number;
  cx: number;
  cy: number;
  r: number;
  delaySec: number;
}

export interface OrbFogBandSpec {
  id: number;
  x: number;
  y: number;
  width: number;
  delaySec: number;
}

export interface CelestialWeatherOrbState extends CelestialOrbState {
  hasWeather: boolean;
  condition: WeatherConditionCode;
  weatherLabel: string;
  weatherEmoji: string;
  temperatureC: number;
  temperatureLabel: string;
  locationName: string;
  /** True only when clear sky (shows Sun/Moon disc); false when a weather cloud replaces the disc */
  showCelestialDisc: boolean;
  effectiveSunRaysOpacity: number;
  effectiveStarsOpacity: number;
  orbCloudOpacity: number;
  orbBackCloudOpacity: number;
  orbCloudTopColor: string;
  orbCloudFill: string;
  orbCloudShade: string;
  orbCloudStroke: string;
  orbBackCloudFill: string;
  rainDrops: OrbRainDropSpec[];
  snowFlakes: OrbSnowFlakeSpec[];
  fogBands: OrbFogBandSpec[];
  showLightning: boolean;
}

const ORB_RAIN_DROPS_LIGHT: OrbRainDropSpec[] = [
  { id: 1, x1: 23, y1: 46, x2: 19, y2: 56, delaySec: 0 },
  { id: 2, x1: 33, y1: 47, x2: 29, y2: 57, delaySec: 0.35 },
  { id: 3, x1: 43, y1: 46, x2: 39, y2: 56, delaySec: 0.7 },
];

const ORB_RAIN_DROPS_HEAVY: OrbRainDropSpec[] = [
  { id: 1, x1: 18, y1: 46, x2: 14, y2: 58, delaySec: 0 },
  { id: 2, x1: 26, y1: 47, x2: 22, y2: 59, delaySec: 0.22 },
  { id: 3, x1: 34, y1: 46, x2: 30, y2: 58, delaySec: 0.45 },
  { id: 4, x1: 42, y1: 47, x2: 38, y2: 59, delaySec: 0.15 },
  { id: 5, x1: 49, y1: 46, x2: 45, y2: 58, delaySec: 0.6 },
];

const ORB_SNOW_FLAKES: OrbSnowFlakeSpec[] = [
  { id: 1, cx: 21, cy: 50, r: 2.3, delaySec: 0 },
  { id: 2, cx: 30, cy: 54, r: 2.7, delaySec: 0.4 },
  { id: 3, cx: 39, cy: 50, r: 2.2, delaySec: 0.8 },
  { id: 4, cx: 47, cy: 54, r: 2.5, delaySec: 1.2 },
];

const ORB_FOG_BANDS: OrbFogBandSpec[] = [
  { id: 1, x: 10, y: 44, width: 44, delaySec: 0 },
  { id: 2, x: 14, y: 50, width: 38, delaySec: 0.7 },
  { id: 3, x: 8, y: 56, width: 46, delaySec: 1.4 },
];

/**
 * Adapts the base astronomical CelestialOrbState (Sun/Moon morphing along the day arc)
 * with live or overridden weather visuals.
 *
 * When weather is clear ('clear'), the satellite displays the Sun/Moon disc.
 * For cloudy/precipitation/fog states, it renders a single prominent, high-contrast
 * volumetric cloud without stacking multiple clouds over the sun.
 */
export function adaptCelestialOrbForWeather(
  orb: CelestialOrbState,
  weather: WeatherReading | NoteWeatherSnapshot | null,
  fallbackLocationName = 'Москва',
): CelestialWeatherOrbState {
  const condition: WeatherConditionCode = weather?.condition ?? 'clear';
  const tempC = weather?.temperatureC ?? 18;
  const isNight = orb.moonFactor >= 0.6;
  const meta = getWeatherConditionMeta(condition);
  const locationName =
    (weather && 'locationName' in weather && weather.locationName) || fallbackLocationName;

  const isClear = condition === 'clear';
  const showCelestialDisc = isClear;
  const orbCloudOpacity = isClear ? 0 : 1;
  // Never stack a second dark mini-cloud behind the main cloud
  const orbBackCloudOpacity = 0;

  const effectiveSunRaysOpacity = isClear ? orb.sunRaysOpacity : 0;
  const effectiveStarsOpacity = isClear ? orb.starsOpacity : 0;

  let orbCloudTopColor = '#ffffff';
  let orbCloudFill = '#dbeafe';
  let orbCloudShade = '#93c5fd';
  let orbCloudStroke = '#3b82f6';
  let glowColor = orb.glowColor;

  switch (condition) {
    case 'partly_cloudy':
    case 'cloudy':
      orbCloudTopColor = '#ffffff';
      orbCloudFill = '#e2e8f0';
      orbCloudShade = '#94a3b8';
      orbCloudStroke = '#475569';
      glowColor = 'rgba(100, 116, 139, 0.45)';
      break;
    case 'overcast':
    case 'fog':
      orbCloudTopColor = '#f1f5f9';
      orbCloudFill = '#cbd5e1';
      orbCloudShade = '#64748b';
      orbCloudStroke = '#334155';
      glowColor = 'rgba(71, 85, 105, 0.5)';
      break;
    case 'drizzle':
    case 'rain':
      orbCloudTopColor = '#e0f2fe';
      orbCloudFill = '#93c5fd';
      orbCloudShade = '#3b82f6';
      orbCloudStroke = '#1d4ed8';
      glowColor = 'rgba(59, 130, 246, 0.55)';
      break;
    case 'heavy_rain':
    case 'thunderstorm':
      orbCloudTopColor = '#94a3b8';
      orbCloudFill = '#475569';
      orbCloudShade = '#1e293b';
      orbCloudStroke = '#0f172a';
      glowColor = 'rgba(79, 70, 229, 0.6)';
      break;
    case 'snow':
      orbCloudTopColor = '#ffffff';
      orbCloudFill = '#bae6fd';
      orbCloudShade = '#38bdf8';
      orbCloudStroke = '#0284c7';
      glowColor = 'rgba(56, 189, 248, 0.55)';
      break;
  }

  const rainDrops =
    condition === 'heavy_rain' || condition === 'thunderstorm'
      ? ORB_RAIN_DROPS_HEAVY
      : condition === 'rain' || condition === 'drizzle'
        ? ORB_RAIN_DROPS_LIGHT
        : [];

  const snowFlakes = condition === 'snow' ? ORB_SNOW_FLAKES : [];
  const fogBands = condition === 'fog' ? ORB_FOG_BANDS : [];
  const showLightning = condition === 'thunderstorm';

  return {
    ...orb,
    glowColor,
    hasWeather: Boolean(weather),
    condition,
    weatherLabel: meta.label,
    weatherEmoji: isNight ? meta.nightEmoji : meta.dayEmoji,
    temperatureC: Math.round(tempC),
    temperatureLabel: formatTemperatureC(tempC),
    locationName,
    showCelestialDisc,
    effectiveSunRaysOpacity,
    effectiveStarsOpacity,
    orbCloudOpacity,
    orbBackCloudOpacity,
    orbCloudTopColor,
    orbCloudFill,
    orbCloudShade,
    orbCloudStroke,
    orbBackCloudFill: orbCloudShade,
    rainDrops,
    snowFlakes,
    fogBands,
    showLightning,
  };
}

export interface SkyDriftingCloudSpec {
  id: number;
  topPct: number;
  leftPct: number;
  scale: number;
  opacity: number;
  durationSec: number;
  delaySec: number;
  dark: boolean;
}

export interface SkyRainStreakSpec {
  id: number;
  leftPct: number;
  heightPx: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
}

export interface SkySnowParticleSpec {
  id: number;
  leftPct: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
}

export interface SkyFogWaveSpec {
  id: number;
  bottomPct: number;
  heightPx: number;
  opacity: number;
  durationSec: number;
  delaySec: number;
}

export interface SkyCanvasWeatherAtmosphere {
  condition: WeatherConditionCode;
  skyWashClass: string;
  driftingClouds: SkyDriftingCloudSpec[];
  rainStreaks: SkyRainStreakSpec[];
  snowParticles: SkySnowParticleSpec[];
  fogWaves: SkyFogWaveSpec[];
  hasThunderLightning: boolean;
  hasClearShimmer: boolean;
}

const DRIFTING_CLOUDS_LIGHT: SkyDriftingCloudSpec[] = [
  { id: 1, topPct: 10, leftPct: 12, scale: 0.9, opacity: 0.35, durationSec: 22, delaySec: 0, dark: false },
  { id: 2, topPct: 18, leftPct: 48, scale: 1.15, opacity: 0.3, durationSec: 28, delaySec: 3, dark: false },
  { id: 3, topPct: 12, leftPct: 78, scale: 0.85, opacity: 0.32, durationSec: 25, delaySec: 1.5, dark: false },
];

const DRIFTING_CLOUDS_DENSE: SkyDriftingCloudSpec[] = [
  { id: 1, topPct: 8, leftPct: 8, scale: 1.1, opacity: 0.5, durationSec: 20, delaySec: 0, dark: false },
  { id: 2, topPct: 15, leftPct: 32, scale: 1.3, opacity: 0.45, durationSec: 26, delaySec: 2, dark: false },
  { id: 3, topPct: 9, leftPct: 58, scale: 1.15, opacity: 0.48, durationSec: 23, delaySec: 4, dark: false },
  { id: 4, topPct: 17, leftPct: 82, scale: 1.05, opacity: 0.42, durationSec: 24, delaySec: 1, dark: false },
];

const DRIFTING_CLOUDS_STORM: SkyDriftingCloudSpec[] = [
  { id: 1, topPct: 7, leftPct: 10, scale: 1.25, opacity: 0.55, durationSec: 16, delaySec: 0, dark: true },
  { id: 2, topPct: 13, leftPct: 36, scale: 1.4, opacity: 0.5, durationSec: 19, delaySec: 1.5, dark: true },
  { id: 3, topPct: 8, leftPct: 64, scale: 1.3, opacity: 0.52, durationSec: 17, delaySec: 3, dark: true },
  { id: 4, topPct: 15, leftPct: 86, scale: 1.15, opacity: 0.48, durationSec: 21, delaySec: 0.8, dark: true },
];

function buildRainStreaks(count: number, heavy: boolean): SkyRainStreakSpec[] {
  const list: SkyRainStreakSpec[] = [];
  for (let i = 0; i < count; i++) {
    const leftPct = Math.round(((i * 97 + 7) % 94) + 3);
    const heightPx = heavy ? 22 + (i % 4) * 5 : 14 + (i % 3) * 4;
    const durationSec = heavy ? 0.65 + (i % 4) * 0.1 : 0.95 + (i % 5) * 0.14;
    const delaySec = Math.round(((i * 0.19) % 1.4) * 100) / 100;
    const opacity = heavy ? 0.45 + (i % 3) * 0.1 : 0.32 + (i % 3) * 0.08;
    list.push({ id: i + 1, leftPct, heightPx, durationSec, delaySec, opacity });
  }
  return list;
}

function buildSnowParticles(count: number): SkySnowParticleSpec[] {
  const list: SkySnowParticleSpec[] = [];
  for (let i = 0; i < count; i++) {
    const leftPct = Math.round(((i * 83 + 5) % 92) + 4);
    const sizePx = 5 + (i % 4) * 2;
    const durationSec = 4.2 + (i % 5) * 0.85;
    const delaySec = Math.round(((i * 0.45) % 4) * 100) / 100;
    const opacity = 0.55 + (i % 3) * 0.15;
    list.push({ id: i + 1, leftPct, sizePx, durationSec, delaySec, opacity });
  }
  return list;
}

const RAIN_STREAKS_DRIZZLE = buildRainStreaks(14, false);
const RAIN_STREAKS_NORMAL = buildRainStreaks(24, false);
const RAIN_STREAKS_HEAVY = buildRainStreaks(34, true);
const SNOW_PARTICLES_DEFAULT = buildSnowParticles(22);

const FOG_WAVES_DEFAULT: SkyFogWaveSpec[] = [
  { id: 1, bottomPct: 12, heightPx: 64, opacity: 0.48, durationSec: 14, delaySec: 0 },
  { id: 2, bottomPct: 26, heightPx: 76, opacity: 0.38, durationSec: 19, delaySec: 2.5 },
  { id: 3, bottomPct: 44, heightPx: 56, opacity: 0.28, durationSec: 23, delaySec: 5 },
];

/**
 * Computes the animated weather atmosphere inside the Chrono-Cloud window (#skyCanvas).
 */
export function adaptSkyCanvasWeatherAtmosphere(
  condition: WeatherConditionCode,
): SkyCanvasWeatherAtmosphere {
  switch (condition) {
    case 'clear':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-amber-300/10 via-transparent to-transparent',
        driftingClouds: [],
        rainStreaks: [],
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: true,
      };
    case 'partly_cloudy':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-sky-200/15 via-transparent to-transparent',
        driftingClouds: DRIFTING_CLOUDS_LIGHT,
        rainStreaks: [],
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'cloudy':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-slate-300/25 via-slate-200/10 to-transparent dark:from-slate-800/35',
        driftingClouds: DRIFTING_CLOUDS_DENSE,
        rainStreaks: [],
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'overcast':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-slate-400/35 via-slate-300/20 to-slate-200/10 dark:from-slate-900/55 dark:via-slate-800/30',
        driftingClouds: DRIFTING_CLOUDS_DENSE,
        rainStreaks: [],
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'fog':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-t from-slate-200/55 via-teal-100/30 to-slate-200/25 dark:from-slate-800/60 dark:via-slate-800/35',
        driftingClouds: DRIFTING_CLOUDS_LIGHT,
        rainStreaks: [],
        snowParticles: [],
        fogWaves: FOG_WAVES_DEFAULT,
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'drizzle':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-cyan-400/20 via-sky-300/10 to-transparent dark:from-cyan-950/40',
        driftingClouds: DRIFTING_CLOUDS_LIGHT,
        rainStreaks: RAIN_STREAKS_DRIZZLE,
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'rain':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-slate-500/30 via-blue-400/15 to-sky-200/10 dark:from-slate-900/55 dark:via-blue-950/35',
        driftingClouds: DRIFTING_CLOUDS_DENSE,
        rainStreaks: RAIN_STREAKS_NORMAL,
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'heavy_rain':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-slate-700/40 via-indigo-500/20 to-slate-400/15 dark:from-slate-950/70 dark:via-indigo-950/45',
        driftingClouds: DRIFTING_CLOUDS_STORM,
        rainStreaks: RAIN_STREAKS_HEAVY,
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'snow':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-sky-200/35 via-cyan-100/20 to-white/25 dark:from-sky-950/45 dark:via-slate-900/30',
        driftingClouds: DRIFTING_CLOUDS_DENSE,
        rainStreaks: [],
        snowParticles: SNOW_PARTICLES_DEFAULT,
        fogWaves: [],
        hasThunderLightning: false,
        hasClearShimmer: false,
      };
    case 'thunderstorm':
      return {
        condition,
        skyWashClass: 'bg-gradient-to-b from-indigo-900/45 via-purple-900/25 to-slate-800/20 dark:from-slate-950/75 dark:via-violet-950/50',
        driftingClouds: DRIFTING_CLOUDS_STORM,
        rainStreaks: RAIN_STREAKS_HEAVY,
        snowParticles: [],
        fogWaves: [],
        hasThunderLightning: true,
        hasClearShimmer: false,
      };
  }
}
