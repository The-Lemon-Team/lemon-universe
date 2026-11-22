import { Injectable, computed, signal } from '@angular/core';
import {
  PRESET_WATCHER_HASHTAGS,
  PRESET_WATCHER_MOMENT_CARDS,
  PresetLemonWatchersAdapter,
  WATCHER_CATEGORIES_CATALOG,
} from './adapters/preset-watchers.adapter';
import {
  createNoteSnapshotFromHashtag,
  createNoteWorldMomentSnapshot,
} from './adapters/timeline-hashtag-satellite.adapter';
import {
  LemonWatchersAdapterPort,
  LemonWatchersFeedSnapshot,
  NoteWorldMomentSnapshot,
  WatcherCategoryCode,
  WatcherMomentCard,
  WatcherTrendingHashtag,
} from './watchers.models';

@Injectable({ providedIn: 'root' })
export class LemonWatchersService {
  private static readonly SATELLITE_ENABLED_STORAGE_KEY = 'lemon.watchers.satelliteEnabled';
  private static readonly ACTIVE_MOMENT_STORAGE_KEY = 'lemon.watchers.activeMomentId';

  private watchersAdapter: LemonWatchersAdapterPort = new PresetLemonWatchersAdapter();

  readonly categoriesCatalog = WATCHER_CATEGORIES_CATALOG;

  readonly feedSnapshot = signal<LemonWatchersFeedSnapshot>(this.buildInitialSnapshot());
  readonly selectedCategory = signal<WatcherCategoryCode>('all');
  readonly selectedHashtag = signal<string | null>(null);
  readonly activeMomentId = signal<string | null>(this.loadSavedActiveMomentId());
  readonly satelliteEnabled = signal<boolean>(this.loadSavedSatelliteEnabled());
  readonly isLoading = signal<boolean>(false);

  /**
   * Currently pinned/featured best moment of the day displayed on the Hashtag Cloud Satellite
   * and used for one-click "Зафиксировать момент" capture.
   */
  readonly activeMoment = computed<WatcherMomentCard>(() => {
    const feed = this.feedSnapshot();
    const id = this.activeMomentId();
    if (id) {
      const found = feed.cards.find((c) => c.id === id);
      if (found) return found;
    }
    return feed.bestMoments[0] ?? feed.cards[0];
  });

  readonly filteredHashtags = computed<WatcherTrendingHashtag[]>(() => {
    const cat = this.selectedCategory();
    const all = this.feedSnapshot().hashtags;
    if (cat === 'all') return all;
    return all.filter((h) => h.category === cat);
  });

  readonly selectedHashtagDetail = computed<WatcherTrendingHashtag | null>(() => {
    const tag = this.selectedHashtag();
    if (!tag) return null;
    return this.feedSnapshot().hashtags.find((h) => h.tag === tag) ?? null;
  });

  readonly filteredBestMoments = computed<WatcherMomentCard[]>(() => {
    const cat = this.selectedCategory();
    const tag = this.selectedHashtag();
    let list = this.feedSnapshot().bestMoments;
    if (cat !== 'all') {
      const byCat = list.filter((m) => m.category === cat);
      if (byCat.length > 0) list = byCat;
    }
    if (tag) {
      const byTag = list.filter((m) => m.hashtags.includes(tag));
      if (byTag.length > 0) return byTag;
    }
    return list;
  });

  readonly filteredCards = computed<WatcherMomentCard[]>(() => {
    const cat = this.selectedCategory();
    const tag = this.selectedHashtag();
    let list = this.feedSnapshot().cards;
    if (cat !== 'all') {
      list = list.filter((c) => c.category === cat);
    }
    if (tag) {
      list = list.filter((c) => c.hashtags.includes(tag));
    }
    return list;
  });

  /**
   * Allows replacing the adapter in unit tests or when connecting the live lemon-watchers backend endpoint.
   */
  configureAdapter(adapter: LemonWatchersAdapterPort): void {
    this.watchersAdapter = adapter;
  }

  async refreshWorldPulse(dateKey?: string): Promise<LemonWatchersFeedSnapshot> {
    this.isLoading.set(true);
    try {
      const snapshot = await this.watchersAdapter.fetchWorldPulse(dateKey);
      this.feedSnapshot.set(snapshot);
      return snapshot;
    } finally {
      this.isLoading.set(false);
    }
  }

  selectCategory(category: WatcherCategoryCode): void {
    this.selectedCategory.set(category);
    const currentTag = this.selectedHashtag();
    if (currentTag && category !== 'all') {
      const tagObj = this.feedSnapshot().hashtags.find((h) => h.tag === currentTag);
      if (tagObj && tagObj.category !== category) {
        this.selectedHashtag.set(null);
      }
    }
  }

  toggleHashtag(tag: string | null): void {
    if (!tag) {
      this.selectedHashtag.set(null);
      return;
    }
    this.selectedHashtag.update((curr) => (curr === tag ? null : tag));
  }

  setActiveMoment(momentId: string): void {
    this.activeMomentId.set(momentId);
    try {
      localStorage.setItem(LemonWatchersService.ACTIVE_MOMENT_STORAGE_KEY, momentId);
    } catch {
      // Ignore storage errors
    }
  }

  setSatelliteEnabled(enabled: boolean): void {
    this.satelliteEnabled.set(enabled);
    try {
      localStorage.setItem(
        LemonWatchersService.SATELLITE_ENABLED_STORAGE_KEY,
        enabled ? 'true' : 'false',
      );
    } catch {
      // Ignore storage errors
    }
  }

  captureActiveMomentSnapshot(): NoteWorldMomentSnapshot {
    return createNoteWorldMomentSnapshot(this.activeMoment());
  }

  captureCardSnapshot(card: WatcherMomentCard): NoteWorldMomentSnapshot {
    this.setActiveMoment(card.id);
    return createNoteWorldMomentSnapshot(card);
  }

  captureHashtagSnapshot(hashtag: WatcherTrendingHashtag): NoteWorldMomentSnapshot {
    const feed = this.feedSnapshot();
    const relatedCard =
      feed.cards.find((c) => hashtag.relatedMomentIds.includes(c.id)) ??
      feed.cards.find((c) => c.hashtags.includes(hashtag.tag)) ??
      null;
    if (relatedCard) {
      this.setActiveMoment(relatedCard.id);
    }
    return createNoteSnapshotFromHashtag(hashtag, relatedCard);
  }

  private buildInitialSnapshot(): LemonWatchersFeedSnapshot {
    const cards = PRESET_WATCHER_MOMENT_CARDS;
    return {
      updatedAt: new Date().toISOString(),
      provider: 'preset-fallback',
      headlineDigest:
        'В центре внимания мира сегодня — роевые ИИ-агенты, солнечный резонанс на орбите, рекорды чистой энергии и эстетика цифрового уюта.',
      hashtags: PRESET_WATCHER_HASHTAGS,
      bestMoments: cards.filter((c) => c.isBestMomentOfDay),
      cards,
    };
  }

  private loadSavedSatelliteEnabled(): boolean {
    try {
      const saved = localStorage.getItem(LemonWatchersService.SATELLITE_ENABLED_STORAGE_KEY);
      if (saved === 'false') return false;
    } catch {
      // Ignore storage errors
    }
    return true;
  }

  private loadSavedActiveMomentId(): string | null {
    try {
      return localStorage.getItem(LemonWatchersService.ACTIVE_MOMENT_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
