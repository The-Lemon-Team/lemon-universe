import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { ArenaDesireCard, ArenaVoiceIntent, ArenaVoiceSource } from '../../core/models/flow.models';
import { NeuronArenaService } from '../../core/services/neuron-arena.service';
import { ActorAvatarComponent } from './actor-avatar.component';

@Component({
  selector: 'app-arena-voice-studio',
  standalone: true,
  imports: [AsyncPipe, FormsModule, ActorAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-voice-studio.component.html'
})
export class ArenaVoiceStudioComponent {
  protected readonly arena = inject(NeuronArenaService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly voiceSourceMode = signal<ArenaVoiceSource>('MANUAL_PUPPET');
  readonly voiceIntent = signal<ArenaVoiceIntent>('SUPPORT');
  readonly isRecordingMic = signal(false);
  readonly recordedAudioDataUrl = signal<string | undefined>(undefined);

  selectedTargetThreadId = 'thread-drink-beer';
  versusProposalTitle = 'Поиграть в настольную игру';
  voiceInputText = '';

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  readonly intentButtons: { id: ArenaVoiceIntent; label: string; sub: string; icon: string; iconColor: string }[] = [
    { id: 'SUPPORT', label: 'Поддержать тред', sub: 'Подтвердить карточку в поле', icon: 'thumb_up', iconColor: 'text-emerald-600' },
    { id: 'COUNTER_PROPOSE', label: 'Versus-Хотелка', sub: 'Предложить другую карточку', icon: 'swords', iconColor: 'text-amber-600' },
    { id: 'PARADOX_OPINION', label: 'Мнение на парадокс', sub: 'Философский взгляд героя', icon: 'psychology_alt', iconColor: 'text-indigo-600' },
    { id: 'ANALYTICS', label: 'Аналитика карточек', sub: 'Разбор шансов и истории', icon: 'query_stats', iconColor: 'text-violet-600' },
  ];

  constructor() {
    // При смене Главного Персонажа в режиме «Нейро-Черновик» подставляем реплику в его характере.
    this.arena.leadActor$
      .pipe(
        map((actor) => actor.id),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.voiceSourceMode() === 'NEURAL_DRAFT') {
          this.fillWithPersonaDraft();
          this.cdr.markForCheck();
        }
      });
  }

  setVoiceIntent(intent: ArenaVoiceIntent): void {
    this.voiceIntent.set(intent);
    if (this.voiceSourceMode() === 'NEURAL_DRAFT') {
      this.fillWithPersonaDraft();
    }
  }

  selectCardForVersusProposal(card: ArenaDesireCard): void {
    this.versusProposalTitle = card.title;
  }

  fillWithPersonaDraft(): void {
    this.voiceInputText = this.arena.generatePersonaDraft(this.voiceIntent(), this.selectedTargetThreadId);
  }

  submitLeadVoice(): void {
    const intent = this.voiceIntent();
    const source = this.recordedAudioDataUrl() ? 'AUDIO_VOICE' : this.voiceSourceMode();

    if (intent === 'COUNTER_PROPOSE') {
      this.arena.proposeVersusThread({
        title: this.versusProposalTitle || 'Поиграть в настольную игру',
        initialVoiceText: this.voiceInputText,
        sourceMode: source,
        audioDataUrl: this.recordedAudioDataUrl(),
      });
    } else if (intent === 'SUPPORT') {
      this.arena.supportThread(this.selectedTargetThreadId, this.voiceInputText, source, this.recordedAudioDataUrl());
    } else {
      const text = this.voiceInputText.trim() || this.arena.generatePersonaDraft(intent, this.selectedTargetThreadId);
      this.arena.postActorVoice({
        text,
        intent,
        sourceMode: source,
        audioDataUrl: this.recordedAudioDataUrl(),
      });
    }

    this.voiceInputText = '';
    this.recordedAudioDataUrl.set(undefined);
  }

  async toggleMicRecording(): Promise<void> {
    if (this.isRecordingMic()) {
      this.mediaRecorder?.stop();
      this.isRecordingMic.set(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            this.recordedAudioDataUrl.set(reader.result);
            this.voiceSourceMode.set('AUDIO_VOICE');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecordingMic.set(true);
    } catch {
      this.isRecordingMic.set(false);
    }
  }
}
