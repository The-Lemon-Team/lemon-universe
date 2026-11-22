import { TestBed } from '@angular/core/testing';
import { getCelestialOrbState } from '../../components/neuron-arena/cloud-timeline.utils';
import { adaptHashtagCloudSatelliteState } from './adapters/timeline-hashtag-satellite.adapter';
import { LemonWatchersService } from './watchers.service';

describe('LemonWatchersService & HashtagCloudSatelliteAdapter', () => {
  let service: LemonWatchersService;

  beforeEach(() => {
    localStorage.removeItem('lemon.watchers.satelliteEnabled');
    localStorage.removeItem('lemon.watchers.activeMomentId');
    TestBed.configureTestingModule({});
    service = TestBed.inject(LemonWatchersService);
  });

  it('should provide initial world pulse feed with trending hashtags, best moments, and cards', () => {
    const feed = service.feedSnapshot();
    expect(feed.hashtags.length).toBeGreaterThan(0);
    expect(feed.bestMoments.length).toBeGreaterThan(0);
    expect(feed.cards.length).toBeGreaterThan(0);
    expect(service.activeMoment()).toBeTruthy();
  });

  it('should filter hashtags, best moments, and cards by category and hashtag', () => {
    service.selectCategory('tech');
    expect(service.filteredHashtags().every((h) => h.category === 'tech')).toBeTrue();
    expect(service.filteredCards().every((c) => c.category === 'tech')).toBeTrue();

    service.selectCategory('all');
    service.toggleHashtag('ии-агенты');
    expect(service.selectedHashtag()).toBe('ии-агенты');
    expect(service.selectedHashtagDetail()?.tag).toBe('ии-агенты');
    expect(service.filteredCards().every((c) => c.hashtags.includes('ии-агенты'))).toBeTrue();
  });

  it('should compute companion orbital position for the Hashtag Cloud Satellite along the day arc without colliding with the primary orb', () => {
    const noonOrb = getCelestialOrbState(13 * 60);
    const satNoon = adaptHashtagCloudSatelliteState(noonOrb, service.feedSnapshot());

    expect(Math.abs(satNoon.leftPercent - noonOrb.leftPercent)).toBeGreaterThanOrEqual(18);
    expect(satNoon.bottomPercent).toBeGreaterThan(20);
    expect(satNoon.cloudTags.length).toBe(5);
    expect(satNoon.primaryTag?.tag).toBe('ии-агенты');

    const eveningOrb = getCelestialOrbState(21 * 60);
    const satEvening = adaptHashtagCloudSatelliteState(eveningOrb, service.feedSnapshot());
    expect(Math.abs(satEvening.leftPercent - eveningOrb.leftPercent)).toBeGreaterThanOrEqual(18);
  });

  it('should capture immutable NoteWorldMomentSnapshot from active moment, card, or hashtag', () => {
    const snap = service.captureActiveMomentSnapshot();
    expect(snap.momentId).toBe(service.activeMoment().id);
    expect(snap.title).toBe(service.activeMoment().title);
    expect(snap.hashtags.length).toBeGreaterThan(0);
    expect(snap.capturedAt).toBeTruthy();

    const tagObj = service.feedSnapshot().hashtags[0];
    const tagSnap = service.captureHashtagSnapshot(tagObj);
    expect(tagSnap.hashtags).toContain(tagObj.tag);
  });
});
