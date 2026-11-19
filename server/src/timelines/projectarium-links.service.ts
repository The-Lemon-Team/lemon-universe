import crypto from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TimelinesService } from './timelines.service';
import { canManageBoardMembers } from './timelines.privacy';
import {
  LinkScope,
  extractBearer,
  generateLinkToken,
  hashLinkToken,
  linkAllows,
  normalizeScopes,
} from './projectarium-link.token';

export interface CreateProjectariumLinkDto {
  standSlug: string;
  boardIds: string[];
  scopes?: LinkScope[];
  label?: string;
  projectariumUrl?: string;
}

export interface UpdateLinkBoardsDto {
  boardIds: string[];
}

export interface AuthenticatedLink {
  id: string;
  standSlug: string;
  scopes: LinkScope[];
  boardIds: string[];
  createdByProfileId: string | null;
}

@Injectable()
export class ProjectariumLinksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly timelines: TimelinesService,
  ) {}

  private async assertCanManageBoards(boardIds: string[], profileId: string): Promise<string[]> {
    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      throw new BadRequestException('Укажите хотя бы один TimeLine (boardIds).');
    }
    const members = await this.timelines.fetchAllMembers();
    const resolved: string[] = [];
    for (const ref of Array.from(new Set(boardIds))) {
      const board = await this.timelines.fetchBoardRow(ref);
      if (!board) throw new NotFoundException(`TimeLine '${ref}' не найден`);
      if (!canManageBoardMembers(board, profileId, members)) {
        throw new ForbiddenException(`Нет прав привязывать TimeLine '${board.title}'.`);
      }
      resolved.push(board.id);
    }
    return resolved;
  }

  private async setBoards(linkId: string, boardIds: string[]) {
    await this.db.query(`DELETE FROM projectarium_link_boards WHERE link_id = $1`, [linkId]);
    for (const boardId of boardIds) {
      await this.db.query(
        `INSERT INTO projectarium_link_boards (link_id, board_id) VALUES ($1, $2)`,
        [linkId, boardId],
      );
    }
  }

  private async loadLink(linkId: string) {
    const { rows } = await this.db.query<any>(
      `
        SELECT
          l.id::text AS id, l.stand_slug AS "standSlug", l.label,
          l.projectarium_url AS "projectariumUrl", l.token_prefix AS "tokenPrefix",
          l.scopes, l.created_by_profile_id::text AS "createdByProfileId",
          l.created_at AS "createdAt", l.rotated_at AS "rotatedAt",
          l.revoked_at AS "revokedAt", l.last_used_at AS "lastUsedAt",
          COALESCE(
            (SELECT array_agg(b.board_id ORDER BY b.board_id)
               FROM projectarium_link_boards b WHERE b.link_id = l.id),
            ARRAY[]::text[]
          ) AS "boardIds"
        FROM projectarium_links l
        WHERE l.id = $1
      `,
      [linkId],
    );
    return rows[0] ?? null;
  }

  /** Link owner = one who may manage every currently linked board. */
  private async loadManageableLink(linkId: string, actorProfileId?: string) {
    const profileId = this.timelines.resolveProfileId(actorProfileId);
    const link = await this.loadLink(linkId);
    if (!link) throw new NotFoundException('Привязка не найдена');
    await this.assertCanManageBoards(link.boardIds, profileId);
    return { link, profileId };
  }

  async create(dto: CreateProjectariumLinkDto, actorProfileId?: string) {
    const standSlug = (dto.standSlug || '').trim();
    if (!standSlug) throw new BadRequestException('standSlug обязателен');
    const profileId = this.timelines.resolveProfileId(actorProfileId);
    const boardIds = await this.assertCanManageBoards(dto.boardIds, profileId);
    const scopes = normalizeScopes(dto.scopes);
    if (scopes.length === 0) throw new BadRequestException('Нужен хотя бы один валидный scope.');

    const { token, tokenHash, tokenPrefix } = generateLinkToken();
    const id = crypto.randomUUID();
    await this.db.query(
      `
        INSERT INTO projectarium_links
          (id, stand_slug, label, projectarium_url, token_hash, token_prefix, scopes, created_by_profile_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [id, standSlug, dto.label ?? null, dto.projectariumUrl ?? null, tokenHash, tokenPrefix, scopes, profileId],
    );
    await this.setBoards(id, boardIds);
    // Plain token is returned exactly once.
    return { ...(await this.loadLink(id)), token };
  }

  async list(actorProfileId?: string, standSlug?: string) {
    const profileId = this.timelines.resolveProfileId(actorProfileId);
    const { rows } = await this.db.query<any>(
      `SELECT id::text AS id FROM projectarium_links
        WHERE ($1::text IS NULL OR stand_slug = $1) ORDER BY created_at DESC`,
      [standSlug ?? null],
    );
    const members = await this.timelines.fetchAllMembers();
    const result: any[] = [];
    for (const { id } of rows) {
      const link = await this.loadLink(id);
      const visible = await Promise.all(
        link.boardIds.map(async (b: string) => {
          const board = await this.timelines.fetchBoardRow(b);
          return board && canManageBoardMembers(board, profileId, members);
        }),
      );
      if (visible.length > 0 && visible.every(Boolean)) result.push(link);
    }
    return result;
  }

  async updateBoards(linkId: string, dto: UpdateLinkBoardsDto, actorProfileId?: string) {
    const { profileId } = await this.loadManageableLink(linkId, actorProfileId);
    const boardIds = await this.assertCanManageBoards(dto.boardIds, profileId);
    await this.setBoards(linkId, boardIds);
    return this.loadLink(linkId);
  }

  async rotate(linkId: string, actorProfileId?: string) {
    await this.loadManageableLink(linkId, actorProfileId);
    const { token, tokenHash, tokenPrefix } = generateLinkToken();
    await this.db.query(
      `UPDATE projectarium_links
          SET token_hash = $2, token_prefix = $3, rotated_at = NOW(), revoked_at = NULL
        WHERE id = $1`,
      [linkId, tokenHash, tokenPrefix],
    );
    return { ...(await this.loadLink(linkId)), token };
  }

  async revoke(linkId: string, actorProfileId?: string) {
    await this.loadManageableLink(linkId, actorProfileId);
    await this.db.query(`UPDATE projectarium_links SET revoked_at = NOW() WHERE id = $1`, [linkId]);
    return this.loadLink(linkId);
  }

  /** Resolves a Bearer token to an active link (lookup by hash; DB unique index). */
  async authenticate(authorization?: string): Promise<AuthenticatedLink> {
    const token = extractBearer(authorization);
    if (!token) throw new UnauthorizedException('Требуется Bearer-токен привязки.');
    const { rows } = await this.db.query<any>(
      `SELECT id::text AS id FROM projectarium_links WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashLinkToken(token)],
    );
    if (!rows[0]) throw new UnauthorizedException('Неверный или отозванный токен.');
    const link = await this.loadLink(rows[0].id);
    await this.db.query(`UPDATE projectarium_links SET last_used_at = NOW() WHERE id = $1`, [link.id]);
    return {
      id: link.id,
      standSlug: link.standSlug,
      scopes: link.scopes,
      boardIds: link.boardIds,
      createdByProfileId: link.createdByProfileId ?? null,
    };
  }

  /** Authenticates and requires scope on a concrete board (id or slug). */
  async authorizeBoard(
    authorization: string | undefined,
    boardRef: string,
    scope: LinkScope,
  ): Promise<AuthenticatedLink & { boardId: string }> {
    const link = await this.authenticate(authorization);
    const board = await this.timelines.fetchBoardRow(boardRef);
    if (!board || !linkAllows(link, board.id, scope)) {
      throw new ForbiddenException('Токен не даёт доступа к этому TimeLine.');
    }
    return { ...link, boardId: board.id };
  }
}
