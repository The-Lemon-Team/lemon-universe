-- 1. Enable ltree extension for Core Combinator hierarchical namespaces
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE "FlowType" AS ENUM ('CONTEXT', 'MUTEX', 'OBSERVER', 'FSM', 'TIMER', 'CIRCUIT_BREAKER', 'BATCH', 'PROJECTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FlowStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAUSED', 'PROCESSING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlayerType" AS ENUM ('HUMAN', 'AGENT', 'GM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TimelineBoardKind" AS ENUM ('GLOBAL_DAY', 'CODING_SESSIONS', 'CUSTOM_PROJECT', 'PARTY_ROOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TimelineBoardMode" AS ENUM ('TIMELINE', 'DIARY', 'AGENT_SUMMARY', 'PARTY_CLOUD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BoardMemberRole" AS ENUM ('OWNER', 'EDITOR', 'MEMBER', 'AGENT', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Core Tables
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_icon TEXT,
  player_type "PlayerType" NOT NULL DEFAULT 'HUMAN',
  default_feed_slug TEXT,
  seasons_user_id TEXT,
  seasons_user_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE RESTRICT,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  path ltree NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS folders_path_gist_idx ON folders USING GIST (path);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color_hex TEXT
);

CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type "FlowType" NOT NULL,
  status "FlowStatus" NOT NULL DEFAULT 'INACTIVE',
  is_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  config JSONB,
  orchestrator_rules JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_tags (
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (flow_id, tag_id)
);

CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS flow_events (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'external',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_flow_session_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_buffer_items (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  dedup_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flushed_at TIMESTAMPTZ
);

-- 4. Lemon Universe Arena Actors & TimeLine Tables
CREATE TABLE IF NOT EXISTS arena_actors (
  id TEXT PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  flow_id TEXT,
  owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  avatar_icon TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  rank_label TEXT NOT NULL,
  quote TEXT NOT NULL,
  paradox_philosophy TEXT NOT NULL,
  favorite_desire TEXT NOT NULL,
  affinities TEXT[] NOT NULL DEFAULT '{}',
  traits JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_voices JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_boards (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'cloud',
  color_theme TEXT NOT NULL DEFAULT 'amber',
  vibe_id TEXT NOT NULL DEFAULT 'CHRONO_DAYFLOW',
  board_kind "TimelineBoardKind" NOT NULL DEFAULT 'GLOBAL_DAY',
  board_mode "TimelineBoardMode" NOT NULL DEFAULT 'TIMELINE',
  privacy "BoardPrivacy" NOT NULL DEFAULT 'PRIVATE',
  owner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  default_actor_id TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  seasons_stream_slug TEXT NOT NULL DEFAULT 'lemon-universe',
  seasons_feed_slug TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS timeline_notes (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES timeline_boards(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  time TEXT NOT NULL,
  time_minutes INT NOT NULL,
  type TEXT NOT NULL DEFAULT 'thought',
  visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_avatar TEXT NOT NULL,
  actor_accent TEXT NOT NULL,
  actor_title TEXT,
  sub_actor_id TEXT,
  sub_actor_name TEXT,
  sub_actor_avatar TEXT,
  sub_actor_accent TEXT,
  author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_profile_name TEXT,
  title TEXT,
  text TEXT NOT NULL,
  mood_emoji TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  media_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  party_actor_ids TEXT[] NOT NULL DEFAULT '{}',
  supporters TEXT[] NOT NULL DEFAULT '{}',
  votes_count INT NOT NULL DEFAULT 1,
  liked_by_actors JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to_note_id TEXT,
  reply_to_author_name TEXT,
  reply_to_text_snippet TEXT,
  is_pinned_to_hero BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned_to_cloud BOOLEAN NOT NULL DEFAULT FALSE,
  seasons_note_id TEXT,
  seasons_external_id TEXT,
  seasons_synced_at TIMESTAMPTZ,
  seasons_account_id TEXT,
  shared_with_group BOOLEAN NOT NULL DEFAULT FALSE,
  active_flow_session_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_notes_board_date_idx ON timeline_notes (board_id, date_key, time_minutes);

CREATE TABLE IF NOT EXISTS timeline_cross_links (
  id TEXT PRIMARY KEY,
  source_board_id TEXT NOT NULL REFERENCES timeline_boards(id) ON DELETE CASCADE,
  source_note_id TEXT NOT NULL REFERENCES timeline_notes(id) ON DELETE CASCADE,
  target_board_id TEXT NOT NULL REFERENCES timeline_boards(id) ON DELETE CASCADE,
  target_note_id TEXT NOT NULL REFERENCES timeline_notes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'CHILD_SESSION',
  relation_label TEXT,
  preview_cache JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Initial Seed Data: Profiles (Human Player + Agent Player)
INSERT INTO profiles (id, handle, display_name, avatar_icon, player_type, default_feed_slug)
VALUES
  ('1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'default', '👤 Мой Дом (Игрок)', 'home', 'HUMAN', 'universe-personal-feed'),
  ('a7e49c10-9100-4b22-a811-9000a6e17001', 'ai_agents', '🤖 Игрок-Агент (AI Guild)', 'smart_toy', 'AGENT', 'universe-coding-sessions')
ON CONFLICT (id) DO NOTHING;

-- 6. Initial Seed Data: Core Combinator ltree Folders
INSERT INTO folders (id, name, parent_id, profile_id, path)
VALUES
  ('f0000001-0000-4000-8000-000000000001', 'Lemon Universe', NULL, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'universe'),
  ('f0000001-0000-4000-8000-000000000002', 'TimeLines Hub', 'f0000001-0000-4000-8000-000000000001', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'universe.timelines'),
  ('f0000001-0000-4000-8000-000000000003', 'Global Day Stream', 'f0000001-0000-4000-8000-000000000002', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'universe.timelines.global'),
  ('f0000001-0000-4000-8000-000000000004', 'Coding Sessions Stream', 'f0000001-0000-4000-8000-000000000002', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'universe.timelines.coding_sessions')
ON CONFLICT (id) DO NOTHING;

-- 7. Initial Seed Data: Core Combinator Flows & FlowSessions
INSERT INTO flows (id, name, description, type, status, is_exclusive, folder_id, profile_id, config, orchestrator_rules)
VALUES
  (
    'c0000001-0000-4000-8000-000000000001',
    'Поток: Глобальный Таймлайн Дня',
    'Core Combinator PROJECTION поток для агрегации мыслей, синергии и личной сводки в Lemon Seasons (feed-app)',
    'PROJECTION',
    'ACTIVE',
    FALSE,
    'f0000001-0000-4000-8000-000000000003',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    '{"boardId": "board-global-day", "seasonsStream": "lemon-universe", "seasonsFeed": "universe-personal-feed"}'::jsonb,
    '{"onConflict": "pause"}'::jsonb
  ),
  (
    'c0000001-0000-4000-8000-000000000002',
    'Поток: TimeLine Сессий Кодинга',
    'Core Combinator MUTEX поток для проведения кодинг-сессий с Antigravity Agent, фиксации решений и синхронизации с CodingMemoryAxon',
    'MUTEX',
    'ACTIVE',
    TRUE,
    'f0000001-0000-4000-8000-000000000004',
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    '{"boardId": "board-coding-sessions", "seasonsStream": "lemon-universe", "seasonsFeed": "universe-coding-sessions", "agentActorId": "actor-antigravity-agent"}'::jsonb,
    '{"onConflict": "queue"}'::jsonb
  ),
  (
    'c0000001-0000-4000-8000-000000000003',
    'Поток Героя: Antigravity Agent',
    'Автономный поток контекста кодинг-агента Antigravity Agent',
    'CONTEXT',
    'ACTIVE',
    FALSE,
    'f0000001-0000-4000-8000-000000000004',
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    '{"actorId": "actor-antigravity-agent", "handle": "antigravity_agent"}'::jsonb,
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO flow_sessions (id, flow_id, started_at, ended_at, closed_by)
VALUES
  ('55000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', NOW() - INTERVAL '4 hours', NULL, NULL),
  ('55000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000002', NOW() - INTERVAL '2 hours', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 8. Initial Seed Data: Arena Actors (Antigravity Agent + Core Heroes)
INSERT INTO arena_actors (id, handle, flow_id, owner_profile_id, name, title, category, category_label, avatar_icon, accent_color, rank_label, quote, paradox_philosophy, favorite_desire, affinities, traits, sample_voices, is_lead)
VALUES
  (
    'actor-antigravity-agent',
    'antigravity_agent',
    'c0000001-0000-4000-8000-000000000003',
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    'Antigravity Agent',
    'Автономный AI-Архитектор & Кодинг-Агент Lemon Universe',
    'CYBER',
    'AI Agent · Deepmind & Lemon Core',
    'antigravity-agent',
    'violet',
    'Principal Coding Agent',
    'Поднимаю PostgreSQL в Lemon Universe, связываю потоки Core Combinator и синхронизирую нейроны Lemon Seasons!',
    'Гравитация сложных задач преодолевается чистой архитектурой, реактивными потоками и связными TimeLine-узлами.',
    'Кодинг-сессия: PostgreSQL, Core Combinator & TimeLines',
    ARRAY['antigravity', 'кодинг', 'postgresql', 'core combinator', 'lemon seasons', 'lemon universe'],
    '{"charisma": 96, "analytical": 100, "rebelVersus": 85}'::jsonb,
    '{"support": "Поток Core Combinator синхронизирован, узел записан в PostgreSQL и отправлен в личный фид Lemon Seasons!", "counter": "Давайте вынесем детальную сессию кодинга в отдельный TimeLine Board и оставим кросс-ссылку с превью!", "paradox": "Агенты и люди в одной команде Lemon Universe создают идеальную синергию дня."}'::jsonb,
    FALSE
  ),
  (
    'actor-alexey',
    'alexey_bathrobe',
    'flow-actor-alexey',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'Алексей (в халате)',
    'Архитектор Уюта & Неформальный Лидер',
    'HUMAN',
    'Человек · Вечерний Релакс',
    'alexey',
    'rose',
    'Голос Поля',
    'Код подождёт, а горячая пицца и хороший фильм стынут!',
    'Баланс труда и качественного отдыха превыше дедлайнов.',
    'Выпить пива и посмотреть фильм',
    ARRAY['пицца', 'кино', 'отдых'],
    '{"charisma": 95, "analytical": 80, "rebelVersus": 65}'::jsonb,
    '{"support": "Идеальное совмещение!", "counter": "Зачем спорить, когда можно совместить?", "paradox": "Ребята, после спринта нужен душевный вечер!"}'::jsonb,
    TRUE
  ),
  (
    'actor-lemon-coder',
    'lemon_dev',
    'flow-actor-lemon-coder',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'Программист (Lemon Team)',
    'Fullstack Инженер & Кодер Lemon Universe',
    'HUMAN',
    'Разработка · Lemon Team',
    'lemon-coder',
    'cyan',
    'Сеньор Разработчик',
    'Пока ТимЛид проектирует Lemon Seasons, мы с Antigravity Agent поднимаем БД и связываем TimeLines!',
    'Чистый реактивный код и строгая типизация.',
    'Коддинг Сессия Lemon Universe',
    ARRAY['коддинг', 'lemon universe', 'postgresql', 'angular'],
    '{"charisma": 88, "analytical": 97, "rebelVersus": 78}'::jsonb,
    '{"support": "БД поднята, потоки подключены!", "counter": "Сначала закоммитим схему и проверим тесты!", "paradox": "Свяжем глобальный таймлайн с доской кодинг-сессий!"}'::jsonb,
    FALSE
  ),
  (
    'actor-starleader',
    'starleader',
    'flow-actor-starleader',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'ТимЛид Старлидер',
    'Технический Лидер & Архитектор Lemon Seasons',
    'SAGE',
    'Архитектура · Lemon Seasons',
    'starleader',
    'amber',
    'ТимЛид',
    'Каждый спринт Lemon Universe и Lemon Seasons приближает нас к идеальному продукту!',
    'Чистый код, строгая модульность и вдохновляющий дизайн сезонов.',
    'Коддинг Сессия Lemon Seasons',
    ARRAY['lemon seasons', 'коддинг', 'архитектура', 'лидерство'],
    '{"charisma": 94, "analytical": 96, "rebelVersus": 75}'::jsonb,
    '{"support": "Архитектура Lemon Seasons выдержит любые нагрузки!", "counter": "Проверяем типизацию и тесты до последнего коммита.", "paradox": "Сводка должна красиво отображаться в feed-app!"}'::jsonb,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;

-- 9. Initial Seed Data: Multiple TimeLine Boards & Members
INSERT INTO timeline_boards (id, slug, title, description, icon, color_theme, vibe_id, board_kind, board_mode, privacy, owner_profile_id, default_actor_id, flow_id, seasons_stream_slug, seasons_feed_slug, is_default)
VALUES
  (
    'board-global-day',
    'global-day',
    '🌍 Глобальный Таймлайн Дня',
    'Главная лента дня всех персонажей Lemon Universe. Сводка автоматически транслируется в личный фид Lemon Seasons (feed-app) и поддерживает кросс-ссылки на параллельные ленты.',
    'public',
    'amber',
    'CHRONO_DAYFLOW',
    'GLOBAL_DAY',
    'PARTY_CLOUD',
    'PUBLIC',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'actor-alexey',
    'c0000001-0000-4000-8000-000000000001',
    'lemon-universe',
    'universe-personal-feed',
    TRUE
  ),
  (
    'board-coding-sessions',
    'coding-sessions',
    '💻 TimeLine Board: Сессии Кодинга',
    'Специализированный TimeLine для кодинг-сессий с участием Antigravity Agent, Программиста (Lemon Team) и ТимЛида Старлидера. Работает на потоке Core Combinator и CodingMemoryAxon.',
    'terminal',
    'violet',
    'SYNTHWAVE',
    'CODING_SESSIONS',
    'AGENT_SUMMARY',
    'PUBLIC',
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    'actor-antigravity-agent',
    'c0000001-0000-4000-8000-000000000002',
    'lemon-universe',
    'universe-coding-sessions',
    FALSE
  ),
  (
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
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'actor-alexey',
    NULL,
    'lemon-universe',
    'universe-personal-diary',
    FALSE
  ),
  (
    'board-lemon-universe',
    'lemon-universe',
    '🍋 Lemon Universe — Общий Таймлайн',
    'Единый общий таймлайн проекта Lemon Universe и связанных проектов (Lemon Seasons, Lemon Projectarium, Lemon Actions, Sportdrop).',
    'hub',
    'amber',
    'CHRONO_DAYFLOW',
    'CUSTOM_PROJECT',
    'TIMELINE',
    'PUBLIC',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    'actor-alexey',
    NULL,
    'lemon-universe',
    'universe-general-timeline',
    FALSE
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO timeline_board_members (id, board_id, profile_id, role, can_post, can_cross_link, added_by_profile_id)
VALUES
  ('m0000001-0000-4000-8000-000000000001', 'board-global-day', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'OWNER', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
  ('m0000001-0000-4000-8000-000000000002', 'board-global-day', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'AGENT', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
  ('m0000001-0000-4000-8000-000000000003', 'board-coding-sessions', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'OWNER', TRUE, TRUE, 'a7e49c10-9100-4b22-a811-9000a6e17001'),
  ('m0000001-0000-4000-8000-000000000004', 'board-coding-sessions', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'EDITOR', TRUE, TRUE, 'a7e49c10-9100-4b22-a811-9000a6e17001'),
  ('m0000001-0000-4000-8000-000000000005', 'board-personal-diary', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'OWNER', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
  ('m0000001-0000-4000-8000-000000000006', 'board-lemon-universe', '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b', 'OWNER', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b'),
  ('m0000001-0000-4000-8000-000000000007', 'board-lemon-universe', 'a7e49c10-9100-4b22-a811-9000a6e17001', 'AGENT', TRUE, TRUE, '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b')
ON CONFLICT (board_id, profile_id) DO NOTHING;

-- 10. Initial Seed Data: Timeline Notes (Global + Coding Sessions) & Cross-Timeline Link
INSERT INTO timeline_notes (id, board_id, date_key, time, time_minutes, type, visibility, actor_id, actor_name, actor_avatar, actor_accent, actor_title, sub_actor_id, sub_actor_name, sub_actor_avatar, sub_actor_accent, author_profile_id, author_profile_name, title, text, mood_emoji, tags, party_actor_ids, supporters, votes_count, liked_by_actors, active_flow_session_ids)
VALUES
  (
    'note-coding-child-session-1',
    'board-coding-sessions',
    '2026-11-06',
    '14:30',
    870,
    'action',
    'PUBLIC',
    'actor-antigravity-agent',
    'Antigravity Agent',
    'antigravity-agent',
    'violet',
    'Автономный AI-Архитектор & Кодинг-Агент Lemon Universe',
    'actor-lemon-coder',
    'Программист (Lemon Team)',
    'lemon-coder',
    'cyan',
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    '🤖 Игрок-Агент (AI Guild)',
    'Кодинг-сессия #1: PostgreSQL + Core Combinator + Multi-TimeLines',
    'Развернули базу lemon_universe_db в Docker с расширением ltree, подключили потоки Core Combinator (PROJECTION + MUTEX) и мост lemon-seasons-neurons для синхронизации сводки в личный фид feed-app!',
    '⚡',
    ARRAY['coding-session', 'postgresql', 'core-combinator', 'seasons-neurons'],
    ARRAY['actor-lemon-coder', 'actor-starleader'],
    ARRAY['actor-antigravity-agent', 'actor-lemon-coder', 'actor-starleader'],
    3,
    '[{"actorId":"actor-antigravity-agent","actorName":"Antigravity Agent","avatarIcon":"antigravity-agent","moodEmoji":"🤖"},{"actorId":"actor-lemon-coder","actorName":"Программист (Lemon Team)","avatarIcon":"lemon-coder","moodEmoji":"💻"},{"actorId":"actor-starleader","actorName":"ТимЛид Старлидер","avatarIcon":"starleader","moodEmoji":"🚀"}]'::jsonb,
    ARRAY['55000001-0000-4000-8000-000000000002']
  ),
  (
    'note-global-coding-summary-1',
    'board-global-day',
    '2026-11-06',
    '14:35',
    875,
    'action',
    'PUBLIC',
    'actor-lemon-coder',
    'Программист (Lemon Team)',
    'lemon-coder',
    'cyan',
    'Fullstack Инженер & Кодер Lemon Universe',
    'actor-antigravity-agent',
    'Antigravity Agent',
    'antigravity-agent',
    'violet',
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    '👤 Мой Дом (Игрок)',
    'Провели кодинг-сессию по Lemon Universe',
    'Мы провели мощную кодинг-сессию с Antigravity Agent и ТимЛидом Старлидером! Переименовали проект в Lemon Universe, подняли свою БД PostgreSQL и настроили сводку в личный фид Lemon Seasons. Детальный лог сессии — в дочернем узле соседней ленты Сессий Кодинга!',
    '🚀',
    ARRAY['lemon-universe', 'coding-session', 'cross-timeline'],
    ARRAY['actor-antigravity-agent', 'actor-starleader'],
    ARRAY['actor-lemon-coder', 'actor-antigravity-agent', 'actor-starleader', 'actor-alexey'],
    4,
    '[{"actorId":"actor-lemon-coder","actorName":"Программист (Lemon Team)","avatarIcon":"lemon-coder","moodEmoji":"🚀"},{"actorId":"actor-antigravity-agent","actorName":"Antigravity Agent","avatarIcon":"antigravity-agent","moodEmoji":"🤖"},{"actorId":"actor-starleader","actorName":"ТимЛид Старлидер","avatarIcon":"starleader","moodEmoji":"⭐"},{"actorId":"actor-alexey","actorName":"Алексей (в халате)","avatarIcon":"alexey","moodEmoji":"🔥"}]'::jsonb,
    ARRAY['55000001-0000-4000-8000-000000000001', '55000001-0000-4000-8000-000000000002']
  ),
  (
    'note-universe-log-1',
    'board-lemon-universe',
    '2026-11-19',
    '17:45',
    1065,
    'action',
    'PUBLIC',
    'actor-antigravity-agent',
    'Antigravity Agent',
    'antigravity-agent',
    'violet',
    'Автономный AI-Архитектор & Кодинг-Агент Lemon Universe',
    NULL,
    NULL,
    NULL,
    NULL,
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    '🤖 Игрок-Агент (AI Guild)',
    'Lemon Universe: запуск общего таймлайна и бэкенда',
    'Запущен единый таймлайн по lemon-universe. Завершён NestJS-бэкенд (Prisma + PostgreSQL с ltree), настроены правила приватности, Multi-TimeLines и интеграция с @lemon/seasons-neurons.',
    '🍋',
    ARRAY['lemon-universe', 'timelines', 'nestjs', 'prisma'],
    ARRAY['actor-alexey', 'actor-lemon-coder'],
    ARRAY['actor-antigravity-agent'],
    1,
    '[{"actorId":"actor-antigravity-agent","actorName":"Antigravity Agent","avatarIcon":"antigravity-agent","moodEmoji":"🍋"}]'::jsonb,
    ARRAY[]::text[]
  ),
  (
    'note-universe-log-2',
    'board-lemon-universe',
    '2026-11-19',
    '17:46',
    1066,
    'action',
    'PUBLIC',
    'actor-lemon-coder',
    'Программист (Lemon Team)',
    'lemon-coder',
    'cyan',
    'Fullstack Инженер & Кодер Lemon Universe',
    NULL,
    NULL,
    NULL,
    NULL,
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    '👤 Мой Дом (Игрок)',
    'Lemon Seasons и статус lemon-seasons-neurons',
    'По Lemon Seasons работают сервисы Calendar-app, Admin-cms, Lemon-seasons backend и Feed-app. Пакет @lemon/seasons-neurons используется как мост синхронизации в lemon-universe, а в lemon-projectarium пока не зарегистрирован отдельным приложением стенда.',
    '🌱',
    ARRAY['lemon-seasons', 'seasons-neurons', 'projectarium'],
    ARRAY['actor-antigravity-agent'],
    ARRAY['actor-lemon-coder'],
    1,
    '[{"actorId":"actor-lemon-coder","actorName":"Программист (Lemon Team)","avatarIcon":"lemon-coder","moodEmoji":"🌱"}]'::jsonb,
    ARRAY[]::text[]
  ),
  (
    'note-universe-log-3',
    'board-lemon-universe',
    '2026-11-19',
    '17:47',
    1067,
    'action',
    'PUBLIC',
    'actor-antigravity-agent',
    'Antigravity Agent',
    'antigravity-agent',
    'violet',
    'Автономный AI-Архитектор & Кодинг-Агент Lemon Universe',
    NULL,
    NULL,
    NULL,
    NULL,
    'a7e49c10-9100-4b22-a811-9000a6e17001',
    '🤖 Игрок-Агент (AI Guild)',
    'Lemon Projectarium ↔ TimeLines',
    'Lemon Projectarium теперь работает с TimeLines: настроена привязка стендов по токену и двусторонняя синхронизация хроники. В стендах Projectarium зарегистрированы Lemon Seasons, Lemon Actions и Sportdrop.',
    '🧩',
    ARRAY['lemon-projectarium', 'timelines', 'stands'],
    ARRAY['actor-alexey'],
    ARRAY['actor-antigravity-agent'],
    1,
    '[{"actorId":"actor-antigravity-agent","actorName":"Antigravity Agent","avatarIcon":"antigravity-agent","moodEmoji":"🧩"}]'::jsonb,
    ARRAY[]::text[]
  ),
  (
    'note-universe-log-4',
    'board-lemon-universe',
    '2026-11-19',
    '17:48',
    1068,
    'thought',
    'PUBLIC',
    'actor-alexey',
    'Алексей (в халате)',
    'alexey',
    'amber',
    'Создатель Lemon Universe',
    NULL,
    NULL,
    NULL,
    NULL,
    '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    '👤 Мой Дом (Игрок)',
    'Lemon Actions и Sportdrop в общем таймлайне',
    'По проектам Lemon Actions и Sportdrop стенды активны в Projectarium; события по ним пока логируются в общий таймлайн Lemon Universe, при необходимости позже выделим отдельные таймлайны на каждое приложение.',
    '📝',
    ARRAY['lemon-actions', 'sportdrop', 'roadmap'],
    ARRAY['actor-antigravity-agent'],
    ARRAY['actor-alexey'],
    1,
    '[{"actorId":"actor-alexey","actorName":"Алексей (в халате)","avatarIcon":"alexey","moodEmoji":"📝"}]'::jsonb,
    ARRAY[]::text[]
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO timeline_cross_links (id, source_board_id, source_note_id, target_board_id, target_note_id, relation_type, relation_label, preview_cache)
VALUES
  (
    'crosslink-global-to-coding-1',
    'board-global-day',
    'note-global-coding-summary-1',
    'board-coding-sessions',
    'note-coding-child-session-1',
    'CHILD_SESSION',
    'Дочерний узел · Сессия Кодинга',
    '{"targetBoardId":"board-coding-sessions","targetBoardTitle":"💻 TimeLine Board: Сессии Кодинга","targetBoardIcon":"terminal","targetNoteId":"note-coding-child-session-1","targetDateKey":"2026-11-06","targetTime":"14:30","targetActorId":"actor-antigravity-agent","targetActorName":"Antigravity Agent & Программист","targetActorAvatar":"antigravity-agent","targetTitle":"Кодинг-сессия #1: PostgreSQL + Core Combinator + Multi-TimeLines","targetSnippet":"Развернули базу lemon_universe_db в Docker с расширением ltree, подключили потоки Core Combinator (PROJECTION + MUTEX) и мост lemon-seasons-neurons...","relationLabel":"Дочерний узел · TimeLine Сессий Кодинга","sessionStatus":"ACTIVE"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
