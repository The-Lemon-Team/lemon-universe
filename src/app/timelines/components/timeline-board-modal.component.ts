import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HashtagMultiselectComponent,
  HashtagSelectOption,
} from '../../core/components/hashtag-multiselect.component';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaActorCard,
  BoardPrivacy,
  Profile,
  TimelineBoard,
  TimelineBoardMode,
} from '../../core/models/flow.models';
import { getExtraTagsNotInText, mergeNoteTags } from '../../core/utils/hashtag.utils';

export interface CreateBoardSubmitPayload {
  title: string;
  description: string;
  hashtags: string[];
  boardMode: TimelineBoardMode;
  privacy: BoardPrivacy;
  defaultActorId: string;
  seasonsFeedSlug: string;
  memberProfileIds: string[];
}

export interface EditBoardSubmitPayload {
  title: string;
  description: string;
  hashtags: string[];
  boardMode: TimelineBoardMode;
  privacy: BoardPrivacy;
  defaultActorId: string;
  seasonsFeedSlug: string;
}

@Component({
  selector: 'app-timeline-board-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective, HashtagMultiselectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        appModalOverlay
        [appModalOverlayDismissable]="true"
        (overlayClose)="onClose()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-timeline-board-title"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <div
          (click)="$event.stopPropagation()"
          class="w-full max-w-xl rounded-3xl bg-surface-container-lowest p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-rounded text-primary text-2xl">view_timeline</span>
              <h2 id="create-timeline-board-title" class="font-headline-sm text-base font-bold">
                {{ editingBoard() ? 'Редактировать TimeLine' : 'Создать Независимый TimeLine' }}
              </h2>
            </div>
            <button
              type="button"
              (click)="onClose()"
              aria-label="Закрыть"
              class="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span class="material-symbols-rounded text-xl">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="tl-board-title" class="font-label-ui text-xs font-bold text-on-surface-variant">
              Название TimeLine:
            </label>
            <input
              id="tl-board-title"
              type="text"
              [(ngModel)]="titleDraft"
              placeholder="Напр. 📓 Мой Дневник / 🤖 Сводка Antigravity / 🚀 Проект X"
              class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label for="tl-board-mode" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Формат работы:
              </label>
              <select
                id="tl-board-mode"
                [(ngModel)]="modeDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="DIARY">📓 Простой Дневник</option>
                <option value="TIMELINE">⏱️ Независимый TimeLine</option>
                <option value="AGENT_SUMMARY">🤖 Сводка Агентов</option>
                <option value="PARTY_CLOUD">☁️ Хроно-Облако</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="tl-board-privacy" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Поле видимости (Приватность):
              </label>
              <select
                id="tl-board-privacy"
                [(ngModel)]="privacyDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                <option value="PRIVATE">🔒 Приватный (только владелец и members)</option>
                <option value="PUBLIC">🌐 Публичный (открыт в общем поле)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label for="tl-board-actor" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Персонаж по умолчанию:
              </label>
              <select
                id="tl-board-actor"
                [(ngModel)]="defaultActorDraft"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
              >
                @for (actor of actors(); track actor.id) {
                  <option [value]="actor.id">{{ actor.name }}</option>
                }
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="tl-board-feed" class="font-label-ui text-xs font-bold text-on-surface-variant">
                Feed slug в Lemon Seasons:
              </label>
              <input
                id="tl-board-feed"
                type="text"
                [(ngModel)]="feedSlugDraft"
                placeholder="Авто по названию (напр. universe-diary)"
                class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface"
              />
            </div>
          </div>

          @if (!editingBoard() && otherProfiles().length > 0) {
            <div class="flex flex-col gap-1.5">
              <span class="font-label-ui text-xs font-bold text-on-surface-variant">
                Добавить участников (members) сразу:
              </span>
              <div class="flex flex-wrap gap-2">
                @for (prof of otherProfiles(); track prof.id) {
                  <button
                    type="button"
                    (click)="toggleMember(prof.id)"
                    class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    [class]="
                      selectedMembers().includes(prof.id)
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:text-on-surface'
                    "
                  >
                    <span class="material-symbols-rounded text-sm">{{ prof.avatarIcon || 'person' }}</span>
                    <span>{{ prof.displayName }}</span>
                  </button>
                }
              </div>
            </div>
          }

          <div class="flex flex-col gap-1.5">
            <label for="tl-board-desc" class="font-label-ui text-xs font-bold text-on-surface-variant">
              Описание:
            </label>
            <textarea
              id="tl-board-desc"
              [ngModel]="descriptionDraft()"
              (ngModelChange)="descriptionDraft.set($event)"
              rows="2"
              placeholder="Для чего используется этот TimeLine... (можно писать #хештеги)"
              class="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface resize-none"
            ></textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="font-label-ui text-xs font-bold text-on-surface-variant">
              Хештеги TimeLine:
            </span>
            <app-hashtag-multiselect
              [options]="resolvedHashtagOptions()"
              [selectedTags]="selectedHashtags()"
              (selectedTagsChange)="selectedHashtags.set($event)"
              placement="up"
              placeholder="Выбрать или создать #хештеги..."
              searchPlaceholder="Поиск или новый #хештег..."
              ariaLabel="Хештеги TimeLine доски"
            />
            @if (previewHashtags().length > 0) {
              <div class="flex flex-wrap items-center gap-1">
                <span class="text-[10px] font-mono text-outline">Хештеги доски:</span>
                @for (tag of previewHashtags(); track tag) {
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                    #{{ tag }}
                  </span>
                }
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              (click)="onClose()"
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-ui text-xs font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="!titleDraft.trim()"
              class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-ui text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {{ editingBoard() ? '💾 Сохранить' : '✨ Создать TimeLine' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TimelineBoardModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly editingBoard = input<TimelineBoard | null>(null);
  readonly actors = input<ArenaActorCard[]>([]);
  readonly profiles = input<Profile[]>([]);
  readonly activeProfileId = input<string>('');
  readonly hashtagOptions = input<HashtagSelectOption[]>([]);

  readonly close = output<void>();
  readonly create = output<CreateBoardSubmitPayload>();
  readonly save = output<EditBoardSubmitPayload>();

  titleDraft = '';
  readonly descriptionDraft = signal<string>('');
  readonly selectedHashtags = signal<string[]>([]);
  modeDraft: TimelineBoardMode = 'DIARY';
  privacyDraft: BoardPrivacy = 'PRIVATE';
  defaultActorDraft = '';
  feedSlugDraft = '';
  readonly selectedMembers = signal<string[]>([]);

  readonly resolvedHashtagOptions = computed<HashtagSelectOption[]>(() => {
    const map = new Map<string, number | undefined>();
    for (const opt of this.hashtagOptions()) {
      map.set(opt.tag, opt.count);
    }
    for (const def of ['проект', 'дневник', 'работа', 'личное', 'агенты']) {
      if (!map.has(def)) map.set(def, undefined);
    }
    return Array.from(map.entries()).map(([tag, count]) => ({ tag, count }));
  });

  readonly previewHashtags = computed<string[]>(() =>
    mergeNoteTags(this.descriptionDraft(), this.selectedHashtags()),
  );

  constructor() {
    effect(
      () => {
        if (!this.isOpen()) return;
        const board = this.editingBoard();
        if (board) {
          this.titleDraft = board.title || '';
          this.descriptionDraft.set(board.description || '');
          this.selectedHashtags.set(
            getExtraTagsNotInText(board.description || '', board.hashtags),
          );
          this.modeDraft = board.boardMode || 'DIARY';
          this.privacyDraft = board.privacy || 'PRIVATE';
          this.defaultActorDraft = board.defaultActorId || this.actors()[0]?.id || '';
          this.feedSlugDraft = board.seasonsFeedSlug || '';
          this.selectedMembers.set([]);
        } else if (!this.defaultActorDraft && this.actors().length > 0) {
          this.defaultActorDraft = this.actors()[0].id;
        }
      },
      { allowSignalWrites: true },
    );
  }

  otherProfiles(): Profile[] {
    const active = this.activeProfileId();
    return this.profiles().filter((p) => p.id !== active);
  }

  toggleMember(profileId: string): void {
    this.selectedMembers.update((list) =>
      list.includes(profileId) ? list.filter((id) => id !== profileId) : [...list, profileId],
    );
  }

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  submit(): void {
    const title = this.titleDraft.trim();
    if (!title) return;
    const description = this.descriptionDraft().trim();
    const hashtags = mergeNoteTags(description, this.selectedHashtags());
    const defaultActorId = this.defaultActorDraft || this.actors()[0]?.id || 'actor-alexey';
    if (this.editingBoard()) {
      this.save.emit({
        title,
        description,
        hashtags,
        boardMode: this.modeDraft,
        privacy: this.privacyDraft,
        defaultActorId,
        seasonsFeedSlug: this.feedSlugDraft.trim(),
      });
    } else {
      this.create.emit({
        title,
        description,
        hashtags,
        boardMode: this.modeDraft,
        privacy: this.privacyDraft,
        defaultActorId,
        seasonsFeedSlug: this.feedSlugDraft.trim(),
        memberProfileIds: this.selectedMembers(),
      });
    }
    this.resetForm();
  }

  private resetForm(): void {
    this.titleDraft = '';
    this.descriptionDraft.set('');
    this.selectedHashtags.set([]);
    this.modeDraft = 'DIARY';
    this.privacyDraft = 'PRIVATE';
    this.defaultActorDraft = '';
    this.feedSlugDraft = '';
    this.selectedMembers.set([]);
  }
}
