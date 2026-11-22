import { ArenaAccentColor, CloudDayNote, CloudItemType } from '../../core/models/flow.models';

export type CloudDayVibeId = 'CHRONO_DAYFLOW' | 'COZY_CHILL' | 'SYNTHWAVE' | 'NATURE_ZEN';

export interface CloudDayVibe {
  id: CloudDayVibeId;
  name: string;
  icon: string;
  badge: string;
  description: string;
  skyGradient: string;
  stageBorderClass: string;
  atmosphereEmoji: string[];
}

export interface TimelineCluster {
  id: string;
  timeMinutes: number;
  time: string;
  timeSpanLabel?: string;
  notes: CloudDayNote[];
  isCluster: boolean;
}

export const CLOUD_CLUSTER_GAP_MINUTES = 30;

export const CLOUD_HOUR_MILESTONES = [
  { label: '08:00', icon: '🌅', minutes: 480 },
  { label: '10:00', icon: '☕', minutes: 600 },
  { label: '12:00', icon: '☀️', minutes: 720 },
  { label: '14:00', icon: '🍕', minutes: 840 },
  { label: '16:00', icon: '💡', minutes: 960 },
  { label: '18:00', icon: '🌆', minutes: 1080 },
  { label: '20:00', icon: '🎮', minutes: 1200 },
  { label: '22:00', icon: '🌙', minutes: 1320 },
  { label: '24:00', icon: '💤', minutes: 1440 },
];

export const CLOUD_DAY_VIBES: CloudDayVibe[] = [
  {
    id: 'CHRONO_DAYFLOW',
    name: 'Хроно-День (Рассвет → Ночь)',
    icon: '🌅',
    badge: 'Живой Градиент',
    description:
      'Плавный суточный переход от утренней зари через полуденное солнце к закату и ночному небу с пунктирными меридианами.',
    skyGradient:
      'bg-gradient-to-r from-amber-100/60 via-sky-100/40 via-purple-100/45 to-indigo-900/25 dark:from-amber-950/30 dark:via-sky-950/20 dark:via-purple-950/35 dark:to-slate-950/80',
    stageBorderClass: 'border-amber-300/60 dark:border-amber-400/30',
    atmosphereEmoji: ['🌅', '☀️', '🌆', '🌙'],
  },
  {
    id: 'COZY_CHILL',
    name: 'Пятничный Чилл & Уют',
    icon: '🛋️',
    badge: 'Тёплый вечер',
    description: 'Пастельные кофейные и персиковые тона, атмосфера пледа, горячего чая и дружеских посиделок.',
    skyGradient:
      'bg-gradient-to-r from-orange-100/70 via-rose-100/50 via-amber-100/60 to-purple-200/40 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-purple-950/40',
    stageBorderClass: 'border-rose-300/60 dark:border-rose-400/30',
    atmosphereEmoji: ['☕', '🕯️', '🍕', '🛋️'],
  },
  {
    id: 'SYNTHWAVE',
    name: 'Неоновый Космос & Синтвейв',
    icon: '🌌',
    badge: 'Cyber Party',
    description: 'Глубокий неоновый космос, фиолетовые закатные градиенты и синтвейв-вайб под треки DJ Pixel.',
    skyGradient:
      'bg-gradient-to-r from-indigo-200/50 via-purple-200/60 via-pink-200/40 to-slate-900/60 dark:from-[#0f1123] dark:via-[#1c1236] dark:via-[#2b1040] dark:to-[#0a0c1a]',
    stageBorderClass: 'border-purple-400/60 dark:border-purple-500/40',
    atmosphereEmoji: ['🕹️', '✨', '🎧', '🪐'],
  },
  {
    id: 'NATURE_ZEN',
    name: 'Горный Дзен & Свежесть',
    icon: '🌲',
    badge: 'Эко-Баланс',
    description: 'Свежие бирюзовые и изумрудные тона утреннего леса, чистый воздух и кристальная ясность мыслей.',
    skyGradient:
      'bg-gradient-to-r from-emerald-100/60 via-teal-100/50 via-cyan-100/45 to-sky-200/50 dark:from-emerald-950/35 dark:via-teal-950/25 dark:to-cyan-950/40',
    stageBorderClass: 'border-emerald-300/60 dark:border-emerald-400/30',
    atmosphereEmoji: ['🍃', '☀️', '🌲', '✨'],
  },
];

/** Builds a 30-minute timeline cluster from a non-empty ascending list of notes. */
export function buildTimelineCluster(notes: CloudDayNote[]): TimelineCluster {
  const isCluster = notes.length > 1;
  const first = notes[0];
  const last = notes[notes.length - 1];

  const avgMinutes = Math.round(notes.reduce((acc, n) => acc + n.timeMinutes, 0) / notes.length);

  const timeLabel = !isCluster || first.time === last.time ? first.time : `${first.time}–${last.time}`;

  const timeSpanLabel = isCluster
    ? first.time === last.time
      ? `${first.time} (${notes.length} мыслей в стопке)`
      : `${first.time}–${last.time} (${notes.length} мыслей в стопке)`
    : undefined;

  const id = isCluster
    ? `cluster-${first.id}-${notes.length}-${first.timeMinutes}`
    : first.id;

  return {
    id,
    timeMinutes: avgMinutes,
    time: timeLabel,
    timeSpanLabel,
    notes,
    isCluster,
  };
}

/** Groups notes sorted by timeMinutes ascending into 30-minute clusters. */
export function groupNotesIntoClusters(
  notes: CloudDayNote[],
  gapMinutes: number = CLOUD_CLUSTER_GAP_MINUTES,
): TimelineCluster[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.timeMinutes - b.timeMinutes);
  const clusters: TimelineCluster[] = [];
  let currentGroup: CloudDayNote[] = [];

  for (const note of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(note);
    } else {
      const clusterStart = currentGroup[0].timeMinutes;
      if (note.timeMinutes - clusterStart <= gapMinutes) {
        currentGroup.push(note);
      } else {
        clusters.push(buildTimelineCluster(currentGroup));
        currentGroup = [note];
      }
    }
  }

  if (currentGroup.length > 0) {
    clusters.push(buildTimelineCluster(currentGroup));
  }

  return clusters;
}

/** Converts minutes (08:00=480 to 24:00=1440) to percentage (6% to 94%). */
export function getTimelinePercent(timeMinutes: number): number {
  const startMins = 480;
  const endMins = 1440;
  const clamped = Math.max(startMins, Math.min(endMins, timeMinutes));
  const pct = ((clamped - startMins) / (endMins - startMins)) * 88 + 6;
  return Math.round(pct * 10) / 10;
}

/** Parses an `HH:MM` string into total minutes from midnight. */
export function parseTimeToMinutes(time: string | null | undefined, fallbackMinutes = 720): number {
  if (!time) return fallbackMinutes;
  const [hh, mm] = time.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return fallbackMinutes;
  return Math.max(0, Math.min(1440, hh * 60 + mm));
}

/**
 * Resolves a click X coordinate inside the 08:00–24:00 timeline span (6%..94% width)
 * into a 15-minute-snapped `HH:MM` timestamp and minute offset.
 */
export function resolveTimelineClickTime(
  clientX: number,
  rect: { left: number; width: number },
): { time: string; timeMinutes: number } | null {
  if (!rect.width || rect.width <= 0) return null;
  const clickX = clientX - rect.left;
  const rawRatio = Math.max(0, Math.min(1, clickX / rect.width));
  const normalized = Math.max(0, Math.min(1, (rawRatio - 0.06) / 0.88));
  const rawMinutes = 480 + normalized * (1440 - 480);
  const snapped = Math.round(rawMinutes / 15) * 15;
  const clamped = Math.max(480, Math.min(23 * 60 + 45, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return {
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    timeMinutes: clamped,
  };
}

/** Staggered candlestick stem height across 3 tiers. */
export function getNoteStemHeight(index: number): number {
  return (index % 3) * 105 + 85;
}

export function getAccentStemClasses(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 shadow-amber-500/20';
    case 'emerald':
      return 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 shadow-emerald-500/20';
    case 'indigo':
      return 'bg-gradient-to-t from-indigo-500 via-indigo-400 to-indigo-300 shadow-indigo-500/20';
    case 'rose':
      return 'bg-gradient-to-t from-rose-500 via-rose-400 to-rose-300 shadow-rose-500/20';
    case 'cyan':
      return 'bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-cyan-500/20';
    case 'violet':
      return 'bg-gradient-to-t from-violet-500 via-violet-400 to-violet-300 shadow-violet-500/20';
    default:
      return 'bg-amber-400';
  }
}

export function getAccentGlowClasses(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'bg-amber-500 ring-amber-400/50';
    case 'emerald':
      return 'bg-emerald-500 ring-emerald-400/50';
    case 'indigo':
      return 'bg-indigo-500 ring-indigo-400/50';
    case 'rose':
      return 'bg-rose-500 ring-rose-400/50';
    case 'cyan':
      return 'bg-cyan-500 ring-cyan-400/50';
    case 'violet':
      return 'bg-violet-500 ring-violet-400/50';
    default:
      return 'bg-amber-500 ring-amber-400/50';
  }
}

export function getClusterPinClasses(isCluster: boolean, accent: ArenaAccentColor): string {
  const base = isCluster
    ? 'w-4 h-4 rounded-full border-2 border-surface ring-4 transition-transform group-hover:scale-125 cursor-pointer pointer-events-auto'
    : 'w-3 h-3 rounded-full border-2 border-surface ring-2 transition-transform group-hover:scale-125 cursor-pointer pointer-events-auto';
  return `${base} ${getAccentGlowClasses(accent)}`;
}

export function getNoteBorderClass(accent: ArenaAccentColor): string {
  switch (accent) {
    case 'amber':
      return 'border-amber-400';
    case 'emerald':
      return 'border-emerald-500';
    case 'indigo':
      return 'border-indigo-400';
    case 'rose':
      return 'border-rose-400';
    case 'cyan':
      return 'border-cyan-400';
    case 'violet':
      return 'border-violet-400';
    default:
      return 'border-amber-300';
  }
}

export function getCloudTypeLabel(type: CloudItemType): string {
  if (type === 'thought') return 'Мысль';
  if (type === 'proposal') return 'Идея';
  return 'Экшен';
}

export function getCloudTypeEmoji(type: CloudItemType): string {
  if (type === 'thought') return '💭';
  if (type === 'proposal') return '💡';
  return '⚡';
}

export type CloudNowIndicatorMode = 'beam' | 'orb';

export interface CelestialOrbState {
  /** 0 (08:00) .. 1 (24:00) */
  progress: number;
  /** Timeline horizontal position in % (6..94) */
  leftPercent: number;
  /** Parabolic sky height in % above road bar (aligned with stretched sky arc) */
  bottomPercent: number;
  /** Exact SVG quadratic Bezier path from off-canvas left edge up to the orb center */
  traveledArcPath: string;
  /** 0 = full sun, 1 = thin crescent moon */
  moonFactor: number;
  sunRaysOpacity: number;
  starsOpacity: number;
  /** SVG mask circle coordinates inside 64x64 viewBox */
  maskCx: number;
  maskCy: number;
  coreColor: string;
  edgeColor: string;
  glowColor: string;
  badgeClasses: string;
  phaseLabel: string;
  phaseEmoji: string;
}

const ORB_ARC_P0 = { x: -50, y: 296 };
const ORB_ARC_P1 = { x: 500, y: -184 };
const ORB_ARC_P2 = { x: 1050, y: 296 };

export const CELESTIAL_ORB_FULL_ARC_PATH = `M ${ORB_ARC_P0.x} ${ORB_ARC_P0.y} Q ${ORB_ARC_P1.x} ${ORB_ARC_P1.y} ${ORB_ARC_P2.x} ${ORB_ARC_P2.y}`;

/**
 * Computes position, Moon↔Sun morphing state, and palette for the Celestial Orb indicator
 * across the 08:00 (480m) — 24:00 (1440m) cloud timeline.
 */
export function getCelestialOrbState(timeMinutes: number): CelestialOrbState {
  const startMins = 480;
  const endMins = 1440;
  const clamped = Math.max(startMins, Math.min(endMins, timeMinutes));
  const progress = (clamped - startMins) / (endMins - startMins);
  const leftPercent = getTimelinePercent(clamped);

  // Map 6%..94% timeline span onto stretched arc u in [0.1..0.9] so ends extend past canvas edges
  const u = (leftPercent * 10 - ORB_ARC_P0.x) / (ORB_ARC_P2.x - ORB_ARC_P0.x);
  const oneMinusU = 1 - u;
  const q0x = oneMinusU * ORB_ARC_P0.x + u * ORB_ARC_P1.x;
  const q0y = oneMinusU * ORB_ARC_P0.y + u * ORB_ARC_P1.y;
  const orbX = Math.round(leftPercent * 10 * 10) / 10;
  const orbY = Math.round((oneMinusU * oneMinusU * ORB_ARC_P0.y + 2 * oneMinusU * u * ORB_ARC_P1.y + u * u * ORB_ARC_P2.y) * 10) / 10;
  const bottomPercent = Math.round(((400 - orbY) / 400) * 100 * 10) / 10;
  const traveledArcPath = `M ${ORB_ARC_P0.x} ${ORB_ARC_P0.y} Q ${Math.round(q0x * 10) / 10} ${Math.round(q0y * 10) / 10} ${orbX} ${orbY}`;

  let moonFactor = 0;
  if (clamped < 570) {
    // 08:00 — 09:30: dawn crescent moon melts into full morning sun
    moonFactor = 0.85 * (1 - (clamped - 480) / 90);
  } else if (clamped >= 1050 && clamped < 1260) {
    // 17:30 — 21:00: sunset sun gradually turns into dusk crescent
    moonFactor = 0.65 * ((clamped - 1050) / 210);
  } else if (clamped >= 1260) {
    // 21:00 — 24:00: night crescent moon
    moonFactor = 0.65 + 0.27 * ((clamped - 1260) / 180);
  }
  moonFactor = Math.round(Math.max(0, Math.min(1, moonFactor)) * 100) / 100;

  const sunRaysOpacity =
    clamped < 540
      ? 0
      : clamped < 720
        ? Math.round(((clamped - 540) / 180) * 100) / 100
        : clamped <= 1020
          ? 1
          : clamped < 1140
            ? Math.round((1 - (clamped - 1020) / 120) * 100) / 100
            : 0;

  const starsOpacity =
    clamped < 1200 ? 0 : Math.round(Math.min(1, (clamped - 1200) / 150) * 100) / 100;

  const shadowSign = clamped < 720 ? 1 : -1;
  const maskDist = 37 - moonFactor * 25;
  const maskCx = Math.round((32 + shadowSign * maskDist * 0.78) * 10) / 10;
  const maskCy = Math.round((32 - maskDist * 0.625) * 10) / 10;

  const base = {
    progress,
    leftPercent,
    bottomPercent,
    traveledArcPath,
    moonFactor,
    sunRaysOpacity,
    starsOpacity,
    maskCx,
    maskCy,
  };

  if (clamped < 570) {
    return {
      ...base,
      coreColor: '#fef3c7',
      edgeColor: '#fdba74',
      glowColor: 'rgba(251, 191, 36, 0.5)',
      badgeClasses: 'bg-amber-200 dark:bg-amber-700 text-amber-950 dark:text-amber-100',
      phaseLabel: 'Рассвет',
      phaseEmoji: '🌅',
    };
  }
  if (clamped < 720) {
    return {
      ...base,
      coreColor: '#fef08a',
      edgeColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.55)',
      badgeClasses: 'bg-amber-300 dark:bg-amber-600 text-amber-950 dark:text-amber-100',
      phaseLabel: 'Утреннее солнце',
      phaseEmoji: '🌤️',
    };
  }
  if (clamped < 1020) {
    return {
      ...base,
      coreColor: '#fef9c3',
      edgeColor: '#f97316',
      glowColor: 'rgba(245, 158, 11, 0.65)',
      badgeClasses: 'bg-amber-300 dark:bg-amber-600 text-amber-900 dark:text-amber-100',
      phaseLabel: 'Солнце в зените',
      phaseEmoji: '☀️',
    };
  }
  if (clamped < 1260) {
    return {
      ...base,
      coreColor: '#fed7aa',
      edgeColor: '#e11d48',
      glowColor: 'rgba(244, 63, 94, 0.5)',
      badgeClasses: 'bg-rose-200 dark:bg-rose-800 text-rose-950 dark:text-rose-100',
      phaseLabel: 'Закат',
      phaseEmoji: '🌆',
    };
  }
  return {
    ...base,
    coreColor: '#f8fafc',
    edgeColor: '#818cf8',
    glowColor: 'rgba(129, 140, 248, 0.6)',
    badgeClasses: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-950 dark:text-indigo-100',
    phaseLabel: 'Ночная луна',
    phaseEmoji: '🌙',
  };
}
