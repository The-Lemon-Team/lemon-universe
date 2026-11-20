import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Manages PWA installation prompts and Service Worker update notifications.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly updateAvailable = signal(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const onBeforeInstall = (event: Event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      };

      const onAppInstalled = () => {
        this.deferredPrompt = null;
        this.canInstall.set(false);
      };

      window.addEventListener('beforeinstallprompt', onBeforeInstall);
      window.addEventListener('appinstalled', onAppInstalled);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onAppInstalled);
      });
    }

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => {
          this.updateAvailable.set(true);
        });
    }
  }

  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }
    const promptEvent = this.deferredPrompt;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'dismissed') {
      // Browser may re-emit beforeinstallprompt later if eligible
      this.canInstall.set(false);
    }
  }

  async applyUpdate(): Promise<void> {
    if (!this.swUpdate?.isEnabled) {
      return;
    }
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
