import { CelestialOrbState } from '../../../components/neuron-arena/cloud-timeline.utils';
import {
  LemonWatchersFeedSnapshot,
  NoteWorldMomentSnapshot,
  WatcherAccentColor,
  WatcherHashtagWeight,
  WatcherMomentCard,
  WatcherMomentImportance,
  WatcherTrendingHashtag,
} from '../watchers.models';
import { WATCHER_CATEGORIES_CATALOG } from './preset-watchers.adapter';

export interface SatelliteCloudTagNode {
  tag: string;
  displayTag: string;
  weight: WatcherHashtagWeight;
  trendBadge: string;
  pulseScore: number;
  accentColor: WatcherAccentColor;
  pillClasses: string;
  /** CSS positioning classes or inline offsets inside the literal hashtag cloud satellite */
  slotIndex: number;
}

export interface HashtagCloudSatelliteState {
  /** Horizontal position (%) along the timeline sky (18..82) on the parabolic orbit */
  leftPercent: number;
  /** Vertical position (%) above the road bar on the parabolic orbit */
  bottomPercent: number;
  /** SVG X coordinate in 1000x400 orbit viewBox */
  svgX: number;
  /** SVG Y coordinate in 1000x400 orbit viewBox */
  svgY: number;
  /** Top 5 trending hashtags arranged as a literal floating cloud on the orbit */
  cloudTags: SatelliteCloudTagNode[];
  /** Primary hero hashtag displayed at the center of the cloud satellite */
  primaryTag: SatelliteCloudTagNode | null;
  /** Currently featured best moment of the day */
  activeMoment: WatcherMomentCard;
  /** Total trending hashtags count in the current world feed */
  totalHashtagsCount: number;
  /** Total best moments count */
  bestMomentsCount: number;
}

const ORBIT_P0 = { x: -50, y: 296 };
const ORBIT_P1 = { x: 500, y: -184 };
const ORBIT_P2 = { x: 1050, y: 296 };

export function getWatcherHashtagPillClasses(
  accent: WatcherAccentColor,
  isSelected = false,
): string {
  if (isSelected) {
    return 'bg-primary text-on-primary border-primary shadow-sm ring-2 ring-primary/30';
  }
  switch (accent) {
    case 'violet':
      return 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-900 dark:text-violet-200 border-violet-400/45';
    case 'sky':
      return 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-900 dark:text-sky-200 border-sky-400/45';
    case 'emerald':
      return 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border-emerald-400/45';
    case 'amber':
      return 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-950 dark:text-amber-200 border-amber-400/50';
    case 'rose':
      return 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-900 dark:text-rose-200 border-rose-400/45';
    case 'cyan':
      return 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-900 dark:text-cyan-200 border-cyan-400/45';
  }
}

export function getWatcherHashtagWeightClasses(weight: WatcherHashtagWeight): string {
  switch (weight) {
    case 'xl':
      return 'text-xs sm:text-sm font-black px-3 py-1';
    case 'lg':
      return 'text-xs font-extrabold px-2.5 py-1';
    case 'md':
      return 'text-[11px] font-bold px-2.5 py-0.5';
    case 'sm':
      return 'text-[10px] font-semibold px-2 py-0.5';
  }
}

export function getWatcherImportanceBadgeClasses(importance: WatcherMomentImportance): string {
  switch (importance) {
    case 'BREAKING':
      return 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/40';
    case 'HIGHLIGHT':
      return 'bg-amber-400/20 text-amber-900 dark:text-amber-200 border-amber-400/45';
    case 'TRENDING':
      return 'bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-400/40';
    case 'INSIGHT':
      return 'bg-cyan-500/15 text-cyan-900 dark:text-cyan-200 border-cyan-400/40';
  }
}

/**
 * Computes the companion orbital position and floating hashtag cloud nodes
 * for the second satellite ("Спутник-Облако Хештегов") along the day orbit arc.
 */
export function adaptHashtagCloudSatelliteState(
  primaryOrb: CelestialOrbState,
  feed: LemonWatchersFeedSnapshot,
  activeMomentOverride?: WatcherMomentCard | null,
): HashtagCloudSatelliteState {
  // Position the Hashtag Cloud Satellite along the same parabolic day orbit
  // at a comfortable separation (~22-24%) from the Weather/Sun satellite.
  const rawLeft =
    primaryOrb.leftPercent <= 56
      ? Math.min(82, Math.max(24, primaryOrb.leftPercent + 23))
      : Math.max(18, Math.min(76, primaryOrb.leftPercent - 24));

  const leftPercent = Math.round(rawLeft * 10) / 10;
  const u = (leftPercent * 10 - ORBIT_P0.x) / (ORBIT_P2.x - ORBIT_P0.x);
  const oneMinusU = 1 - u;

  const svgX = Math.round(leftPercent * 10 * 10) / 10;
  const svgY =
    Math.round(
      (oneMinusU * oneMinusU * ORBIT_P0.y +
        2 * oneMinusU * u * ORBIT_P1.y +
        u * u * ORBIT_P2.y) *
        10,
    ) / 10;
  const bottomPercent = Math.round(((400 - svgY) / 400) * 100 * 10) / 10;

  const topTags = feed.hashtags.slice(0, 5);
  const cloudTags: SatelliteCloudTagNode[] = topTags.map((item, idx) => ({
    tag: item.tag,
    displayTag: item.displayTag,
    weight: item.weight,
    trendBadge: item.trendBadge,
    pulseScore: item.pulseScore,
    accentColor: item.accentColor,
    pillClasses: getWatcherHashtagPillClasses(item.accentColor),
    slotIndex: idx,
  }));

  const activeMoment =
    activeMomentOverride ?? feed.bestMoments[0] ?? feed.cards[0];

  return {
    leftPercent,
    bottomPercent,
    svgX,
    svgY,
    cloudTags,
    primaryTag: cloudTags[0] ?? null,
    activeMoment,
    totalHashtagsCount: feed.hashtags.length,
    bestMomentsCount: feed.bestMoments.length,
  };
}

export function createNoteWorldMomentSnapshot(
  card: WatcherMomentCard,
): NoteWorldMomentSnapshot {
  return {
    momentId: card.id,
    title: card.title,
    summary: card.summary,
    hashtags: [...card.hashtags],
    category: card.category,
    categoryLabel: card.categoryLabel,
    icon: card.icon,
    watcherName: card.watcherName,
    importanceLabel: card.bestMomentRankLabel || card.importanceLabel,
    publishedTime: card.publishedTime,
    capturedAt: new Date().toISOString(),
  };
}

export function createNoteSnapshotFromHashtag(
  hashtag: WatcherTrendingHashtag,
  relatedCard?: WatcherMomentCard | null,
): NoteWorldMomentSnapshot {
  if (relatedCard) {
    const mergedTags = Array.from(new Set([hashtag.tag, ...relatedCard.hashtags]));
    return {
      ...createNoteWorldMomentSnapshot(relatedCard),
      hashtags: mergedTags,
    };
  }
  const catMeta =
    WATCHER_CATEGORIES_CATALOG.find((c) => c.code === hashtag.category) ??
    WATCHER_CATEGORIES_CATALOG[0];
  return {
    momentId: `tag-${hashtag.tag}`,
    title: `Тема мира: #${hashtag.displayTag} (${hashtag.trendBadge})`,
    summary: hashtag.summary,
    hashtags: [hashtag.tag],
    category: hashtag.category,
    categoryLabel: catMeta.label,
    icon: catMeta.icon,
    watcherName: 'lemon-watcher/hashtag-cloud',
    importanceLabel: `${hashtag.mentionsLabel} · ${hashtag.trendBadge}`,
    capturedAt: new Date().toISOString(),
  };
}
