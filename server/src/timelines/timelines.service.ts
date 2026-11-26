import crypto from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ActorsService } from '../actors/actors.service';
import { DatabaseService } from '../database/database.service';
import { SeasonsBridgeService, TimelineBoardSyncTarget } from '../seasons/seasons-bridge.service';
import {
  BoardMemberPermission,
  BoardMemberRole,
  BoardPrivacy,
  canManageBoardMembers,
  canPostToBoard,
  canViewBoard,
  TimelineBoardMode,
  validateCrossLinkAccess,
} from './timelines.privacy';
import { mergeNoteTags, normalizeTag, syncTagsOnTextEdit } from './hashtag.utils';
import {
  AgentSummaryDto,
  CreateBoardDto,
  CreateCrossLinkDto,
  CreateNoteDto,
  PinNoteDto,
  ShareNoteGroupDto,
  UpdateBoardDto,
  UpdateNoteDto,
  UpsertBoardMemberDto,
} from './timelines.dto';

export {
  AgentSummaryDto,
  CreateBoardDto,
  CreateCrossLinkDto,
  CreateNoteDto,
  PinNoteDto,
  ShareNoteGroupDto,
  UpdateBoardDto,
  UpdateNoteDto,
  UpsertBoardMemberDto,
};

export const DEFAULT_HUMAN_PROFILE_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
export const DEFAULT_AGENT_PROFILE_ID = 'a7e49c10-9100-4b22-a811-9000a6e17001';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_RE = /^\d{2}:\d{2}$/;

/** Returns current dateKey (YYYY-MM-DD) and time (HH:mm) in Europe/Moscow (+03:00). */
export function getMoscowDateAndTime(now: Date = new Date()): { dateKey: string; time: string } {
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { dateKey, time };
}

export interface GetNotesOptions {
  profileId?: string;
  boardId?: string;
  dateKey?: string;
  fromDate?: string;
  toDate?: string;
  actorId?: string;
  search?: string;
  tag?: string;
  limit?: number | string;
  offset?: number | string;
  order?: 'latest' | 'chronological';
  compact?: boolean | string;
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

/** Transliterates Cyrillic to Latin and strips non-ASCII characters for URL-safe slugs. */
function toAsciiSlug(value: string, fallback: string): string {
  const transliterated = value
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');
  return (
    transliterated
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

@Injectable()
export class TimelinesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly seasonsBridge: SeasonsBridgeService,
    @Optional() private readonly actorsService?: ActorsService,
  ) {}

  resolveProfileId(headerProfileId?: string, queryProfileId?: string): string {
    const raw = (headerProfileId || queryProfileId || '').trim();
    return raw || DEFAULT_HUMAN_PROFILE_ID;
  }

  private async resolveActorMetadata(
    actorId: string,
    explicit: {
      actorName?: string;
      actorAvatar?: string;
      actorAccent?: string;
      actorTitle?: string;
    },
  ): Promise<{
    actorId: string;
    actorName: string;
    actorAvatar: string;
    actorAccent: string;
    actorTitle: string;
  }> {
    let canonical: any = null;
    if (this.actorsService && actorId) {
      try {
        canonical = await this.actorsService.findOne(actorId);
      } catch {
        canonical = null;
      }
    }
    return {
      actorId: canonical?.id || actorId || 'actor-antigravity-agent',
      actorName: explicit.actorName?.trim() || canonical?.name || 'Antigravity Agent',
      actorAvatar: explicit.actorAvatar?.trim() || canonical?.avatarIcon || 'antigravity-agent',
      actorAccent: explicit.actorAccent?.trim() || canonical?.accentColor || 'violet',
      actorTitle: explicit.actorTitle?.trim() ?? canonical?.title ?? '',
    };
  }

  async fetchAllMembers(): Promise<BoardMemberPermission[]> {
    const { rows } = await this.db.query<any>(`
      SELECT
        m.id,
        m.board_id AS "boardId",
        m.profile_id::text AS "profileId",
        m.role::text AS role,
        m.can_post AS "canPost",
        m.can_cross_link AS "canCrossLink",
        m.added_by_profile_id::text AS "addedByProfileId",
        m.created_at AS "createdAt",
        p.handle AS "profileHandle",
        p.display_name AS "profileDisplayName",
        p.avatar_icon AS "profileAvatarIcon",
        p.player_type::text AS "profilePlayerType"
      FROM timeline_board_members m
      JOIN profiles p ON p.id = m.profile_id
      ORDER BY m.created_at ASC
    `);
    return rows;
  }

  async fetchBoardRow(boardId: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `
        SELECT
          b.id,
          b.slug,
          b.title,
          b.description,
          COALESCE(b.hashtags, '{}'::text[]) AS hashtags,
          b.icon,
          b.color_theme AS "colorTheme",
          b.vibe_id AS "vibeId",
          b.board_kind AS "boardKind",
          b.board_mode::text AS "boardMode",
          b.privacy::text AS privacy,
          b.owner_profile_id::text AS "ownerProfileId",
          b.default_actor_id AS "defaultActorId",
          b.is_archived AS "isArchived",
          b.flow_id::text AS "flowId",
          COALESCE(f.type::text, 'CONTEXT') AS "flowType",
          COALESCE(f.status::text, 'ACTIVE') AS "flowStatus",
          b.seasons_stream_slug AS "seasonsStreamSlug",
          b.seasons_feed_slug AS "seasonsFeedSlug",
          b.is_default AS "isDefault",
          b.created_at AS "createdAt",
          b.updated_at AS "updatedAt",
          (SELECT count(*)::int FROM timeline_notes n WHERE n.board_id = b.id) AS "notesCount"
        FROM timeline_boards b
        LEFT JOIN flows f ON f.id = b.flow_id
        WHERE b.id = $1 OR b.slug = $1
        LIMIT 1
      `,
      [boardId],
    );
    return rows[0] ?? null;
  }

  async getBoards(profileId?: string, includeArchived = false) {
    const activeProfileId = this.resolveProfileId(profileId);
    const [{ rows }, allMembers] = await Promise.all([
      this.db.query(`
        SELECT
          b.id,
          b.slug,
          b.title,
          b.description,
          COALESCE(b.hashtags, '{}'::text[]) AS hashtags,
          b.icon,
          b.color_theme AS "colorTheme",
          b.vibe_id AS "vibeId",
          b.board_kind AS "boardKind",
          b.board_mode::text AS "boardMode",
          b.privacy::text AS privacy,
          b.owner_profile_id::text AS "ownerProfileId",
          b.default_actor_id AS "defaultActorId",
          b.is_archived AS "isArchived",
          b.flow_id::text AS "flowId",
          COALESCE(f.type::text, 'CONTEXT') AS "flowType",
          COALESCE(f.status::text, 'ACTIVE') AS "flowStatus",
          b.seasons_stream_slug AS "seasonsStreamSlug",
          b.seasons_feed_slug AS "seasonsFeedSlug",
          b.is_default AS "isDefault",
          b.created_at AS "createdAt",
          b.updated_at AS "updatedAt",
          (SELECT count(*)::int FROM timeline_notes n WHERE n.board_id = b.id) AS "notesCount"
        FROM timeline_boards b
        LEFT JOIN flows f ON f.id = b.flow_id
        ${includeArchived ? '' : 'WHERE b.is_archived = FALSE'}
        ORDER BY b.created_at ASC
      `),
      this.fetchAllMembers(),
    ]);

    return rows
      .filter((board) => canViewBoard(board, activeProfileId, allMembers))
      .map((board) => ({
        ...board,
        members: allMembers.filter((m) => m.boardId === board.id),
      }));
  }

  async createBoard(dto: CreateBoardDto, actorProfileId?: string) {
    const ownerProfileId = dto.ownerProfileId || this.resolveProfileId(actorProfileId);
    const id = dto.id || `board-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const slugBase = toAsciiSlug(dto.slug || dto.title || id, id);
    const slug = dto.slug || `${slugBase}-${Math.random().toString(36).slice(2, 5)}`;
    const title = (dto.title || 'Новый TimeLine').trim();
    const description = dto.description?.trim() || '';
    const hashtags = mergeNoteTags(description, dto.hashtags);
    const icon = dto.icon || (dto.boardMode === 'DIARY' ? 'menu_book' : 'view_timeline');
    const colorTheme = dto.colorTheme || (dto.boardMode === 'DIARY' ? 'emerald' : 'amber');
    const vibeId = dto.vibeId || 'CHRONO_DAYFLOW';
    const boardKind = dto.boardKind || 'CUSTOM_PROJECT';
    const boardMode: TimelineBoardMode = dto.boardMode || 'TIMELINE';
    const privacy: BoardPrivacy = dto.privacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
    const flowType = dto.flowType || 'CONTEXT';
    const seasonsStreamSlug = dto.seasonsStreamSlug || 'lemon-universe';
    const seasonsFeedSlug = dto.seasonsFeedSlug?.trim() || `universe-${slug}`;

    const flowId = crypto.randomUUID();
    await this.db.query(
      `
        INSERT INTO flows (id, name, description, type, status, is_exclusive, folder_id, profile_id, config, orchestrator_rules)
        VALUES ($1::uuid, $2, $3, $4::"FlowType", 'ACTIVE', $5, 'f0000001-0000-4000-8000-000000000002', $6::uuid, $7::jsonb, '{}'::jsonb)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        flowId,
        `Поток: ${title}`,
        description || `Поток Core Combinator для TimeLine ${title}`,
        flowType,
        flowType === 'MUTEX',
        ownerProfileId,
        JSON.stringify({ boardId: id, privacy, boardMode, seasonsStream: seasonsStreamSlug, seasonsFeed: seasonsFeedSlug }),
      ],
    );

    const sessionId = crypto.randomUUID();
    await this.db.query(`INSERT INTO flow_sessions (id, flow_id) VALUES ($1::uuid, $2::uuid)`, [
      sessionId,
      flowId,
    ]);

    await this.db.query(
      `
        INSERT INTO timeline_boards (
          id, slug, title, description, hashtags, icon, color_theme, vibe_id, board_kind, board_mode,
          privacy, owner_profile_id, default_actor_id, flow_id, seasons_stream_slug, seasons_feed_slug, is_default
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::"TimelineBoardKind", $10::"TimelineBoardMode",
          $11::"BoardPrivacy", $12::uuid, $13, $14::uuid, $15, $16, FALSE
        )
      `,
      [
        id,
        slug,
        title,
        description,
        hashtags,
        icon,
        colorTheme,
        vibeId,
        boardKind,
        boardMode,
        privacy,
        ownerProfileId,
        dto.defaultActorId || null,
        flowId,
        seasonsStreamSlug,
        seasonsFeedSlug,
      ],
    );

    // Owner membership
    await this.db.query(
      `
        INSERT INTO timeline_board_members (id, board_id, profile_id, role, can_post, can_cross_link, added_by_profile_id)
        VALUES ($1::uuid, $2, $3::uuid, 'OWNER', TRUE, TRUE, $3::uuid)
        ON CONFLICT (board_id, profile_id) DO NOTHING
      `,
      [crypto.randomUUID(), id, ownerProfileId],
    );

    if (Array.isArray(dto.memberProfileIds)) {
      for (const memberId of dto.memberProfileIds) {
        if (!memberId || memberId === ownerProfileId) continue;
        await this.db.query(
          `
            INSERT INTO timeline_board_members (id, board_id, profile_id, role, can_post, can_cross_link, added_by_profile_id)
            VALUES ($1::uuid, $2, $3::uuid, 'MEMBER', TRUE, TRUE, $4::uuid)
            ON CONFLICT (board_id, profile_id) DO NOTHING
          `,
          [crypto.randomUUID(), id, memberId, ownerProfileId],
        );
      }
    }

    const syncTarget: TimelineBoardSyncTarget = {
      id,
      slug,
      title,
      description,
      hashtags,
      icon,
      privacy,
      boardKind,
      boardMode,
      seasonsStreamSlug,
      seasonsFeedSlug,
    };
    void this.seasonsBridge.ensureBoardTopology(syncTarget);

    const created = await this.fetchBoardRow(id);
    const members = (await this.fetchAllMembers()).filter((m) => m.boardId === id);
    return { ...created, activeSessionId: sessionId, members };
  }

  async updateBoard(boardId: string, dto: UpdateBoardDto, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);

    const members = await this.fetchAllMembers();
    if (!canManageBoardMembers(board, profileId, members)) {
      throw new ForbiddenException('Только владелец или редактор борда может менять его настройки и приватность.');
    }

    const nextDescription = dto.description !== undefined ? dto.description : board.description;
    const nextHashtags =
      dto.hashtags !== undefined
        ? mergeNoteTags(nextDescription || '', dto.hashtags)
        : dto.description !== undefined
          ? syncTagsOnTextEdit(board.description || '', dto.description || '', board.hashtags || [])
          : null;

    await this.db.query(
      `
        UPDATE timeline_boards
        SET
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          icon = COALESCE($4, icon),
          color_theme = COALESCE($5, color_theme),
          vibe_id = COALESCE($6, vibe_id),
          board_mode = COALESCE($7::"TimelineBoardMode", board_mode),
          privacy = COALESCE($8::"BoardPrivacy", privacy),
          default_actor_id = CASE WHEN $9::boolean THEN $10 ELSE default_actor_id END,
          is_archived = COALESCE($11, is_archived),
          seasons_feed_slug = COALESCE($12, seasons_feed_slug),
          hashtags = COALESCE($13, hashtags),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        board.id,
        dto.title?.trim() || null,
        dto.description !== undefined ? dto.description : null,
        dto.icon || null,
        dto.colorTheme || null,
        dto.vibeId || null,
        dto.boardMode || null,
        dto.privacy || null,
        dto.defaultActorId !== undefined,
        dto.defaultActorId ?? null,
        dto.isArchived !== undefined ? dto.isArchived : null,
        dto.seasonsFeedSlug?.trim() || null,
        nextHashtags,
      ],
    );

    const updated = await this.fetchBoardRow(board.id);
    if (updated) {
      void this.seasonsBridge.ensureBoardTopology(updated);
    }
    return {
      ...updated,
      members: members.filter((m) => m.boardId === board.id),
    };
  }

  async deleteBoard(boardId: string, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);
    if (board.isDefault) {
      throw new BadRequestException('Основной борд по умолчанию нельзя удалить.');
    }
    const members = await this.fetchAllMembers();
    if (!canManageBoardMembers(board, profileId, members)) {
      throw new ForbiddenException('Нет прав на удаление этого борда.');
    }
    await this.db.query(`DELETE FROM timeline_boards WHERE id = $1`, [board.id]);
    return { deleted: true, id: board.id };
  }

  async getBoardMembers(boardId: string, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);
    const members = await this.fetchAllMembers();
    if (!canViewBoard(board, profileId, members)) {
      throw new ForbiddenException('Нет доступа к приватному борду.');
    }
    return members.filter((m) => m.boardId === board.id);
  }

  async addOrUpdateBoardMember(
    boardId: string,
    dto: UpsertBoardMemberDto,
    actorProfileId?: string,
  ) {
    const callerId = this.resolveProfileId(actorProfileId);
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);
    const members = await this.fetchAllMembers();
    if (!canManageBoardMembers(board, callerId, members)) {
      throw new ForbiddenException('Только владелец или редактор борда может добавлять участников (members).');
    }
    if (!dto.profileId) {
      throw new BadRequestException('profileId обязателен для добавления участника.');
    }

    const role: BoardMemberRole = dto.role || 'MEMBER';
    const canPost = role === 'VIEWER' ? false : dto.canPost ?? true;
    const canCrossLink = role === 'VIEWER' ? false : dto.canCrossLink ?? true;

    await this.db.query(
      `
        INSERT INTO timeline_board_members (
          id, board_id, profile_id, role, can_post, can_cross_link, added_by_profile_id
        ) VALUES ($1::uuid, $2, $3::uuid, $4::"BoardMemberRole", $5, $6, $7::uuid)
        ON CONFLICT (board_id, profile_id) DO UPDATE SET
          role = EXCLUDED.role,
          can_post = EXCLUDED.can_post,
          can_cross_link = EXCLUDED.can_cross_link
      `,
      [crypto.randomUUID(), board.id, dto.profileId, role, canPost, canCrossLink, callerId],
    );

    const feedSlug = board.seasonsFeedSlug || `universe-${board.slug}`;
    await this.seasonsBridge.shareSeasonsFeedToMember({
      feedSlug,
      ownerProfileId: board.ownerProfileId,
      granteeProfileId: dto.profileId,
      permission: canPost ? 'WRITE' : 'READ',
    });

    await this.syncExistingGroupSharesForMember(board.id, dto.profileId, true);

    return (await this.fetchAllMembers()).filter((m) => m.boardId === board.id);
  }

  async removeBoardMember(boardId: string, targetProfileId: string, actorProfileId?: string) {
    const callerId = this.resolveProfileId(actorProfileId);
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);
    const members = await this.fetchAllMembers();
    if (!canManageBoardMembers(board, callerId, members)) {
      throw new ForbiddenException('Нет прав на управление участниками борда.');
    }
    if (board.ownerProfileId === targetProfileId) {
      throw new BadRequestException('Нельзя удалить владельца борда из участников.');
    }
    await this.db.query(
      `DELETE FROM timeline_board_members WHERE board_id = $1 AND profile_id = $2::uuid`,
      [board.id, targetProfileId],
    );

    const feedSlug = board.seasonsFeedSlug || `universe-${board.slug}`;
    await this.seasonsBridge.revokeSeasonsFeedShare({
      feedSlug,
      ownerProfileId: board.ownerProfileId,
      granteeProfileId: targetProfileId,
    });
    await this.syncExistingGroupSharesForMember(board.id, targetProfileId, false);

    return (await this.fetchAllMembers()).filter((m) => m.boardId === board.id);
  }

  private async syncExistingGroupSharesForMember(
    boardId: string,
    memberProfileId: string,
    grant: boolean,
  ): Promise<void> {
    const { rows } = await this.db.query<{
      seasonsNoteId: string;
      authorProfileId: string | null;
    }>(
      `
        SELECT
          seasons_note_id AS "seasonsNoteId",
          author_profile_id::text AS "authorProfileId"
        FROM timeline_notes
        WHERE board_id = $1
          AND shared_with_group = TRUE
          AND seasons_note_id IS NOT NULL
      `,
      [boardId],
    );

    for (const row of rows) {
      if (!row.seasonsNoteId) continue;
      if (grant) {
        await this.seasonsBridge.shareSeasonsNoteToGroup({
          seasonsNoteId: row.seasonsNoteId,
          ownerProfileId: row.authorProfileId,
          granteeProfileIds: [memberProfileId],
          boardId,
        });
      } else {
        await this.seasonsBridge.revokeSeasonsNoteShare({
          seasonsNoteId: row.seasonsNoteId,
          ownerProfileId: row.authorProfileId,
          granteeProfileId: memberProfileId,
          boardId,
        });
      }
    }
  }

  private async resolveBoardForRead(
    boardIdOrSlug: string,
    profileId: string,
    includeArchived = true,
  ) {
    const cleanRef = (boardIdOrSlug || '').trim();
    if (!cleanRef) {
      throw new BadRequestException('Идентификатор или slug доски обязателен.');
    }
    const visibleBoards = await this.getBoards(profileId, includeArchived);
    const visibleMatch = visibleBoards.find((b) => b.id === cleanRef || b.slug === cleanRef);
    if (visibleMatch) {
      return { board: visibleMatch, visibleBoards };
    }
    const rawBoard = await this.fetchBoardRow(cleanRef);
    if (!rawBoard) {
      throw new NotFoundException(`TimeLine board '${cleanRef}' not found`);
    }
    throw new ForbiddenException('Нет доступа к заметкам этого приватного TimeLine.');
  }

  async getBoard(boardIdOrSlug: string, profileId?: string) {
    const activeProfileId = this.resolveProfileId(profileId);
    const { board } = await this.resolveBoardForRead(boardIdOrSlug, activeProfileId, true);
    return board;
  }

  async getActorStats(opts: { profileId?: string; boardId?: string } = {}) {
    const profileId = this.resolveProfileId(opts.profileId);
    let scopedBoardIds: string[] = [];
    let resolvedBoardId: string | null = null;

    if (opts.boardId?.trim()) {
      const { board } = await this.resolveBoardForRead(opts.boardId, profileId, true);
      resolvedBoardId = board.id;
      scopedBoardIds = [board.id];
    } else {
      const visibleBoards = await this.getBoards(profileId, true);
      scopedBoardIds = visibleBoards.map((b) => b.id);
    }

    if (scopedBoardIds.length === 0) {
      return { boardId: resolvedBoardId, totalNotes: 0, actors: [] };
    }

    const { rows } = await this.db.query<any>(
      `
        SELECT
          n.actor_id AS "actorId",
          MAX(n.actor_name) AS "actorName",
          COUNT(*)::int AS "notesCount",
          MAX(n.date_key) AS "lastDateKey"
        FROM timeline_notes n
        WHERE n.board_id = ANY($1::text[])
        GROUP BY n.actor_id
        ORDER BY COUNT(*) DESC, n.actor_id ASC
      `,
      [scopedBoardIds],
    );

    const totalNotes = rows.reduce((sum: number, row: any) => sum + Number(row.notesCount || 0), 0);
    return {
      boardId: resolvedBoardId,
      totalNotes,
      actors: rows.map((row: any) => ({
        actorId: row.actorId,
        actorName: row.actorName,
        notesCount: Number(row.notesCount || 0),
        lastDateKey: row.lastDateKey ?? null,
      })),
    };
  }

  async getNotes(opts: GetNotesOptions) {
    const profileId = this.resolveProfileId(opts.profileId);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (opts.boardId?.trim()) {
      const { board } = await this.resolveBoardForRead(opts.boardId, profileId, true);
      params.push(board.id);
      conditions.push(`n.board_id = $${params.length}`);
    } else {
      const visibleBoards = await this.getBoards(profileId, true);
      if (visibleBoards.length === 0) return [];
      params.push(visibleBoards.map((b) => b.id));
      conditions.push(`n.board_id = ANY($${params.length}::text[])`);
    }

    if (opts.dateKey?.trim()) {
      const dateKey = opts.dateKey.trim();
      if (!DATE_KEY_RE.test(dateKey)) {
        throw new BadRequestException('Некорректный формат dateKey (ожидается YYYY-MM-DD).');
      }
      params.push(dateKey);
      conditions.push(`n.date_key = $${params.length}`);
    }

    if (opts.fromDate?.trim()) {
      const fromDate = opts.fromDate.trim();
      if (!DATE_KEY_RE.test(fromDate)) {
        throw new BadRequestException('Некорректный формат fromDate (ожидается YYYY-MM-DD).');
      }
      params.push(fromDate);
      conditions.push(`n.date_key >= $${params.length}`);
    }

    if (opts.toDate?.trim()) {
      const toDate = opts.toDate.trim();
      if (!DATE_KEY_RE.test(toDate)) {
        throw new BadRequestException('Некорректный формат toDate (ожидается YYYY-MM-DD).');
      }
      params.push(toDate);
      conditions.push(`n.date_key <= $${params.length}`);
    }

    if (opts.actorId?.trim()) {
      params.push(opts.actorId.trim());
      conditions.push(`(n.actor_id = $${params.length} OR n.sub_actor_id = $${params.length})`);
    }

    if (opts.tag?.trim()) {
      const normalizedTag = normalizeTag(opts.tag);
      if (normalizedTag) {
        params.push(normalizedTag);
        conditions.push(
          `EXISTS (SELECT 1 FROM unnest(n.tags) AS t WHERE LOWER(t) = $${params.length})`,
        );
      }
    }

    if (opts.search?.trim()) {
      const q = opts.search.trim();
      const tagNeedle = normalizeTag(q);
      params.push(`%${q}%`);
      const textParam = `$${params.length}`;
      if (tagNeedle) {
        params.push(`%${tagNeedle}%`);
        const tagParam = `$${params.length}`;
        conditions.push(
          `(n.text ILIKE ${textParam} OR COALESCE(n.title, '') ILIKE ${textParam} OR EXISTS (SELECT 1 FROM unnest(n.tags) AS t WHERE t ILIKE ${tagParam}))`,
        );
      } else {
        conditions.push(
          `(n.text ILIKE ${textParam} OR COALESCE(n.title, '') ILIKE ${textParam})`,
        );
      }
    }

    const orderClause =
      opts.order === 'latest'
        ? 'ORDER BY n.date_key DESC, n.time_minutes DESC, n.created_at DESC'
        : 'ORDER BY n.date_key DESC, n.time_minutes ASC';

    const tailParts: string[] = [orderClause];
    if (opts.limit !== undefined && opts.limit !== null && String(opts.limit).trim() !== '') {
      const parsedLimit = Number(opts.limit);
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        throw new BadRequestException('Параметр limit должен быть положительным числом.');
      }
      const clampedLimit = Math.min(Math.floor(parsedLimit), 200);
      params.push(clampedLimit);
      tailParts.push(`LIMIT $${params.length}`);
    }

    if (opts.offset !== undefined && opts.offset !== null && String(opts.offset).trim() !== '') {
      const parsedOffset = Number(opts.offset);
      if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
        throw new BadRequestException('Параметр offset должен быть неотрицательным числом.');
      }
      params.push(Math.floor(parsedOffset));
      tailParts.push(`OFFSET $${params.length}`);
    }

    const isCompact = opts.compact === true || opts.compact === 'true';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = isCompact
      ? this.buildCompactNoteSelectSql(whereClause, tailParts.join(' '))
      : this.buildNoteSelectSql(whereClause, tailParts.join(' '));
    const { rows } = await this.db.query(sql, params);

    return isCompact ? rows.map((row) => this.stripCompactNoteRow(row)) : rows;
  }

  private stripCompactNoteRow(row: any): Record<string, any> {
    const compact: Record<string, any> = {
      id: row.id,
      boardId: row.boardId,
      dateKey: row.dateKey,
      time: row.time,
      type: row.type,
      actorId: row.actorId,
      actorName: row.actorName,
      text: row.text,
    };
    if (row.subActorId) compact.subActorId = row.subActorId;
    if (row.title) compact.title = row.title;
    if (Array.isArray(row.tags) && row.tags.length > 0) compact.tags = row.tags;
    if (row.isPinned) compact.isPinned = true;
    if (row.replyToNoteId) compact.replyToNoteId = row.replyToNoteId;
    if (Array.isArray(row.crossRefs) && row.crossRefs.length > 0) {
      compact.crossRefs = row.crossRefs.map((ref: any) => ({
        targetBoardId: ref.targetBoardId,
        targetNoteId: ref.targetNoteId,
        ...(ref.relationLabel ? { relationLabel: ref.relationLabel } : {}),
      }));
    }
    return compact;
  }

  private buildCompactNoteSelectSql(whereClause: string, tailClause = ''): string {
    return `
      SELECT
        n.id,
        n.board_id AS "boardId",
        n.date_key AS "dateKey",
        n.time,
        n.type,
        n.actor_id AS "actorId",
        n.actor_name AS "actorName",
        n.sub_actor_id AS "subActorId",
        n.title,
        n.text,
        n.tags,
        n.is_pinned AS "isPinned",
        n.reply_to_note_id AS "replyToNoteId",
        COALESCE(
          (SELECT json_agg(cl.preview_cache) FROM timeline_cross_links cl WHERE cl.source_note_id = n.id),
          '[]'::json
        ) AS "crossRefs"
      FROM timeline_notes n
      ${whereClause}
      ${tailClause}
    `;
  }

  async getNoteById(noteId: string, actorProfileId?: string) {
    const cleanId = (noteId || '').trim();
    if (!cleanId) {
      throw new BadRequestException('Идентификатор сообщения (noteId) обязателен.');
    }
    const profileId = this.resolveProfileId(actorProfileId);
    const { rows } = await this.db.query(this.buildNoteSelectSql('WHERE n.id = $1', 'LIMIT 1'), [
      cleanId,
    ]);
    const note = rows[0];
    if (!note) {
      throw new NotFoundException(`Сообщение '${cleanId}' не найдено.`);
    }

    const board = await this.fetchBoardRow(note.boardId);
    if (!board) {
      throw new NotFoundException(`TimeLine board '${note.boardId}' not found`);
    }
    const members = await this.fetchAllMembers();
    if (!canViewBoard(board, profileId, members)) {
      throw new ForbiddenException('Нет доступа к сообщению приватного TimeLine.');
    }

    return {
      ...note,
      boardSlug: board.slug,
    };
  }

  private buildNoteSelectSql(whereClause: string, tailClause = ''): string {
    return `
      SELECT
        n.id,
        n.board_id AS "boardId",
        n.date_key AS "dateKey",
        n.time,
        n.time_minutes AS "timeMinutes",
        n.type,
        n.visibility,
        n.actor_id AS "actorId",
        n.actor_name AS "actorName",
        n.actor_avatar AS "actorAvatar",
        n.actor_accent AS "actorAccent",
        n.actor_title AS "actorTitle",
        n.sub_actor_id AS "subActorId",
        n.sub_actor_name AS "subActorName",
        n.sub_actor_avatar AS "subActorAvatar",
        n.sub_actor_accent AS "subActorAccent",
        n.author_profile_id::text AS "authorProfileId",
        n.author_profile_name AS "authorProfileName",
        n.title,
        n.text,
        n.mood_emoji AS "moodEmoji",
        n.tags,
        n.media_attachments AS "mediaAttachments",
        n.party_actor_ids AS "partyActorIds",
        n.supporters,
        n.votes_count AS "votesCount",
        n.liked_by_actors AS "likedByActors",
        n.reply_to_note_id AS "replyToNoteId",
        n.reply_to_author_name AS "replyToAuthorName",
        n.reply_to_text_snippet AS "replyToTextSnippet",
        n.is_pinned_to_hero AS "isPinnedToHero",
        n.is_pinned_to_cloud AS "isPinnedToCloud",
        n.is_pinned AS "isPinned",
        n.pinned_at AS "pinnedAt",
        n.seasons_note_id AS "seasonsNoteId",
        n.seasons_external_id AS "seasonsExternalId",
        n.seasons_account_id AS "seasonsAccountId",
        n.seasons_synced_at AS "seasonsSyncedAt",
        n.shared_with_group AS "sharedWithGroup",
        n.active_flow_session_ids AS "activeFlowSessionIds",
        n.weather AS weather,
        n.world_moment AS "worldMoment",
        n.created_at AS "createdAt",
        COALESCE(
          (SELECT json_agg(cl.preview_cache) FROM timeline_cross_links cl WHERE cl.source_note_id = n.id),
          '[]'::json
        ) AS "crossRefs"
      FROM timeline_notes n
      ${whereClause}
      ${tailClause}
    `;
  }

  async createNote(note: any, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId, note.authorProfileId);
    const boardId = note.boardId || 'board-global-day';
    const board = await this.fetchBoardRow(boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${boardId}' not found`);

    const allMembers = await this.fetchAllMembers();
    if (!canPostToBoard(board, profileId, allMembers)) {
      throw new ForbiddenException('У текущего пользователя или агента нет прав на запись в этот приватный TimeLine.');
    }

    const id = note.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowMsk = getMoscowDateAndTime();
    const dateKey = note.dateKey?.trim() || nowMsk.dateKey;
    if (!DATE_KEY_RE.test(dateKey)) {
      throw new BadRequestException('Некорректный формат dateKey (ожидается YYYY-MM-DD).');
    }
    const time = note.time?.trim() || nowMsk.time;
    if (!TIME_HM_RE.test(time)) {
      throw new BadRequestException('Некорректный формат time (ожидается HH:mm).');
    }
    const [hh, mm] = String(time).split(':').map(Number);
    const timeMinutes = Number(note.timeMinutes ?? ((hh || 0) * 60 + (mm || 0)));

    const resolvedActor = await this.resolveActorMetadata(
      note.actorId || board.defaultActorId || 'actor-antigravity-agent',
      {
        actorName: note.actorName,
        actorAvatar: note.actorAvatar,
        actorAccent: note.actorAccent,
        actorTitle: note.actorTitle,
      },
    );
    const resolvedSubActor = note.subActorId
      ? await this.resolveActorMetadata(note.subActorId, {
          actorName: note.subActorName,
          actorAvatar: note.subActorAvatar,
          actorAccent: note.subActorAccent,
        })
      : null;

    // Resolve profile display name from DB if not provided
    let resolvedProfileName = note.authorProfileName;
    if (!resolvedProfileName) {
      const prof = await this.db.query<{ displayName: string }>(
        `SELECT display_name AS "displayName" FROM profiles WHERE id = $1::uuid`,
        [profileId],
      );
      resolvedProfileName = prof.rows[0]?.displayName || 'Пользователь';
    }

    const mediaAttachments = Array.isArray(note.mediaAttachments) ? note.mediaAttachments : [];
    const noteVisibility = board.privacy === 'PUBLIC' ? note.visibility || 'PUBLIC' : 'PRIVATE';
    const sharedWithGroup = Boolean(note.sharedWithGroup);
    const mergedTags = mergeNoteTags(note.text || '', note.tags);

    await this.db.query(
      `
        INSERT INTO timeline_notes (
          id, board_id, date_key, time, time_minutes, type, visibility,
          actor_id, actor_name, actor_avatar, actor_accent, actor_title,
          sub_actor_id, sub_actor_name, sub_actor_avatar, sub_actor_accent,
          author_profile_id, author_profile_name,
          title, text, mood_emoji, tags, media_attachments, party_actor_ids, supporters,
          votes_count, liked_by_actors, reply_to_note_id, reply_to_author_name, reply_to_text_snippet,
          active_flow_session_ids, shared_with_group, weather, world_moment
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17::uuid, $18,
          $19, $20, $21, $22, $23::jsonb, $24, $25,
          $26, $27::jsonb, $28, $29, $30,
          $31, $32, $33::jsonb, $34::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          text = EXCLUDED.text,
          media_attachments = EXCLUDED.media_attachments,
          tags = EXCLUDED.tags,
          votes_count = EXCLUDED.votes_count,
          liked_by_actors = EXCLUDED.liked_by_actors,
          shared_with_group = EXCLUDED.shared_with_group,
          weather = EXCLUDED.weather,
          world_moment = EXCLUDED.world_moment
      `,
      [
        id,
        board.id,
        dateKey,
        time,
        timeMinutes,
        note.type || 'thought',
        noteVisibility,
        resolvedActor.actorId,
        resolvedActor.actorName,
        resolvedActor.actorAvatar,
        resolvedActor.actorAccent,
        resolvedActor.actorTitle,
        resolvedSubActor?.actorId ?? null,
        resolvedSubActor?.actorName ?? null,
        resolvedSubActor?.actorAvatar ?? null,
        resolvedSubActor?.actorAccent ?? null,
        profileId,
        resolvedProfileName,
        note.title || null,
        note.text || '',
        note.moodEmoji || '💭',
        mergedTags,
        JSON.stringify(mediaAttachments),
        Array.isArray(note.partyActorIds) ? note.partyActorIds : [],
        Array.isArray(note.supporters) ? note.supporters : [],
        Number(note.votesCount ?? 1),
        JSON.stringify(note.likedByActors || []),
        note.replyToNoteId || null,
        note.replyToAuthorName || null,
        note.replyToTextSnippet || null,
        Array.isArray(note.activeFlowSessionIds) ? note.activeFlowSessionIds : [],
        sharedWithGroup,
        note.weather ? JSON.stringify(note.weather) : null,
        note.worldMoment ? JSON.stringify(note.worldMoment) : null,
      ],
    );

    if (Array.isArray(note.crossRefs)) {
      for (const ref of note.crossRefs) {
        if (!ref?.targetBoardId || !ref?.targetNoteId) continue;
        await this.createCrossLink(
          {
            sourceBoardId: board.id,
            sourceNoteId: id,
            targetBoardId: ref.targetBoardId,
            targetNoteId: ref.targetNoteId,
            relationLabel: ref.relationLabel,
            previewCache: ref,
          },
          profileId,
        );
      }
    }

    const syncRes = await this.seasonsBridge.syncTimelineNote(
      {
        id,
        boardId: board.id,
        dateKey,
        time,
        type: note.type || 'thought',
        actorId: resolvedActor.actorId,
        actorName: resolvedActor.actorName,
        actorAvatar: resolvedActor.actorAvatar,
        subActorId: resolvedSubActor?.actorId ?? note.subActorId,
        authorProfileId: profileId,
        authorProfileName: resolvedProfileName,
        title: note.title,
        text: note.text || '',
        moodEmoji: note.moodEmoji,
        tags: mergedTags,
        mediaAttachments,
        crossRefs: note.crossRefs,
        replyToNoteId: note.replyToNoteId,
        activeFlowSessionIds: note.activeFlowSessionIds,
      },
      board,
    );

    if (syncRes.synced && syncRes.noteId && sharedWithGroup) {
      const boardMembers = allMembers.filter((m) => m.boardId === board.id).map((m) => m.profileId);
      const granteeIds = Array.from(new Set([board.ownerProfileId, ...boardMembers])).filter(
        (pid): pid is string => Boolean(pid && pid !== profileId),
      );
      if (granteeIds.length > 0) {
        await this.seasonsBridge.shareSeasonsNoteToGroup({
          seasonsNoteId: syncRes.noteId,
          ownerProfileId: profileId,
          granteeProfileIds: granteeIds,
          boardId: board.id,
        });
      }
    }

    return {
      ...note,
      id,
      boardId: board.id,
      dateKey,
      time,
      timeMinutes,
      visibility: noteVisibility,
      actorId: resolvedActor.actorId,
      actorName: resolvedActor.actorName,
      actorAvatar: resolvedActor.actorAvatar,
      actorAccent: resolvedActor.actorAccent,
      actorTitle: resolvedActor.actorTitle,
      subActorId: resolvedSubActor?.actorId ?? note.subActorId ?? null,
      subActorName: resolvedSubActor?.actorName ?? note.subActorName ?? null,
      subActorAvatar: resolvedSubActor?.actorAvatar ?? note.subActorAvatar ?? null,
      subActorAccent: resolvedSubActor?.actorAccent ?? note.subActorAccent ?? null,
      authorProfileId: profileId,
      authorProfileName: resolvedProfileName,
      tags: mergedTags,
      mediaAttachments,
      sharedWithGroup,
      seasonsNoteId: syncRes.noteId,
      seasonsExternalId: syncRes.externalId,
      seasonsAccountId: syncRes.seasonsAccountId,
      seasonsSyncedAt: syncRes.synced ? new Date().toISOString() : undefined,
      seasonsSynced: syncRes.synced,
      seasonsSyncError: syncRes.error,
    };
  }

  private async fetchMutableNoteContext(
    noteId: string,
    actorProfileId?: string,
    forbiddenMessage = 'Нет прав на изменение чужой записи.',
  ) {
    const profileId = this.resolveProfileId(actorProfileId);
    const noteRes = await this.db.query<any>(
      `
        SELECT
          id,
          board_id AS "boardId",
          date_key AS "dateKey",
          time,
          type,
          actor_id AS "actorId",
          actor_name AS "actorName",
          actor_avatar AS "actorAvatar",
          sub_actor_id AS "subActorId",
          author_profile_id::text AS "authorProfileId",
          author_profile_name AS "authorProfileName",
          title,
          text,
          mood_emoji AS "moodEmoji",
          tags,
          media_attachments AS "mediaAttachments",
          reply_to_note_id AS "replyToNoteId",
          active_flow_session_ids AS "activeFlowSessionIds",
          seasons_note_id AS "seasonsNoteId",
          shared_with_group AS "sharedWithGroup",
          weather,
          world_moment AS "worldMoment"
        FROM timeline_notes
        WHERE id = $1
      `,
      [noteId],
    );
    const note = noteRes.rows[0];
    if (!note) throw new NotFoundException(`Note '${noteId}' not found`);

    const board = await this.fetchBoardRow(note.boardId);
    if (!board) throw new NotFoundException(`Board '${note.boardId}' not found`);
    const members = await this.fetchAllMembers();

    if (!canViewBoard(board, profileId, members)) {
      throw new ForbiddenException('Нет доступа к этому борду.');
    }
    if (
      note.authorProfileId !== profileId &&
      !canManageBoardMembers(board, profileId, members)
    ) {
      throw new ForbiddenException(forbiddenMessage);
    }
    return { profileId, note, board, members };
  }

  private async shareNoteWithMembersIfNeeded(
    note: any,
    board: any,
    members: any[],
    seasonsNoteId: string,
    ownerProfileId: string,
    explicitGrantees?: string[],
  ): Promise<number> {
    const defaultGrantees = Array.from(
      new Set([
        ...(board.ownerProfileId ? [board.ownerProfileId] : []),
        ...members.filter((m) => m.boardId === board.id).map((m) => m.profileId),
      ]),
    ).filter((pid) => pid !== ownerProfileId);
    const granteeProfileIds =
      Array.isArray(explicitGrantees) && explicitGrantees.length > 0
        ? explicitGrantees
        : defaultGrantees;
    if (granteeProfileIds.length === 0) return 0;
    const res = await this.seasonsBridge.shareSeasonsNoteToGroup({
      seasonsNoteId,
      ownerProfileId,
      granteeProfileIds,
      boardId: board.id,
    });
    return res.sharedCount;
  }

  async updateNote(noteId: string, dto: UpdateNoteDto, actorProfileId?: string) {
    const { profileId, note: existing, board } = await this.fetchMutableNoteContext(
      noteId,
      actorProfileId,
      'Нет прав на редактирование чужой записи.',
    );

    const nextTitle = dto.title !== undefined ? dto.title : existing.title;
    const nextText = dto.text !== undefined ? dto.text : existing.text;
    const nextType = dto.type !== undefined ? dto.type : existing.type;
    const nextMood = dto.moodEmoji !== undefined ? dto.moodEmoji : existing.moodEmoji;
    const nextTags =
      dto.tags !== undefined
        ? mergeNoteTags(nextText ?? '', dto.tags)
        : dto.text !== undefined
          ? syncTagsOnTextEdit(existing.text || '', nextText || '', existing.tags || [])
          : existing.tags;
    const nextMedia = dto.mediaAttachments !== undefined ? dto.mediaAttachments : existing.mediaAttachments;
    const nextWeather = dto.weather !== undefined ? dto.weather : existing.weather;
    const nextWorldMoment = dto.worldMoment !== undefined ? dto.worldMoment : existing.worldMoment;

    await this.db.query(
      `
        UPDATE timeline_notes
        SET title = $1,
            text = $2,
            type = $3,
            mood_emoji = $4,
            tags = $5,
            media_attachments = $6::jsonb,
            weather = $7::jsonb,
            world_moment = $8::jsonb
        WHERE id = $9
      `,
      [
        nextTitle ?? null,
        nextText ?? '',
        nextType || 'thought',
        nextMood || '💭',
        Array.isArray(nextTags) ? nextTags : [],
        JSON.stringify(Array.isArray(nextMedia) ? nextMedia : []),
        nextWeather ? JSON.stringify(nextWeather) : null,
        nextWorldMoment ? JSON.stringify(nextWorldMoment) : null,
        noteId,
      ],
    );

    const syncRes = await this.seasonsBridge.syncTimelineNote(
      {
        ...existing,
        type: nextType || 'thought',
        authorProfileId: existing.authorProfileId || profileId,
        title: nextTitle,
        text: nextText || '',
        moodEmoji: nextMood,
        tags: Array.isArray(nextTags) ? nextTags : [],
        mediaAttachments: Array.isArray(nextMedia) ? nextMedia : [],
      },
      board,
    );

    const updatedNotes = await this.getNotes({ profileId, boardId: board.id });
    const updated = updatedNotes.find((n: any) => n.id === noteId);
    return updated
      ? { ...updated, seasonsSynced: syncRes.synced, seasonsSyncError: syncRes.error }
      : {
          id: noteId,
          boardId: board.id,
          title: nextTitle,
          text: nextText,
          type: nextType,
          moodEmoji: nextMood,
          tags: nextTags,
          mediaAttachments: nextMedia,
          seasonsNoteId: syncRes.noteId || existing.seasonsNoteId,
          seasonsExternalId: syncRes.externalId,
          seasonsAccountId: syncRes.seasonsAccountId,
          seasonsSynced: syncRes.synced,
          seasonsSyncError: syncRes.error,
        };
  }

  async pinNote(noteId: string, isPinned: boolean, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);
    const { rows } = await this.db.query(
      `SELECT id, board_id AS "boardId" FROM timeline_notes WHERE id = $1 LIMIT 1`,
      [noteId],
    );
    const note = rows[0];
    if (!note) throw new NotFoundException(`Note '${noteId}' not found`);

    const board = await this.fetchBoardRow(note.boardId);
    if (!board) throw new NotFoundException(`TimeLine board '${note.boardId}' not found`);

    if (!board.ownerProfileId || board.ownerProfileId !== profileId) {
      throw new ForbiddenException('Только создатель доски может прикреплять и откреплять сообщения.');
    }

    const pinnedAt = isPinned ? new Date().toISOString() : null;
    await this.db.query(
      `UPDATE timeline_notes SET is_pinned = $1, pinned_at = $2 WHERE id = $3`,
      [isPinned, pinnedAt, noteId],
    );

    const updatedNotes = await this.getNotes({ profileId, boardId: board.id });
    const updated = updatedNotes.find((n: any) => n.id === noteId);
    return updated ?? { id: noteId, boardId: board.id, isPinned, pinnedAt };
  }

  async syncNoteToSeasons(noteId: string, actorProfileId?: string) {
    const { profileId, note, board, members } = await this.fetchMutableNoteContext(
      noteId,
      actorProfileId,
      'Только автор или владелец борда может синхронизировать запись.',
    );

    const ownerProfileId = note.authorProfileId || profileId;
    const syncRes = await this.seasonsBridge.syncTimelineNote(
      {
        ...note,
        type: note.type || 'thought',
        authorProfileId: ownerProfileId,
        text: note.text || '',
        tags: Array.isArray(note.tags) ? note.tags : [],
        mediaAttachments: Array.isArray(note.mediaAttachments) ? note.mediaAttachments : [],
      },
      board,
    );

    if (syncRes.synced && syncRes.noteId && note.sharedWithGroup) {
      await this.shareNoteWithMembersIfNeeded(
        note,
        board,
        members,
        syncRes.noteId,
        ownerProfileId,
      );
    }

    return {
      noteId: note.id,
      synced: syncRes.synced,
      seasonsNoteId: syncRes.noteId,
      seasonsExternalId: syncRes.externalId,
      seasonsAccountId: syncRes.seasonsAccountId,
      seasonsSyncedAt: syncRes.synced ? new Date().toISOString() : undefined,
      error: syncRes.error,
    };
  }

  async shareNoteWithBoardGroup(noteId: string, dto: ShareNoteGroupDto, actorProfileId?: string) {
    const { profileId, note, board, members } = await this.fetchMutableNoteContext(
      noteId,
      actorProfileId,
      'Только автор записи или владелец борда может управлять NoteShare.',
    );

    const shared = dto.shared ?? true;
    await this.db.query(`UPDATE timeline_notes SET shared_with_group = $1 WHERE id = $2`, [
      shared,
      noteId,
    ]);

    let seasonsNoteId: string | undefined = note.seasonsNoteId || undefined;
    const ownerProfileId = note.authorProfileId || profileId;

    if (shared && !seasonsNoteId) {
      const syncRes = await this.seasonsBridge.syncTimelineNote(
        {
          ...note,
          type: note.type || 'thought',
          authorProfileId: ownerProfileId,
          text: note.text || '',
          tags: Array.isArray(note.tags) ? note.tags : [],
          mediaAttachments: Array.isArray(note.mediaAttachments) ? note.mediaAttachments : [],
        },
        board,
      );
      seasonsNoteId = syncRes.noteId;
    }

    let sharedCount = 0;
    if (seasonsNoteId) {
      if (shared) {
        sharedCount = await this.shareNoteWithMembersIfNeeded(
          note,
          board,
          members,
          seasonsNoteId,
          ownerProfileId,
          dto.granteeProfileIds,
        );
      } else {
        await this.seasonsBridge.revokeSeasonsNoteShare({
          seasonsNoteId,
          ownerProfileId,
          boardId: board.id,
        });
      }
    }

    return {
      noteId,
      boardId: board.id,
      sharedWithGroup: shared,
      seasonsNoteId,
      sharedCount,
    };
  }

  async deleteNote(noteId: string, actorProfileId?: string) {
    const { profileId, note } = await this.fetchMutableNoteContext(
      noteId,
      actorProfileId,
      'Нет прав на удаление чужой записи.',
    );

    await this.db.query(`DELETE FROM timeline_notes WHERE id = $1`, [noteId]);
    await this.seasonsBridge.deleteSeasonsNote(note.seasonsNoteId, note.authorProfileId || profileId);
    return { deleted: true, id: noteId };
  }

  async getCrossLinkCandidates(sourceBoardId: string, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);
    const sourceBoard = await this.fetchBoardRow(sourceBoardId);
    if (!sourceBoard) throw new NotFoundException(`Board '${sourceBoardId}' not found`);

    const allMembers = await this.fetchAllMembers();
    if (!canViewBoard(sourceBoard, profileId, allMembers)) {
      throw new ForbiddenException('Нет доступа к исходному борду.');
    }

    const visibleBoards = await this.getBoards(profileId, false);
    const compatibleBoardIds = visibleBoards
      .filter((b) => b.id !== sourceBoard.id && b.privacy === sourceBoard.privacy)
      .map((b) => b.id);

    if (compatibleBoardIds.length === 0) return [];

    const { rows } = await this.db.query(
      `
        SELECT
          n.id,
          n.board_id AS "boardId",
          n.date_key AS "dateKey",
          n.time,
          n.time_minutes AS "timeMinutes",
          n.type,
          n.actor_id AS "actorId",
          n.actor_name AS "actorName",
          n.actor_avatar AS "actorAvatar",
          n.actor_accent AS "actorAccent",
          n.title,
          n.text,
          n.author_profile_id::text AS "authorProfileId",
          n.author_profile_name AS "authorProfileName",
          n.created_at AS "createdAt"
        FROM timeline_notes n
        WHERE n.board_id = ANY($1::text[])
        ORDER BY n.date_key DESC, n.time_minutes DESC
        LIMIT 80
      `,
      [compatibleBoardIds],
    );
    return rows;
  }

  async createCrossLink(dto: CreateCrossLinkDto, actorProfileId?: string) {
    const profileId = this.resolveProfileId(actorProfileId);

    const srcNoteRes = await this.db.query<any>(
      `SELECT id, board_id AS "boardId", date_key AS "dateKey", time, actor_id AS "actorId", actor_name AS "actorName", actor_avatar AS "actorAvatar", title, text FROM timeline_notes WHERE id = $1`,
      [dto.sourceNoteId],
    );
    const srcNote = srcNoteRes.rows[0];
    if (!srcNote) throw new NotFoundException(`Source note '${dto.sourceNoteId}' not found`);

    const tgtNoteRes = await this.db.query<any>(
      `SELECT id, board_id AS "boardId", date_key AS "dateKey", time, actor_id AS "actorId", actor_name AS "actorName", actor_avatar AS "actorAvatar", title, text FROM timeline_notes WHERE id = $1`,
      [dto.targetNoteId],
    );
    const tgtNote = tgtNoteRes.rows[0];
    if (!tgtNote) throw new NotFoundException(`Target note '${dto.targetNoteId}' not found`);

    const sourceBoard = await this.fetchBoardRow(dto.sourceBoardId || srcNote.boardId);
    const targetBoard = await this.fetchBoardRow(dto.targetBoardId || tgtNote.boardId);
    if (!sourceBoard || !targetBoard) {
      throw new NotFoundException('Source or target TimeLine board not found');
    }

    const allMembers = await this.fetchAllMembers();
    const check = validateCrossLinkAccess(
      sourceBoard,
      targetBoard,
      profileId,
      allMembers.filter((m) => m.boardId === sourceBoard.id),
      allMembers.filter((m) => m.boardId === targetBoard.id),
    );
    if (!check.allowed) {
      throw new ForbiddenException(check.reason);
    }

    const linkId = `crosslink-${srcNote.id}-${tgtNote.id}`;
    const preview = dto.previewCache || {
      id: linkId,
      targetBoardId: targetBoard.id,
      targetBoardTitle: targetBoard.title,
      targetBoardIcon: targetBoard.icon,
      targetNoteId: tgtNote.id,
      targetDateKey: tgtNote.dateKey,
      targetTime: tgtNote.time,
      targetActorId: tgtNote.actorId,
      targetActorName: tgtNote.actorName,
      targetActorAvatar: tgtNote.actorAvatar,
      targetTitle: tgtNote.title,
      targetSnippet: String(tgtNote.text || '').slice(0, 140),
      relationLabel: dto.relationLabel || `Ссылка · ${targetBoard.title}`,
      sessionStatus: targetBoard.flowStatus === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
    };

    await this.db.query(
      `
        INSERT INTO timeline_cross_links (
          id, source_board_id, source_note_id, target_board_id, target_note_id,
          relation_type, relation_label, preview_cache
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          relation_label = EXCLUDED.relation_label,
          preview_cache = EXCLUDED.preview_cache
      `,
      [
        linkId,
        sourceBoard.id,
        srcNote.id,
        targetBoard.id,
        tgtNote.id,
        dto.relationType || 'CROSS_TIMELINE_REF',
        preview.relationLabel,
        JSON.stringify(preview),
      ],
    );

    return preview;
  }

  /**
   * Dedicated workflow for AI Agents (e.g., Antigravity Agent):
   * 1. Writes a summary note onto the agent's own TimeLine board (as the agent character + attached agent profile).
   * 2. If `targetBoardId` is specified, validates same-privacy field + agent membership on `targetBoardId`,
   *    optionally creates an anchor/link note on `targetBoardId` (or attaches to `targetNoteId`), and creates the cross-link.
   */
  async postAgentSummary(dto: AgentSummaryDto) {
    const agentProfileId = dto.agentProfileId || DEFAULT_AGENT_PROFILE_ID;
    const sourceBoardId = dto.sourceBoardId || 'board-coding-sessions';
    const sourceBoard = await this.fetchBoardRow(sourceBoardId);
    if (!sourceBoard) {
      throw new NotFoundException(`Agent source board '${sourceBoardId}' not found`);
    }

    const nowMsk = getMoscowDateAndTime();
    const summaryNote = await this.createNote(
      {
        boardId: sourceBoard.id,
        dateKey: dto.dateKey || nowMsk.dateKey,
        time: dto.time || nowMsk.time,
        type: 'action',
        actorId: dto.actorId || 'actor-antigravity-agent',
        actorName: dto.actorName,
        actorAvatar: dto.actorAvatar,
        actorAccent: dto.actorAccent,
        title: dto.title || 'Сводка Агента',
        text: dto.text,
        moodEmoji: '🤖',
        tags: mergeNoteTags(dto.text, ['agent-summary', ...(dto.tags || [])]),
        mediaAttachments: dto.mediaAttachments || [],
      },
      agentProfileId,
    );

    let crossLink: any = null;
    if (dto.targetBoardId) {
      const targetBoard = await this.fetchBoardRow(dto.targetBoardId);
      if (!targetBoard) {
        throw new NotFoundException(`Target board '${dto.targetBoardId}' not found`);
      }

      const allMembers = await this.fetchAllMembers();
      const targetMembers = allMembers.filter((m) => m.boardId === targetBoard.id);
      const sourceMembers = allMembers.filter((m) => m.boardId === sourceBoard.id);
      const check = validateCrossLinkAccess(
        targetBoard,
        sourceBoard,
        agentProfileId,
        targetMembers,
        sourceMembers,
      );
      if (!check.allowed) {
        throw new ForbiddenException(check.reason);
      }

      let anchorNoteId = dto.targetNoteId;
      if (!anchorNoteId && dto.createAnchorOnTarget !== false) {
        const anchorNote = await this.createNote(
          {
            boardId: targetBoard.id,
            dateKey: summaryNote.dateKey,
            time: summaryNote.time,
            type: 'action',
            actorId: summaryNote.actorId,
            actorName: summaryNote.actorName,
            actorAvatar: summaryNote.actorAvatar,
            actorAccent: summaryNote.actorAccent,
            title: dto.title || `Сводка из ${sourceBoard.title}`,
            text: dto.text.slice(0, 220),
            moodEmoji: '🔗',
            tags: mergeNoteTags(dto.text.slice(0, 220), ['agent-cross-ref', ...(dto.tags || [])]),
          },
          agentProfileId,
        );
        anchorNoteId = anchorNote.id;
      }

      if (anchorNoteId) {
        crossLink = await this.createCrossLink(
          {
            sourceBoardId: targetBoard.id,
            sourceNoteId: anchorNoteId,
            targetBoardId: sourceBoard.id,
            targetNoteId: summaryNote.id,
            relationLabel: dto.relationLabel || `Сводка агента · ${sourceBoard.title}`,
          },
          agentProfileId,
        );
      }
    }

    return {
      summaryNote,
      crossLink,
    };
  }
}
