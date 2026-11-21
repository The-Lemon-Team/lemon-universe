import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  public readonly pool: Pool;
  public readonly databaseUrl: string;
  public readonly databaseName: string;

  constructor() {
    this.databaseUrl =
      process.env.DATABASE_URL || 'postgresql://lemon:secret@127.0.0.1:5435/lemon_universe_db';
    this.databaseName = this.databaseUrl.split('/').pop()?.split('?')[0] || 'lemon_universe_db';
    this.pool = new Pool({ connectionString: this.databaseUrl });
  }

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureSchemaAndMigrations();
    } catch (err) {
      this.logger.warn(
        `Database schema sync skipped or failed (PostgreSQL offline?): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }

  /**
   * Idempotently applies TimeLines privacy, members, diary mode, and media columns
   * onto existing PostgreSQL databases without requiring destructive resets.
   */
  async ensureSchemaAndMigrations(): Promise<void> {
    await this.pool.query(`
      DO $$ BEGIN
        CREATE TYPE "BoardPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "TimelineBoardMode" AS ENUM ('TIMELINE', 'DIARY', 'AGENT_SUMMARY', 'PARTY_CLOUD');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "BoardMemberRole" AS ENUM ('OWNER', 'EDITOR', 'MEMBER', 'AGENT', 'VIEWER');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await this.pool.query(`
      ALTER TABLE timeline_boards
        ADD COLUMN IF NOT EXISTS board_mode "TimelineBoardMode" NOT NULL DEFAULT 'TIMELINE',
        ADD COLUMN IF NOT EXISTS privacy "BoardPrivacy" NOT NULL DEFAULT 'PRIVATE',
        ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS default_actor_id TEXT,
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS hashtags TEXT[] NOT NULL DEFAULT '{}';
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS timeline_board_members (
        id UUID PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES timeline_boards(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        role "BoardMemberRole" NOT NULL DEFAULT 'MEMBER',
        can_post BOOLEAN NOT NULL DEFAULT TRUE,
        can_cross_link BOOLEAN NOT NULL DEFAULT TRUE,
        added_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (board_id, profile_id)
      );
      CREATE INDEX IF NOT EXISTS timeline_board_members_profile_idx ON timeline_board_members (profile_id);
    `);

    await this.pool.query(`
      ALTER TABLE timeline_notes
        ADD COLUMN IF NOT EXISTS origin TEXT,
        ADD COLUMN IF NOT EXISTS external_ref TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS timeline_notes_external_ref_idx
        ON timeline_notes (board_id, external_ref) WHERE external_ref IS NOT NULL;
      CREATE INDEX IF NOT EXISTS timeline_notes_feed_idx ON timeline_notes (board_id, created_at, id);
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS projectarium_links (
        id UUID PRIMARY KEY,
        stand_slug TEXT NOT NULL,
        label TEXT,
        projectarium_url TEXT,
        token_hash TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT ARRAY['chronicle:read'],
        created_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        rotated_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS projectarium_links_stand_idx ON projectarium_links (stand_slug);
      CREATE TABLE IF NOT EXISTS projectarium_link_boards (
        link_id UUID NOT NULL REFERENCES projectarium_links(id) ON DELETE CASCADE,
        board_id TEXT NOT NULL REFERENCES timeline_boards(id) ON DELETE CASCADE,
        PRIMARY KEY (link_id, board_id)
      );
    `);

    await this.pool.query(`
      ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS seasons_user_id TEXT,
        ADD COLUMN IF NOT EXISTS seasons_user_key TEXT;
    `);

    await this.pool.query(`
      ALTER TABLE timeline_notes
        ADD COLUMN IF NOT EXISTS media_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS seasons_synced_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS seasons_account_id TEXT,
        ADD COLUMN IF NOT EXISTS shared_with_group BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
    `);

    // Backfill default seeded boards so they are PUBLIC & owned cleanly
    await this.pool.query(`
      UPDATE timeline_boards
      SET privacy = 'PUBLIC',
          board_mode = CASE WHEN id = 'board-coding-sessions' THEN 'AGENT_SUMMARY'::"TimelineBoardMode" ELSE 'PARTY_CLOUD'::"TimelineBoardMode" END,
          owner_profile_id = COALESCE(owner_profile_id, CASE WHEN id = 'board-coding-sessions' THEN 'a7e49c10-9100-4b22-a811-9000a6e17001'::uuid ELSE '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'::uuid END),
          default_actor_id = COALESCE(default_actor_id, CASE WHEN id = 'board-coding-sessions' THEN 'actor-antigravity-agent' ELSE 'actor-alexey' END)
      WHERE id IN ('board-global-day', 'board-coding-sessions');
    `);

    // Ensure seeded Personal Diary board and initial memberships exist
    await this.pool.query(`
      INSERT INTO timeline_boards (
        id, slug, title, description, icon, color_theme, vibe_id, board_kind, board_mode,
        privacy, owner_profile_id, default_actor_id, seasons_stream_slug, seasons_feed_slug, is_default
      ) VALUES (
        'board-personal-diary',
        'personal-diary',
        '📓 Личный Дневник (Private)',
        'Приватный дневник размышлений и событий от имени выбранного персонажа. Виден только владельцу и добавленным участникам.',
        'menu_book',
        'emerald',
        'NATURE_ZEN',
        'CUSTOM_PROJECT',
        'DIARY',
        'PRIVATE',
        '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'::uuid,
        'actor-alexey',
        'lemon-universe',
        'universe-personal-diary',
        FALSE
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO timeline_board_members (id, board_id, profile_id, role, can_post, can_cross_link, added_by_profile_id)
      VALUES
        ('m0000001-0000-4000-8000-000000000001', 'board-global-day', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'OWNER', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
        ('m0000001-0000-4000-8000-000000000002', 'board-global-day', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'AGENT', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
        ('m0000001-0000-4000-8000-000000000003', 'board-coding-sessions', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'OWNER', TRUE, TRUE, 'a7e49c10-9100-4b22-a811-9000a6e17001'),
        ('m0000001-0000-4000-8000-000000000004', 'board-coding-sessions', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'EDITOR', TRUE, TRUE, 'a7e49c10-9100-4b22-a811-9000a6e17001'),
        ('m0000001-0000-4000-8000-000000000005', 'board-personal-diary', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'OWNER', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b')
      ON CONFLICT (board_id, profile_id) DO NOTHING;
    `);
  }
}
