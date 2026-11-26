import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

export class RegisterProfileDto {
  @ApiProperty({ description: 'Unique handle', example: 'hades_underworld' })
  handle!: string;

  @ApiProperty({ description: 'Human-readable display name', example: 'Аид' })
  displayName!: string;

  @ApiPropertyOptional({ description: 'Material icon key or avatar', example: 'smart_toy' })
  avatarIcon?: string;

  @ApiPropertyOptional({ description: 'Player type', enum: ['HUMAN', 'AGENT', 'GM'], default: 'HUMAN' })
  playerType?: 'HUMAN' | 'AGENT' | 'GM';

  @ApiPropertyOptional({ description: 'Default Seasons feed slug' })
  defaultFeedSlug?: string;

  @ApiPropertyOptional({ description: 'Optional Lemon Seasons user ID' })
  seasonsUserId?: string;

  @ApiPropertyOptional({ description: 'Optional Lemon Seasons user key' })
  seasonsUserKey?: string;
}

export class UpdateProfileSeasonsDto {
  @ApiPropertyOptional({ description: 'Lemon Seasons user ID' })
  seasonsUserId?: string;

  @ApiPropertyOptional({ description: 'Lemon Seasons user key' })
  seasonsUserKey?: string;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const { rows } = await this.db.query(`
      SELECT
        id,
        handle,
        display_name AS "displayName",
        avatar_icon AS "avatarIcon",
        player_type AS "playerType",
        default_feed_slug AS "defaultFeedSlug",
        seasons_user_id AS "seasonsUserId",
        (seasons_user_key IS NOT NULL AND seasons_user_key <> '') AS "hasSeasonsKey",
        created_at AS "createdAt"
      FROM profiles
      ORDER BY created_at ASC
    `);
    return rows;
  }

  async create(dto: RegisterProfileDto) {
    const id = crypto.randomUUID();
    const cleanHandle = (dto.handle || `user_${Date.now()}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_');
    const displayName = (dto.displayName || cleanHandle).trim();
    const playerType = dto.playerType || 'HUMAN';
    const avatarIcon = dto.avatarIcon || (playerType === 'AGENT' ? 'smart_toy' : 'person');
    const defaultFeedSlug = dto.defaultFeedSlug || `universe-${cleanHandle}-feed`;

    const { rows } = await this.db.query(
      `
        INSERT INTO profiles (
          id, handle, display_name, avatar_icon, player_type, default_feed_slug,
          seasons_user_id, seasons_user_key
        )
        VALUES ($1::uuid, $2, $3, $4, $5::"PlayerType", $6, $7, $8)
        ON CONFLICT (handle) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_icon = EXCLUDED.avatar_icon,
          seasons_user_id = COALESCE(EXCLUDED.seasons_user_id, profiles.seasons_user_id),
          seasons_user_key = COALESCE(EXCLUDED.seasons_user_key, profiles.seasons_user_key)
        RETURNING
          id,
          handle,
          display_name AS "displayName",
          avatar_icon AS "avatarIcon",
          player_type AS "playerType",
          default_feed_slug AS "defaultFeedSlug",
          seasons_user_id AS "seasonsUserId",
          (seasons_user_key IS NOT NULL AND seasons_user_key <> '') AS "hasSeasonsKey",
          created_at AS "createdAt"
      `,
      [
        id,
        cleanHandle,
        displayName,
        avatarIcon,
        playerType,
        defaultFeedSlug,
        dto.seasonsUserId?.trim() || null,
        dto.seasonsUserKey?.trim() || null,
      ],
    );
    return rows[0];
  }

  async updateSeasonsCredentials(
    profileId: string,
    dto: { seasonsUserId?: string; seasonsUserKey?: string },
  ) {
    const { rows } = await this.db.query(
      `
        UPDATE profiles
        SET
          seasons_user_id = COALESCE($2, seasons_user_id),
          seasons_user_key = COALESCE($3, seasons_user_key)
        WHERE id = $1::uuid
        RETURNING
          id,
          handle,
          display_name AS "displayName",
          avatar_icon AS "avatarIcon",
          player_type AS "playerType",
          default_feed_slug AS "defaultFeedSlug",
          seasons_user_id AS "seasonsUserId",
          (seasons_user_key IS NOT NULL AND seasons_user_key <> '') AS "hasSeasonsKey",
          created_at AS "createdAt"
      `,
      [profileId, dto.seasonsUserId?.trim() || null, dto.seasonsUserKey?.trim() || null],
    );
    return rows[0] ?? null;
  }
}
