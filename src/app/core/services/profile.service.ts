import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, combineLatest, filter, map, of, shareReplay, tap } from 'rxjs';
import { AppMode, PlayerType, Profile } from '../models/flow.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);

  private readonly defaultProfile: Profile = {
    id: '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    handle: 'default',
    displayName: '👤 Мой Дом (Игрок)',
    avatarIcon: 'home',
    playerType: 'HUMAN',
    defaultFeedSlug: 'universe-personal-feed',
    createdAt: new Date().toISOString(),
  };

  private readonly agentProfile: Profile = {
    id: 'a7e49c10-9100-4b22-a811-9000a6e17001',
    handle: 'ai_agents',
    displayName: '🤖 Игрок-Агент (AI Guild)',
    avatarIcon: 'smart_toy',
    playerType: 'AGENT',
    defaultFeedSlug: 'universe-coding-sessions',
    createdAt: new Date().toISOString(),
  };

  private readonly profilesSubject = new BehaviorSubject<Profile[]>([
    this.defaultProfile,
    this.agentProfile,
  ]);
  private readonly activeProfileIdSubject = new BehaviorSubject<string>(this.defaultProfile.id);
  private readonly appModeSubject = new BehaviorSubject<AppMode>('party');

  readonly profiles$: Observable<Profile[]> = this.profilesSubject.asObservable();
  readonly activeProfileId$: Observable<string> = this.activeProfileIdSubject.pipe(
    filter((id) => Boolean(id)),
  );
  readonly appMode$: Observable<AppMode> = this.appModeSubject.asObservable();

  readonly activeProfile$: Observable<Profile> = combineLatest([
    this.profiles$,
    this.activeProfileId$,
  ]).pipe(
    map(([profiles, activeId]) => profiles.find((p) => p.id === activeId) ?? profiles[0]),
    filter((p): p is Profile => Boolean(p)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.loadProfiles();
  }

  get currentProfileId(): string {
    return this.activeProfileIdSubject.value;
  }

  get currentProfile(): Profile {
    const id = this.activeProfileIdSubject.value;
    return this.profilesSubject.value.find((p) => p.id === id) ?? this.profilesSubject.value[0];
  }

  loadProfiles(): void {
    this.api
      .getProfiles()
      .pipe(catchError(() => of(this.profilesSubject.value)))
      .subscribe((profiles) => {
        if (profiles.length > 0) {
          this.profilesSubject.next(profiles);
          if (!profiles.some((p) => p.id === this.activeProfileIdSubject.value)) {
            this.activeProfileIdSubject.next(profiles[0].id);
          }
        }
      });
  }

  selectProfile(profileId: string): void {
    if (this.activeProfileIdSubject.value !== profileId) {
      this.activeProfileIdSubject.next(profileId);
    }
  }

  setAppMode(mode: AppMode): void {
    this.appModeSubject.next(mode);
  }

  registerProfile(dto: {
    handle: string;
    displayName: string;
    avatarIcon?: string;
    playerType?: PlayerType;
    defaultFeedSlug?: string;
    seasonsUserId?: string;
    seasonsUserKey?: string;
  }): Observable<Profile> {
    const cleanHandle = dto.handle.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const cleanName = dto.displayName.trim();
    const icon = dto.avatarIcon || (dto.playerType === 'AGENT' ? 'smart_toy' : 'person');

    return this.api
      .registerProfile({
        handle: cleanHandle,
        displayName: cleanName,
        avatarIcon: icon,
        playerType: dto.playerType,
        defaultFeedSlug: dto.defaultFeedSlug,
        seasonsUserId: dto.seasonsUserId?.trim() || undefined,
        seasonsUserKey: dto.seasonsUserKey?.trim() || undefined,
      })
      .pipe(
        tap((created) => {
          const existing = this.profilesSubject.value;
          const next = existing.some((p) => p.id === created.id)
            ? existing
            : [...existing, created];
          this.profilesSubject.next(next);
          this.activeProfileIdSubject.next(created.id);
        }),
      );
  }

  updateProfileSeasons(
    profileId: string,
    dto: { seasonsUserId?: string | null; seasonsUserKey?: string | null },
  ): Observable<Profile> {
    return this.api.updateProfileSeasons(profileId, dto).pipe(
      tap((updated) => {
        const next = this.profilesSubject.value.map((p) => (p.id === updated.id ? updated : p));
        this.profilesSubject.next(next);
      }),
    );
  }
}
