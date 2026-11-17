import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://lemon:secret@127.0.0.1:5435/lemon_universe_db';
const DB_NAME = DATABASE_URL.split('/').pop()?.split('?')[0] || 'lemon_universe_db';
const SEASONS_URL = (process.env.LEMON_SEASONS_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const SEASONS_TOKEN =
  process.env.LEMON_SEASONS_TOKEN || 'lenta_adm_master_permanent_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c';

const pool = new Pool({ connectionString: DATABASE_URL });

let seasonsStreamEnsured = false;

async function ensureSeasonsUniverseStream(streamSlug = 'lemon-universe') {
  if (seasonsStreamEnsured && streamSlug === 'lemon-universe') return;
  try {
    const check = await fetch(`${SEASONS_URL}/api/v1/streams/${encodeURIComponent(streamSlug)}`, {
      headers: {
        Authorization: `Bearer ${SEASONS_TOKEN}`,
        'x-api-key': SEASONS_TOKEN,
      },
    });
    if (check.ok) {
      if (streamSlug === 'lemon-universe') seasonsStreamEnsured = true;
      return;
    }
    const created = await fetch(`${SEASONS_URL}/api/v1/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SEASONS_TOKEN}`,
        'x-api-key': SEASONS_TOKEN,
      },
      body: JSON.stringify({
        slug: streamSlug,
        title: '🌌 Lemon Universe',
        description: 'Сводка TimeLines, кодинг-сессий и событий персонажей Lemon Universe',
        icon: '🌌',
        color: '#8b5cf6',
        privacy: 'public',
        tags: ['lemon-universe', 'timelines', 'coding-sessions'],
      }),
    });
    if (created.ok && streamSlug === 'lemon-universe') {
      seasonsStreamEnsured = true;
    }
  } catch {
    // Non-blocking
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/health' && req.method === 'GET') {
      const { rows } = await pool.query('SELECT count(*)::int AS count FROM timeline_boards');
      let seasonsConnected = false;
      try {
        const sr = await fetch(`${SEASONS_URL}/api/health`);
        seasonsConnected = sr.ok;
      } catch {}
      return sendJson(res, 200, {
        status: 'ok',
        project: 'lemon-universe',
        database: DB_NAME,
        boardsCount: rows[0]?.count ?? 0,
        seasonsUrl: SEASONS_URL,
        seasonsConnected,
      });
    }

    if (path === '/api/profiles' && req.method === 'GET') {
      const { rows } = await pool.query(`
        SELECT
          id,
          handle,
          display_name AS "displayName",
          avatar_icon AS "avatarIcon",
          player_type AS "playerType",
          default_feed_slug AS "defaultFeedSlug",
          created_at AS "createdAt"
        FROM profiles
        ORDER BY created_at ASC
      `);
      return sendJson(res, 200, rows);
    }

    if (path === '/api/flows' && req.method === 'GET') {
      const { rows } = await pool.query(`
        SELECT
          id,
          name,
          description,
          type,
          status,
          is_exclusive AS "isExclusive",
          folder_id AS "folderId",
          profile_id AS "profileId",
          config,
          orchestrator_rules AS "orchestratorRules",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM flows
        ORDER BY created_at ASC
      `);
      return sendJson(res, 200, rows.map((r) => ({ ...r, tags: [] })));
    }

    if (path === '/api/timelines/boards' && req.method === 'GET') {
      const { rows } = await pool.query(`
        SELECT
          b.id,
          b.slug,
          b.title,
          b.description,
          b.icon,
          b.color_theme AS "colorTheme",
          b.vibe_id AS "vibeId",
          b.board_kind AS "boardKind",
          b.flow_id AS "flowId",
          COALESCE(f.type::text, 'CONTEXT') AS "flowType",
          COALESCE(f.status::text, 'ACTIVE') AS "flowStatus",
          b.seasons_stream_slug AS "seasonsStreamSlug",
          b.seasons_feed_slug AS "seasonsFeedSlug",
          b.is_default AS "isDefault",
          (SELECT count(*)::int FROM timeline_notes n WHERE n.board_id = b.id) AS "notesCount"
        FROM timeline_boards b
        LEFT JOIN flows f ON f.id = b.flow_id
        ORDER BY b.created_at ASC
      `);
      return sendJson(res, 200, rows);
    }

    if (path === '/api/timelines/boards' && req.method === 'POST') {
      const body = await readBody(req);
      const id = body.id || `board-${Date.now()}`;
      const slug = body.slug || id;
      const title = body.title || 'Новый TimeLine Board';
      const description = body.description || '';
      const icon = body.icon || 'timeline';
      const colorTheme = body.colorTheme || 'amber';
      const vibeId = body.vibeId || 'CHRONO_DAYFLOW';
      const boardKind = body.boardKind || 'CUSTOM_PROJECT';
      const flowType = body.flowType || 'CONTEXT';
      const seasonsStreamSlug = body.seasonsStreamSlug || 'lemon-universe';
      const seasonsFeedSlug = body.seasonsFeedSlug || `universe-${slug}`;

      // Create corresponding Core Combinator Flow + active FlowSession in PostgreSQL
      const flowId = crypto.randomUUID();
      await pool.query(
        `
          INSERT INTO flows (id, name, description, type, status, is_exclusive, folder_id, profile_id, config, orchestrator_rules)
          VALUES ($1::uuid, $2, $3, $4::"FlowType", 'ACTIVE', $5, 'f0000001-0000-4000-8000-000000000002', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', $6::jsonb, '{}'::jsonb)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          flowId,
          `Поток: ${title}`,
          description || `Поток Core Combinator для TimeLine Board ${title}`,
          flowType,
          flowType === 'MUTEX',
          JSON.stringify({ boardId: id, seasonsStream: seasonsStreamSlug, seasonsFeed: seasonsFeedSlug }),
        ],
      );

      const sessionId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO flow_sessions (id, flow_id) VALUES ($1::uuid, $2::uuid)`,
        [sessionId, flowId],
      );

      await pool.query(
        `
          INSERT INTO timeline_boards (
            id, slug, title, description, icon, color_theme, vibe_id, board_kind,
            flow_id, seasons_stream_slug, seasons_feed_slug, is_default
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"TimelineBoardKind", $9::uuid, $10, $11, FALSE)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          id,
          slug,
          title,
          description,
          icon,
          colorTheme,
          vibeId,
          boardKind,
          flowId,
          seasonsStreamSlug,
          seasonsFeedSlug,
        ],
      );

      return sendJson(res, 201, {
        id,
        slug,
        title,
        description,
        icon,
        colorTheme,
        vibeId,
        boardKind,
        flowId,
        flowType,
        flowStatus: 'ACTIVE',
        activeSessionId: sessionId,
        seasonsStreamSlug,
        seasonsFeedSlug,
      });
    }

    if (path === '/api/timelines/notes' && req.method === 'GET') {
      const boardId = url.searchParams.get('boardId');
      const params = [];
      let whereClause = '';
      if (boardId) {
        params.push(boardId);
        whereClause = 'WHERE n.board_id = $1';
      }
      const { rows } = await pool.query(
        `
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
            n.author_profile_id AS "authorProfileId",
            n.author_profile_name AS "authorProfileName",
            n.title,
            n.text,
            n.mood_emoji AS "moodEmoji",
            n.tags,
            n.party_actor_ids AS "partyActorIds",
            n.supporters,
            n.votes_count AS "votesCount",
            n.liked_by_actors AS "likedByActors",
            n.reply_to_note_id AS "replyToNoteId",
            n.reply_to_author_name AS "replyToAuthorName",
            n.reply_to_text_snippet AS "replyToTextSnippet",
            n.is_pinned_to_hero AS "isPinnedToHero",
            n.is_pinned_to_cloud AS "isPinnedToCloud",
            n.seasons_note_id AS "seasonsNoteId",
            n.active_flow_session_ids AS "activeFlowSessionIds",
            n.created_at AS "createdAt",
            COALESCE(
              (SELECT json_agg(cl.preview_cache) FROM timeline_cross_links cl WHERE cl.source_note_id = n.id),
              '[]'::json
            ) AS "crossRefs"
          FROM timeline_notes n
          ${whereClause}
          ORDER BY n.date_key DESC, n.time_minutes ASC
        `,
        params,
      );
      return sendJson(res, 200, rows);
    }

    if (path === '/api/timelines/notes' && req.method === 'POST') {
      const note = await readBody(req);
      const id = note.id || `note-${Date.now()}`;
      const boardId = note.boardId || 'board-global-day';
      const dateKey = note.dateKey || '2026-11-06';
      const time = note.time || '12:00';
      const timeMinutes = Number(note.timeMinutes ?? 720);

      await pool.query(
        `
          INSERT INTO timeline_notes (
            id, board_id, date_key, time, time_minutes, type, visibility,
            actor_id, actor_name, actor_avatar, actor_accent, actor_title,
            sub_actor_id, sub_actor_name, sub_actor_avatar, sub_actor_accent,
            author_profile_id, author_profile_name,
            title, text, mood_emoji, tags, party_actor_ids, supporters,
            votes_count, liked_by_actors, active_flow_session_ids
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17::uuid, $18,
            $19, $20, $21, $22, $23, $24,
            $25, $26::jsonb, $27
          )
          ON CONFLICT (id) DO UPDATE SET
            text = EXCLUDED.text,
            author_profile_id = EXCLUDED.author_profile_id,
            author_profile_name = EXCLUDED.author_profile_name,
            votes_count = EXCLUDED.votes_count,
            liked_by_actors = EXCLUDED.liked_by_actors
        `,
        [
          id,
          boardId,
          dateKey,
          time,
          timeMinutes,
          note.type || 'thought',
          note.visibility || 'PUBLIC',
          note.actorId || 'actor-antigravity-agent',
          note.actorName || 'Antigravity Agent',
          note.actorAvatar || 'antigravity-agent',
          note.actorAccent || 'violet',
          note.actorTitle || '',
          note.subActorId || null,
          note.subActorName || null,
          note.subActorAvatar || null,
          note.subActorAccent || null,
          note.authorProfileId || null,
          note.authorProfileName || null,
          note.title || null,
          note.text || '',
          note.moodEmoji || '💭',
          Array.isArray(note.tags) ? note.tags : [],
          Array.isArray(note.partyActorIds) ? note.partyActorIds : [],
          Array.isArray(note.supporters) ? note.supporters : [],
          Number(note.votesCount ?? 1),
          JSON.stringify(note.likedByActors || []),
          Array.isArray(note.activeFlowSessionIds) ? note.activeFlowSessionIds : [],
        ],
      );

      if (Array.isArray(note.crossRefs)) {
        for (const ref of note.crossRefs) {
          const linkId = ref.id || `crosslink-${id}-${ref.targetNoteId}`;
          await pool.query(
            `
              INSERT INTO timeline_cross_links (
                id, source_board_id, source_note_id, target_board_id, target_note_id,
                relation_type, relation_label, preview_cache
              ) VALUES ($1, $2, $3, $4, $5, 'CHILD_SESSION', $6, $7::jsonb)
              ON CONFLICT (id) DO UPDATE SET preview_cache = EXCLUDED.preview_cache
            `,
            [
              linkId,
              boardId,
              id,
              ref.targetBoardId,
              ref.targetNoteId,
              ref.relationLabel || 'Дочерний узел',
              JSON.stringify(ref),
            ],
          );
        }
      }

      return sendJson(res, 201, { ...note, id, boardId });
    }

    if (path === '/api/seasons-bridge/ingest' && req.method === 'POST') {
      const payload = await readBody(req);
      const streamSlug = payload.streamSlug || 'lemon-universe';
      try {
        await ensureSeasonsUniverseStream(streamSlug);
        const upstream = await fetch(`${SEASONS_URL}/api/v1/notes/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SEASONS_TOKEN}`,
            'x-api-key': SEASONS_TOKEN,
          },
          body: JSON.stringify(payload),
        });
        if (upstream.ok) {
          const data = await upstream.json();
          if (payload.metadata?.partyNoteId && data.noteId) {
            await pool
              .query('UPDATE timeline_notes SET seasons_note_id = $1 WHERE id = $2', [
                data.noteId,
                payload.metadata.partyNoteId,
              ])
              .catch(() => {});
          }
          return sendJson(res, 200, { synced: true, ...data });
        }
        const errText = await upstream.text().catch(() => '');
        return sendJson(res, 200, {
          synced: false,
          upstreamStatus: upstream.status,
          upstreamError: errText,
          queuedInPersonalFeed: true,
        });
      } catch (err) {
        return sendJson(res, 200, {
          synced: false,
          error: err instanceof Error ? err.message : String(err),
          queuedInPersonalFeed: true,
          noteId: payload.externalId || `seasons-local-${Date.now()}`,
          feedSlug: payload.feedSlug || 'universe-personal-feed',
          streamSlug,
        });
      }
    }

    return sendJson(res, 404, { message: 'Not Found' });
  } catch (error) {
    return sendJson(res, 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`🍋🌌 Lemon Universe API Server listening on http://localhost:${PORT}/api (PostgreSQL: ${DB_NAME})`);
});
