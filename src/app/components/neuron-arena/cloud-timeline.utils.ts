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
