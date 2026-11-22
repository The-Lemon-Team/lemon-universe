/**
 * Standalone Lemon Watchers (World Pulse, Trending Hashtag Cloud & Best Moments) Domain Contracts.
 *
 * Designed with zero framework or UI dependencies so this module can be
 * connected directly to the lemon-watchers backend API or extracted into @lemon/watchers.
 */

export type WatcherCategoryCode = 'all' | 'tech' | 'science' | 'culture' | 'eco' | 'society';

export type WatcherTopicDomain = Exclude<WatcherCategoryCode, 'all'>;

export type WatcherMomentImportance = 'BREAKING' | 'HIGHLIGHT' | 'TRENDING' | 'INSIGHT';

export type WatcherHashtagWeight = 'xl' | 'lg' | 'md' | 'sm';

export type WatcherAccentColor = 'amber' | 'sky' | 'violet' | 'emerald' | 'rose' | 'cyan';

export interface WatcherCategoryMeta {
  code: WatcherCategoryCode;
  label: string;
  icon: string;
  accentColor: WatcherAccentColor;
}

export interface WatcherTrendingHashtag {
  /** Normalized hashtag without leading '#', e.g. 'ии-агенты' */
  tag: string;
  /** Human-readable display tag (without '#'), e.g. 'ИИ-агенты' */
  displayTag: string;
  category: WatcherTopicDomain;
  weight: WatcherHashtagWeight;
  /** Relative pulse score 1..100 */
  pulseScore: number;
  /** Formatted mentions or activity volume, e.g. '2.4k импульсов' */
  mentionsLabel: string;
  /** Short trend indicator, e.g. '🔥 +48%' or '⚡ Пик дня' */
  trendBadge: string;
  /** 1-line digest of why this hashtag is trending right now */
  summary: string;
  accentColor: WatcherAccentColor;
  /** Linked moment card IDs for instant lookup */
  relatedMomentIds: string[];
}

export interface WatcherMomentCard {
  id: string;
  title: string;
  summary: string;
  category: WatcherTopicDomain;
  categoryLabel: string;
  icon: string;
  hashtags: string[];
  /** Watcher agent / stream slug, e.g. 'lemon-watcher/tech-horizon' */
  watcherName: string;
  /** Local HH:MM time of the moment */
  publishedTime: string;
  importance: WatcherMomentImportance;
  importanceLabel: string;
  /** 1..100 world resonance score */
  pulseScore: number;
  /** Whether lemon-watchers flagged this card among the best moments of the day */
  isBestMomentOfDay: boolean;
  /** Optional rank badge for best moments, e.g. '🏆 Главный момент дня' */
  bestMomentRankLabel?: string;
  sourceLabel?: string;
}

export interface LemonWatchersFeedSnapshot {
  updatedAt: string;
  provider: 'lemon-watchers-api' | 'preset-fallback';
  headlineDigest: string;
  hashtags: WatcherTrendingHashtag[];
  bestMoments: WatcherMomentCard[];
  cards: WatcherMomentCard[];
}

/**
 * Immutable world moment snapshot stored directly inside a CloudDayNote at capture time.
 *
 * Capturing the snapshot once preserves historical context of what was happening
 * in the world at the exact moment the user recorded their thought or note.
 */
export interface NoteWorldMomentSnapshot {
  momentId: string;
  title: string;
  summary: string;
  hashtags: string[];
  category: WatcherTopicDomain;
  categoryLabel: string;
  icon: string;
  watcherName?: string;
  importanceLabel?: string;
  publishedTime?: string;
  capturedAt: string;
}

export interface LemonWatchersAdapterPort {
  fetchWorldPulse(dateKey?: string): Promise<LemonWatchersFeedSnapshot>;
}
