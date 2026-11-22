import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ActorAvatarComponent } from '../components/neuron-arena/actor-avatar.component';
import { ArenaActorCard, ArenaDesireCard } from '../core/models/flow.models';
import { NeuronArenaService } from '../core/services/neuron-arena.service';
import { PartySoundService } from './party-sound.service';

export interface RouletteSector {
  label: string;
  icon: string;
  color: string;
  mood: string;
}

export interface GeneratedClash {
  heroA: ArenaActorCard;
  heroB: ArenaActorCard;
  activityA: string;
  activityB: string;
  compatibilityPercent: number;
  storySnippet: string;
  verdict: string;
}

@Component({
  selector: 'app-party-roulette',
  standalone: true,
  imports: [AsyncPipe, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './party-roulette.component.html'
})
export class PartyRouletteComponent implements OnInit {
  protected readonly arena = inject(NeuronArenaService);
  protected readonly sound = inject(PartySoundService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private actorsList: ArenaActorCard[] = [];
  private desireCardsList: ArenaDesireCard[] = [];

  readonly isSpinning = signal<boolean>(false);
  readonly rotationDegrees = signal<number>(0);
  readonly selectedSectorIndex = signal<number>(0);
  readonly activeMood = signal<string>('all');
  readonly activeClash = signal<GeneratedClash | null>(null);

  readonly spinDurationMs = 3200;

  readonly moodFilters = [
    { id: 'all', label: 'Всё', emoji: '✨' },
    { id: 'drive', label: 'Драйв', emoji: '⚡' },
    { id: 'chill', label: 'Чилл', emoji: '🛋️' },
    { id: 'smart', label: 'Ум', emoji: '🧠' },
    { id: 'gastro', label: 'Еда', emoji: '🍕' },
  ];

  readonly sectors: RouletteSector[] = [
    { label: 'Пицца-Пати', icon: '🍕', color: '#e11d48', mood: 'gastro' },
    { label: 'Настолки', icon: '🎲', color: '#d97706', mood: 'smart' },
    { label: 'Ретро-Файтинг', icon: '🎮', color: '#7c3aed', mood: 'drive' },
    { label: 'Коктейли', icon: '🍸', color: '#059669', mood: 'chill' },
    { label: 'Караоке', icon: '🎤', color: '#db2777', mood: 'drive' },
    { label: 'Киномарафон', icon: '🎬', color: '#2563eb', mood: 'chill' },
    { label: 'Квиз-Битва', icon: '🧠', color: '#0891b2', mood: 'smart' },
    { label: 'Челлендж', icon: '⚡', color: '#ca8a04', mood: 'drive' },
  ];

  ngOnInit(): void {
    this.arena.actors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((actors) => {
        this.actorsList = actors;
        if (!this.activeClash() && actors.length >= 2) {
          this.generateClash(this.sectors[0]);
        }
      });

    this.arena.desireCards$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cards) => {
        this.desireCardsList = cards;
      });
  }

  spin(): void {
    if (this.isSpinning()) return;
    this.isSpinning.set(true);
    this.sound.playClick();

    // Pick target sector
    const targetSectorIdx = Math.floor(Math.random() * this.sectors.length);
    const sectorAngle = 360 / this.sectors.length;
    // Pointer is on top (0 degrees). We want target sector to land at top.
    const targetAngle = 360 - targetSectorIdx * sectorAngle - sectorAngle / 2;
    const extraSpins = (4 + Math.floor(Math.random() * 3)) * 360;
    const nextTotalDegrees = this.rotationDegrees() + extraSpins + targetAngle;

    // Simulate sound ticks during spin
    this.scheduleSpinTicks();

    this.rotationDegrees.set(nextTotalDegrees);

    setTimeout(() => {
      this.isSpinning.set(false);
      this.selectedSectorIndex.set(targetSectorIdx);
      const chosenSector = this.sectors[targetSectorIdx];
      this.generateClash(chosenSector);
      this.sound.playWin();
    }, this.spinDurationMs);
  }

  selectMood(moodId: string): void {
    this.activeMood.set(moodId);
    this.sound.playClick();
    if (moodId === 'all') {
      this.spin();
      return;
    }
    const matching = this.sectors.findIndex((s) => s.mood === moodId);
    if (matching !== -1) {
      this.selectedSectorIndex.set(matching);
      this.generateClash(this.sectors[matching]);
      this.sound.playWin();
    }
  }

  launchInField(clash: GeneratedClash): void {
    this.sound.playClash();
    // Select card in arena service
    const matchingCard = this.desireCardsList.find(
      (c) => c.title.toLowerCase().includes(clash.activityA.toLowerCase()) || c.title.toLowerCase().includes(clash.activityB.toLowerCase())
    );
    if (matchingCard) {
      this.arena.inspectDesireCard(matchingCard.id);
    }
    this.router.navigate(['/party/field']);
  }

  private scheduleSpinTicks(): void {
    const tickIntervals = [100, 140, 190, 260, 360, 500, 700, 1000];
    let elapsed = 0;
    tickIntervals.forEach((interval) => {
      elapsed += interval;
      if (elapsed < this.spinDurationMs - 400) {
        setTimeout(() => {
          if (this.isSpinning()) {
            this.sound.playTick();
          }
        }, elapsed);
      }
    });
  }

  private generateClash(sector: RouletteSector): void {
    if (this.actorsList.length < 2) return;

    // Shuffle and pick 2 distinct heroes
    const shuffled = [...this.actorsList].sort(() => 0.5 - Math.random());
    const heroA = shuffled[0];
    const heroB = shuffled[1];

    const fallbackActivities = [
      sector.label,
      'Настольный квиз',
      'Ночной хакатон идей',
      'Чайная церемония и медитация',
      'Турнир по Mortal Kombat',
      'Шашлыки на балконе',
      'Спор о будущем ИИ до 4 утра',
      'Караоке с хитами 2000-х',
    ];

    const activityA = heroA.favoriteDesire || sector.label;
    const activityB = heroB.favoriteDesire || fallbackActivities[Math.floor(Math.random() * fallbackActivities.length)];

    const compat = 40 + Math.floor(Math.random() * 55);
    const verdicts = [
      '🔥 Взрывоопасная комбинация',
      '⚖️ Непримиримый парадокс',
      '✨ Идеальное дополнение',
      '🎭 Спор года в гостиной',
      '⚡ Битва титанов',
    ];

    const stories = [
      `${heroA.name} считает, что субботний вечер без «${activityA}» прожит зря. Но ${heroB.name} решительно возражает и предлагает «${activityB}». Кто уступит или объединит форматы?`,
      `${heroA.name} уже забронировал локацию под «${activityA}», в то время как ${heroB.name} принёс оборудование для «${activityB}». Гости в предвкушении дебатов!`,
      `В комнате разгорелась дискуссия: ${heroA.name} цитирует «${heroA.quote}», требуя «${activityA}». Сможет ли ${heroB.name} защитить «${activityB}»?`,
    ];

    this.activeClash.set({
      heroA,
      heroB,
      activityA,
      activityB,
      compatibilityPercent: compat,
      verdict: verdicts[Math.floor(Math.random() * verdicts.length)],
      storySnippet: stories[Math.floor(Math.random() * stories.length)],
    });
  }

  getSectorSvgPath(index: number, total: number): string {
    const angle = (2 * Math.PI) / total;
    const startAngle = index * angle - Math.PI / 2;
    const endAngle = (index + 1) * angle - Math.PI / 2;
    const cx = 100;
    const cy = 100;
    const r = 98;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  }

  getSectorTextTransform(index: number, total: number): string {
    const step = 360 / total;
    const rotation = index * step + step / 2;
    return `translate(100, 100) rotate(${rotation})`;
  }
}
