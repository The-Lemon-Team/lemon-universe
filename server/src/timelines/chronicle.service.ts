import crypto from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CHRONICLE_ORIGIN_PROJECTARIUM,
  ChronicleEvent,
  ChronicleNoteRow,
  decodeCursor,
  encodeCursor,
  noteToChronicleEvent,
  tagsFromType,
} from './chronicle.mapper';
import { ProjectariumLinksService } from './projectarium-links.service';
import { linkAllows } from './projectarium-link.token';
import { mergeNoteTags } from './hashtag.utils';

export interface ChronicleFeedQuery {
  boardId?: string;
  since?: string;
  limit?: string | number;
  tags?: string;
}

export interface IngestChronicleEventDto {
  boardId: string;
  externalRef: string;
  description: string;
  type?: 'NOTE' | 'MILESTONE' | 'DEPLOY';
  scope?: 'PROJECT' | 'APP';
  targetAppName?: string;
  author?: string;
  title?: string;
  tags?: string[];
  timestamp?: string;
}

const MAX_LIMIT = 200;

@Injectable()
export class ChronicleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly links: ProjectariumLinksService,
  ) {}

  /**
   * Read feed: flat, cursor-paginated events for the boards granted to the token.
   * Notes ingested from Projectarium are excluded so events never loop back.
   */
  async getFeed(authorization: string | undefined, q: ChronicleFeedQuery) {
    const link = await this.links.authenticate(authorization);
    let boardIds = link.boardIds.filter((b) => linkAllows({ ...link, revokedAt: null }, b, 'chronicle:read'));
    if (q.boardId) {
      if (!boardIds.includes(q.boardId)) {
        throw new ForbiddenException('Токен не даёт доступа к этому TimeLine.');
      }
      boardIds = [q.boardId];
    }
    if (boardIds.length === 0) return { items: [], nextCursor: null };

    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), MAX_LIMIT);
    const params: unknown[] = [boardIds];
    const where = [
      `n.board_id = ANY($1::text[])`,
      `COALESCE(n.origin, '') <> '${CHRONICLE_ORIGIN_PROJECTARIUM}'`,
    ];

    if (q.since) {
      const cur = decodeCursor(q.since);
      if (!cur) throw new BadRequestException('Некорректный since-курсор.');
      params.push(cur.createdAt, cur.id);
      where.push(`(n.created_at, n.id) > ($${params.length - 1}::timestamptz, $${params.length})`);
    }
    const tags = (q.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length) {
      params.push(tags);
      where.push(`n.tags && $${params.length}::text[]`);
    }
    params.push(limit);

    const { rows } = await this.db.query<ChronicleNoteRow>(
      `
        SELECT
          n.id,
          n.board_id AS "boardId",
          to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
          n.title, n.text, n.tags,
          n.actor_name AS "actorName",
          n.origin,
          n.external_ref AS "externalRef"
        FROM timeline_notes n
        WHERE ${where.join(' AND ')}
        ORDER BY n.created_at ASC, n.id ASC
        LIMIT $${params.length}
      `,
      params,
    );

    const items: ChronicleEvent[] = rows.map(noteToChronicleEvent);
    const last = rows[rows.length - 1];
    return {
      items,
      nextCursor: last ? encodeCursor(last.createdAt, last.id) : q.since ?? null,
    };
  }

  /**
   * Write path for Projectarium. Idempotent per (board, externalRef); notes get
   * origin PROJECTARIUM so the read feed will not echo them back.
   */
  async ingest(authorization: string | undefined, dto: IngestChronicleEventDto) {
    if (!dto?.boardId || !dto.externalRef || !dto.description?.trim()) {
      throw new BadRequestException('boardId, externalRef и description обязательны.');
    }
    const link = await this.links.authorizeBoard(authorization, dto.boardId, 'chronicle:write');

    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM timeline_notes WHERE board_id = $1 AND external_ref = $2`,
      [link.boardId, dto.externalRef],
    );
    if (existing.rows[0]) {
      return { id: existing.rows[0].id, created: false };
    }

    const when = dto.timestamp && !Number.isNaN(Date.parse(dto.timestamp)) ? new Date(dto.timestamp) : new Date();
    const iso = when.toISOString();
    const time = iso.slice(11, 16);
    const [hh, mm] = time.split(':').map(Number);
    const id = `note-prj-${crypto.randomUUID()}`;
    const tags = mergeNoteTags(dto.description, [
      'projectarium',
      `stand:${link.standSlug}`,
      ...(dto.scope === 'APP' && dto.targetAppName ? [`app:${dto.targetAppName}`] : []),
      ...tagsFromType(dto.type),
      ...(Array.isArray(dto.tags) ? dto.tags : []),
    ]);

    await this.db.query(
      `
        INSERT INTO timeline_notes (
          id, board_id, date_key, time, time_minutes, type, visibility,
          actor_id, actor_name, actor_avatar, actor_accent, actor_title,
          author_profile_id, author_profile_name,
          title, text, mood_emoji, tags, created_at, origin, external_ref
        )
        SELECT
          $1, b.id, $2, $3, $4, 'thought',
          CASE WHEN b.privacy::text = 'PUBLIC' THEN 'PUBLIC' ELSE 'PRIVATE' END,
          'actor-projectarium', $5, 'projectarium', 'amber', 'Projectarium',
          $6::uuid, $7,
          $8, $9, '📜', $10, $11::timestamptz, $12, $13
        FROM timeline_boards b WHERE b.id = $14
      `,
      [
        id,
        iso.slice(0, 10),
        time,
        (hh || 0) * 60 + (mm || 0),
        dto.author || `Projectarium · ${link.standSlug}`,
        link.createdByProfileId,
        `Projectarium · ${link.standSlug}`,
        dto.title || null,
        dto.description.trim(),
        tags,
        iso,
        CHRONICLE_ORIGIN_PROJECTARIUM,
        dto.externalRef,
        link.boardId,
      ],
    );
    return { id, created: true };
  }
}
