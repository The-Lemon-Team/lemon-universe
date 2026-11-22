import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import {
  ArenaActorCard,
  CloudDayNote,
  CloudItemType,
  NoteActorLike,
  NoteVisibility,
} from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ProfileService } from '../../core/services/profile.service';
import { ActorAvatarComponent } from './actor-avatar.component';
import {
  detectMentionedActors,
  getAccentAvatarClasses,
  getAccentPillClasses,
} from './arena-ui.utils';

export type HeroNoteFilterTab = 'ALL' | 'PINNED' | 'PRIVATE' | 'PUBLIC' | 'GM_ONLY';
export type HeroModalViewMode = 'FLOATING' | 'TIERS' | 'LIST';

@Component({
  selector: 'app-arena-hero-notes-modal',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, ModalOverlayDirective, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes gentleFloat {
      0%, 100% {
        transform: translateY(0px) rotate(var(--tw-rotate, 0deg));
      }
      50% {
        transform: translateY(-5px) rotate(calc(var(--tw-rotate, 0deg) + 0.3deg));
      }
    }
    .floating-card {
      animation: gentleFloat 5.2s ease-in-out infinite;
      will-change: transform;
      contain: layout style;
    }
    .floating-card:nth-child(2n) {
      animation-duration: 6.4s;
      animation-delay: 0.8s;
    }
    .floating-card:nth-child(3n) {
      animation-duration: 4.8s;
      animation-delay: 1.5s;
    }
    .floating-card:nth-child(4n) {
      animation-duration: 5.8s;
      animation-delay: 2.1s;
    }
    .floating-card:hover {
      animation-play-state: paused;
    }
  `],
  templateUrl: './arena-hero-notes-modal.component.html'
})
export class ArenaHeroNotesModalComponent {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly profile = inject(ProfileService);
  protected readonly getAccentAvatarClasses = getAccentAvatarClasses;
  protected readonly getAccentPillClasses = getAccentPillClasses;

  @Input() actor: ArenaActorCard | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  readonly modalViewMode = signal<HeroModalViewMode>('FLOATING');
  readonly activeTab = signal<HeroNoteFilterTab>('ALL');
  readonly floatingFilter = signal<'ALL' | 'PUBLIC' | 'PRIVATE' | 'GM_ONLY' | 'PARTY'>('ALL');

  newNoteText = '';
  readonly newNoteType = signal<CloudItemType>('thought');
  readonly newNoteVisibility = signal<NoteVisibility>('PUBLIC');
  newNotePinToHero = true;
  newNotePinToCloud = false;
  readonly selectedPartyActorIds = signal<string[]>([]);
  readonly selectedSubActorId = signal<string | null>(null);
  readonly expandedLikesNoteId = signal<string | null>(null);

  selectedSubActor(): ArenaActorCard | null {
    const id = this.selectedSubActorId();
    if (!id) return null;
    return this.arena.getActor(id) ?? null;
  }

  setSubActor(actorId: string): void {
    if (this.selectedSubActorId() === actorId) {
      this.selectedSubActorId.set(null);
    } else {
      this.selectedSubActorId.set(actorId);
    }
  }

  private detectedCacheKey = '';
  private detectedCacheList: ArenaActorCard[] = [];
  private detectedCacheIds = new Set<string>();

  get heroNotes$() {
    return this.actor ? this.arena.getHeroNotes(this.actor.id) : null;
  }

  onDismiss(): void {
    this.resetForm();
    this.close.emit();
  }

  resetForm(): void {
    this.newNoteText = '';
    this.newNoteType.set('thought');
    this.newNoteVisibility.set('PUBLIC');
    this.newNotePinToHero = true;
    this.newNotePinToCloud = false;
    this.selectedPartyActorIds.set([]);
    this.selectedSubActorId.set(null);
    this.expandedLikesNoteId.set(null);
    this.detectedCacheKey = '';
    this.detectedCacheList = [];
    this.detectedCacheIds.clear();
  }

  private updateDetectedActorsCache(): void {
    const actorId = this.actor?.id ?? '';
    const key = `${actorId}::${this.newNoteText}`;
    if (this.detectedCacheKey === key) {
      return;
    }
    this.detectedCacheKey = key;
    this.detectedCacheList = detectMentionedActors(this.newNoteText, this.arena.getActors(), this.actor?.id);
    this.detectedCacheIds = new Set(this.detectedCacheList.map((a) => a.id));
  }

  get detectedActorsFromText(): ArenaActorCard[] {
    this.updateDetectedActorsCache();
    return this.detectedCacheList;
  }

  togglePartyActor(actorId: string): void {
    const current = this.selectedPartyActorIds();
    if (current.includes(actorId)) {
      this.selectedPartyActorIds.set(current.filter((id) => id !== actorId));
    } else {
      this.selectedPartyActorIds.set([...current, actorId]);
    }
  }

  isPartyActorSelected(actorId: string): boolean {
    this.updateDetectedActorsCache();
    return this.selectedPartyActorIds().includes(actorId) || this.detectedCacheIds.has(actorId);
  }

  toggleExpandedLikes(noteId: string): void {
    this.expandedLikesNoteId.update((curr) => (curr === noteId ? null : noteId));
  }

  getActor(actorId: string): ArenaActorCard | undefined {
    return this.arena.getActor(actorId);
  }

  hasActorLiked(note: CloudDayNote): boolean {
    const actorId = this.actor?.id;
    if (!actorId || !note.likedByActors) return false;
    return note.likedByActors.some((l) => l.actorId === actorId);
  }

  toggleLike(noteId: string): void {
    this.arena.toggleNoteLike(noteId, this.actor?.id);
  }

  getVisibleLikes(note: CloudDayNote): NoteActorLike[] {
    return note.likedByActors ? note.likedByActors.slice(0, 3) : [];
  }

  getHiddenLikes(note: CloudDayNote): NoteActorLike[] {
    return note.likedByActors && note.likedByActors.length > 3
      ? note.likedByActors.slice(3)
      : [];
  }

  getHiddenLikesNames(note: CloudDayNote): string {
    const hidden = this.getHiddenLikes(note);
    return hidden.map((l) => l.actorName).join(', ');
  }

  getHiddenLikesTooltip(note: CloudDayNote): string {
    const hidden = this.getHiddenLikes(note);
    return 'Также оценили: ' + hidden.map((l) => l.actorName).join(', ');
  }

  getLikesWord(count: number): string {
    if (count % 10 === 1 && count % 100 !== 11) return 'лайк';
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'лайка';
    return 'лайков';
  }

  getPartyNames(note: CloudDayNote): string {
    if (!note.partyActorIds || note.partyActorIds.length === 0) return '';
    return note.partyActorIds
      .map((id) => this.getActor(id)?.name || id)
      .join(', ');
  }

  isMyNote(note: CloudDayNote): boolean {
    return note.authorProfileId === this.profile.currentProfileId;
  }

  submitNote(): void {
    if (!this.actor || !this.newNoteText.trim()) return;

    const detectedIds = this.detectedActorsFromText.map((a) => a.id);
    const explicitSub = this.selectedSubActorId();
    const subActorId = explicitSub || (detectedIds.length > 0 ? detectedIds[0] : undefined);

    const initialParty = [...this.selectedPartyActorIds(), ...detectedIds];
    if (subActorId && !initialParty.includes(subActorId)) {
      initialParty.push(subActorId);
    }
    const combinedIds = Array.from(new Set(initialParty));

    this.arena.addHeroNote({
      actorId: this.actor.id,
      text: this.newNoteText,
      type: this.newNoteType(),
      visibility: this.newNoteVisibility(),
      isPinnedToHero: this.newNotePinToHero,
      isPinnedToCloud: this.newNotePinToCloud,
      partyActorIds: combinedIds,
      subActorId,
    });

    this.resetForm();
  }

  adoptToPrivate(noteId: string): void {
    this.arena.adoptNoteToPrivate(noteId);
  }

  getNotesByVisibility(notes: CloudDayNote[], visibility: NoteVisibility): CloudDayNote[] {
    if (visibility === 'PUBLIC') {
      return notes.filter((n) => n.visibility === 'PUBLIC' || !n.visibility);
    }
    return notes.filter((n) => n.visibility === visibility);
  }

  filterFloatingNotes(notes: CloudDayNote[]): CloudDayNote[] {
    const filter = this.floatingFilter();
    if (filter === 'PARTY') {
      return notes.filter((n) => n.partyActorIds && n.partyActorIds.length > 0);
    }
    if (filter === 'PUBLIC') {
      return this.getNotesByVisibility(notes, 'PUBLIC');
    }
    if (filter === 'PRIVATE') {
      return this.getNotesByVisibility(notes, 'PRIVATE');
    }
    if (filter === 'GM_ONLY') {
      return this.getNotesByVisibility(notes, 'GM_ONLY');
    }
    return notes;
  }

  filterNotesByTab(tab: HeroNoteFilterTab, notes: CloudDayNote[]): CloudDayNote[] {
    if (tab === 'PINNED') {
      return notes.filter((n) => Boolean(n.isPinnedToHero));
    }
    if (tab === 'PRIVATE') {
      return notes.filter((n) => n.visibility === 'PRIVATE');
    }
    if (tab === 'PUBLIC') {
      return notes.filter((n) => n.visibility === 'PUBLIC' || !n.visibility);
    }
    if (tab === 'GM_ONLY') {
      return notes.filter((n) => n.visibility === 'GM_ONLY');
    }
    return notes;
  }

  filterNotes(notes: CloudDayNote[]): CloudDayNote[] {
    return this.filterNotesByTab(this.activeTab(), notes);
  }

  getTabCount(tab: HeroNoteFilterTab, notes: CloudDayNote[]): number {
    return this.filterNotesByTab(tab, notes).length;
  }

  getMoodEmoji(type: CloudItemType): string {
    return type === 'proposal' ? '💡' : type === 'action' ? '⚡' : '💭';
  }

  getMoodFallback(type?: CloudItemType): string {
    return type === 'proposal' ? '💡' : type === 'action' ? '⚡' : '💭';
  }

  getTierLabel(visibility?: NoteVisibility): string {
    if (visibility === 'PRIVATE') return 'Лично';
    if (visibility === 'GM_ONLY') return 'Архаика';
    return 'Публично';
  }

  getTierBadgeClasses(visibility?: NoteVisibility): string {
    if (visibility === 'PRIVATE') {
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
    }
    if (visibility === 'GM_ONLY') {
      return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
  }

  getCardTierClasses(note: CloudDayNote): string {
    if (note.visibility === 'PRIVATE') {
      return 'border-indigo-400/40 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20';
    }
    if (note.visibility === 'GM_ONLY') {
      return 'border-purple-400/40 hover:border-purple-500 hover:ring-2 hover:ring-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20';
    }
    return 'border-emerald-400/40 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20';
  }

  getDynamicTilt(index: number): number {
    const tilts = [-1.4, 0.8, -0.6, 1.2, -1.0, 1.4];
    return tilts[index % tilts.length];
  }
}
