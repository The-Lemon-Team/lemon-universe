import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';
import { TimelineBoard } from '../../core/models/flow.models';
import { ApiService } from '../../core/services/api.service';

export interface ProjectariumLinkView {
  id: string;
  standSlug: string;
  label?: string | null;
  projectariumUrl?: string | null;
  tokenPrefix: string;
  scopes: string[];
  boardIds: string[];
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-timeline-projectarium-modal',
  standalone: true,
  imports: [FormsModule, ModalOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-projectarium-modal.component.html'
})
export class TimelineProjectariumModalComponent {
  private readonly api = inject(ApiService);

  readonly isOpen = input(false);
  readonly boards = input<TimelineBoard[]>([]);
  readonly activeBoardId = input<string | null>(null);
  readonly actorProfileId = input<string | null>(null);
  readonly closed = output<void>();

  readonly links = signal<ProjectariumLinkView[]>([]);
  readonly selectedBoardIds = signal<string[]>([]);
  readonly issuedToken = signal<string | null>(null);
  readonly copied = signal(false);
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  standSlug = '';
  projectariumUrl = '';
  scopeRead = true;
  scopeWrite = true;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const activeId = this.activeBoardId();
        if (activeId && this.selectedBoardIds().length === 0) {
          this.selectedBoardIds.set([activeId]);
        }
        this.loadLinks();
      }
    });
  }

  onClose(): void {
    this.standSlug = '';
    this.projectariumUrl = '';
    this.scopeRead = true;
    this.scopeWrite = true;
    this.selectedBoardIds.set([]);
    this.issuedToken.set(null);
    this.copied.set(false);
    this.errorMsg.set(null);
    this.closed.emit();
  }

  toggleBoard(boardId: string): void {
    const cur = this.selectedBoardIds();
    this.selectedBoardIds.set(
      cur.includes(boardId) ? cur.filter((id) => id !== boardId) : [...cur, boardId],
    );
  }

  loadLinks(): void {
    this.api.listProjectariumLinks(this.actorProfileId()).subscribe({
      next: (rows) => this.links.set(rows || []),
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось загрузить привязки.'),
    });
  }

  createLink(): void {
    const slug = this.standSlug.trim();
    const boardIds = this.selectedBoardIds();
    const scopes: ('chronicle:read' | 'chronicle:write')[] = [];
    if (this.scopeRead) scopes.push('chronicle:read');
    if (this.scopeWrite) scopes.push('chronicle:write');

    if (!slug || boardIds.length === 0 || scopes.length === 0) {
      this.errorMsg.set('Укажите Stand Slug, хотя бы одну доску и хотя бы одно право.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set(null);
    this.api
      .createProjectariumLink(
        {
          standSlug: slug,
          boardIds,
          scopes,
          projectariumUrl: this.projectariumUrl.trim() || undefined,
        },
        this.actorProfileId(),
      )
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.issuedToken.set(res?.token || null);
          this.copied.set(false);
          this.loadLinks();
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(err?.error?.message || 'Ошибка создания привязки.');
        },
      });
  }

  rotate(linkId: string): void {
    this.api.rotateProjectariumLink(linkId, this.actorProfileId()).subscribe({
      next: (res) => {
        this.issuedToken.set(res?.token || null);
        this.copied.set(false);
        this.loadLinks();
      },
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось ротировать токен.'),
    });
  }

  revoke(linkId: string): void {
    this.api.revokeProjectariumLink(linkId, this.actorProfileId()).subscribe({
      next: () => this.loadLinks(),
      error: (err) => this.errorMsg.set(err?.error?.message || 'Не удалось отозвать токен.'),
    });
  }

  copyToken(token: string): void {
    navigator.clipboard?.writeText(token).then(() => this.copied.set(true));
  }
}
