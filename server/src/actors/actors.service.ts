import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ACTORS_SEED, ArenaAccentColor, ArenaActorCardDto, ArenaActorCategory } from './actors.seed';

export interface ListActorsQuery {
  category?: string;
  search?: string;
  tower?: string;
  isLead?: string;
}

const TOWER_NEEDLES: Record<string, string[]> = {
  FIRE: ['fire', 'огонь', 'башня огня'],
  AIR: ['air', 'воздух', 'башня воздуха'],
  EARTH: ['earth', 'земля', 'башня земли'],
  WATER: ['water', 'вода', 'башня воды'],
};

const SEED_BY_ID = new Map(ACTORS_SEED.map((a) => [a.id, a]));

@Injectable()
export class ActorsService implements OnModuleInit {
  private readonly logger = new Logger(ActorsService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedCanonicalActors();
    } catch (err) {
      this.logger.warn(
        `Actors seed skipped or failed (PostgreSQL offline?): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Idempotently ensures all canonical Lemon Universe character cards exist in PostgreSQL. */
  async seedCanonicalActors(): Promise<void> {
    for (const actor of ACTORS_SEED) {
      await this.db.query(
        `
          INSERT INTO arena_actors (
            id, handle, flow_id, owner_profile_id, name, title, category, category_label,
            avatar_icon, accent_color, rank_label, quote, paradox_philosophy, favorite_desire,
            affinities, traits, sample_voices, is_lead, voice_pitch, voice_rate, voices_count
          ) VALUES (
            $1, $2, $3, $4::uuid, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16::jsonb, $17::jsonb, $18, $19, $20, $21
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            category_label = EXCLUDED.category_label,
            affinities = EXCLUDED.affinities,
            voice_pitch = CASE WHEN arena_actors.voice_pitch = 1.0 THEN EXCLUDED.voice_pitch ELSE arena_actors.voice_pitch END,
            voice_rate = CASE WHEN arena_actors.voice_rate = 1.0 THEN EXCLUDED.voice_rate ELSE arena_actors.voice_rate END,
            voices_count = CASE WHEN arena_actors.voices_count = 0 THEN EXCLUDED.voices_count ELSE arena_actors.voices_count END
        `,
        [
          actor.id,
          actor.handle,
          actor.flowId,
          actor.ownerProfileId ?? null,
          actor.name,
          actor.title,
          actor.category,
          actor.categoryLabel,
          actor.avatarIcon,
          actor.accentColor,
          actor.rankLabel,
          actor.quote,
          actor.paradoxPhilosophy,
          actor.favoriteDesire,
          actor.affinities,
          JSON.stringify(actor.traits),
          JSON.stringify(actor.sampleVoices),
          actor.isLead,
          actor.voicePitch,
          actor.voiceRate,
          actor.voicesCount,
        ],
      );
    }
  }

  async findAll(query: ListActorsQuery = {}): Promise<ArenaActorCardDto[]> {
    let cards: ArenaActorCardDto[];
    try {
      const { rows } = await this.db.query(
        `
          SELECT
            id,
            handle,
            flow_id AS "flowId",
            owner_profile_id::text AS "ownerProfileId",
            name,
            title,
            category,
            category_label AS "categoryLabel",
            avatar_icon AS "avatarIcon",
            accent_color AS "accentColor",
            rank_label AS "rankLabel",
            quote,
            paradox_philosophy AS "paradoxPhilosophy",
            favorite_desire AS "favoriteDesire",
            COALESCE(affinities, '{}'::text[]) AS affinities,
            traits,
            sample_voices AS "sampleVoices",
            is_lead AS "isLead",
            voice_pitch AS "voicePitch",
            voice_rate AS "voiceRate",
            voices_count AS "voicesCount",
            created_at AS "createdAt"
          FROM arena_actors
          ORDER BY is_lead DESC, created_at ASC, name ASC
        `,
      );
      cards = rows.length > 0 ? rows.map((row) => this.mapRowToCard(row)) : [...ACTORS_SEED];
    } catch {
      cards = [...ACTORS_SEED];
    }

    return this.filterCards(cards, query);
  }

  async findOne(idOrHandle: string): Promise<ArenaActorCardDto> {
    const clean = (idOrHandle || '').trim();
    if (!clean) {
      throw new NotFoundException('Идентификатор персонажа обязателен.');
    }

    try {
      const { rows } = await this.db.query(
        `
          SELECT
            id,
            handle,
            flow_id AS "flowId",
            owner_profile_id::text AS "ownerProfileId",
            name,
            title,
            category,
            category_label AS "categoryLabel",
            avatar_icon AS "avatarIcon",
            accent_color AS "accentColor",
            rank_label AS "rankLabel",
            quote,
            paradox_philosophy AS "paradoxPhilosophy",
            favorite_desire AS "favoriteDesire",
            COALESCE(affinities, '{}'::text[]) AS affinities,
            traits,
            sample_voices AS "sampleVoices",
            is_lead AS "isLead",
            voice_pitch AS "voicePitch",
            voice_rate AS "voiceRate",
            voices_count AS "voicesCount",
            created_at AS "createdAt"
          FROM arena_actors
          WHERE id = $1 OR LOWER(handle) = LOWER($1)
          LIMIT 1
        `,
        [clean],
      );
      if (rows[0]) {
        return this.mapRowToCard(rows[0]);
      }
    } catch {
      // Fallback to in-memory seed below when DB is unavailable
    }

    const fromSeed = ACTORS_SEED.find(
      (a) => a.id === clean || a.handle.toLowerCase() === clean.toLowerCase(),
    );
    if (!fromSeed) {
      throw new NotFoundException(`Персонаж '${clean}' не найден.`);
    }
    return fromSeed;
  }

  mapRowToCard(row: any): ArenaActorCardDto {
    const seed = SEED_BY_ID.get(row.id);
    const traits = (row.traits && typeof row.traits === 'object' ? row.traits : {}) as Record<string, any>;
    const sampleVoices = (
      row.sampleVoices && typeof row.sampleVoices === 'object' ? row.sampleVoices : {}
    ) as Record<string, any>;

    return {
      id: row.id,
      handle: row.handle,
      flowId: row.flowId || seed?.flowId || `flow-${row.id}`,
      ownerProfileId: row.ownerProfileId ?? seed?.ownerProfileId ?? null,
      name: row.name,
      title: row.title,
      category: (row.category || seed?.category || 'HUMAN') as ArenaActorCategory,
      categoryLabel: row.categoryLabel || seed?.categoryLabel || '',
      avatarIcon: row.avatarIcon || seed?.avatarIcon || 'person',
      accentColor: (row.accentColor || seed?.accentColor || 'amber') as ArenaAccentColor,
      rankLabel: row.rankLabel || seed?.rankLabel || '',
      quote: row.quote || seed?.quote || '',
      paradoxPhilosophy: row.paradoxPhilosophy || seed?.paradoxPhilosophy || '',
      favoriteDesire: row.favoriteDesire || seed?.favoriteDesire || '',
      affinities: Array.isArray(row.affinities) ? row.affinities : seed?.affinities || [],
      traits: {
        charisma: Number(traits.charisma ?? seed?.traits.charisma ?? 80),
        analytical: Number(traits.analytical ?? seed?.traits.analytical ?? 80),
        rebelVersus: Number(traits.rebelVersus ?? seed?.traits.rebelVersus ?? 50),
      },
      voicePitch: Number(row.voicePitch ?? seed?.voicePitch ?? 1.0),
      voiceRate: Number(row.voiceRate ?? seed?.voiceRate ?? 1.0),
      sampleVoices: {
        support: String(sampleVoices.support ?? seed?.sampleVoices.support ?? ''),
        counter: String(sampleVoices.counter ?? seed?.sampleVoices.counter ?? ''),
        paradox: String(sampleVoices.paradox ?? seed?.sampleVoices.paradox ?? ''),
      },
      isLead: Boolean(row.isLead),
      voicesCount: Number(row.voicesCount ?? seed?.voicesCount ?? 0),
      ...(row.createdAt ? { createdAt: new Date(row.createdAt).toISOString() } : {}),
    };
  }

  filterCards(cards: ArenaActorCardDto[], query: ListActorsQuery): ArenaActorCardDto[] {
    const category = query.category?.trim().toUpperCase();
    const search = query.search?.trim().toLowerCase();
    const tower = query.tower?.trim().toUpperCase();
    const isLeadParam = query.isLead?.trim().toLowerCase();

    return cards.filter((actor) => {
      if (category && category !== 'ALL' && actor.category.toUpperCase() !== category) {
        return false;
      }
      if (isLeadParam === 'true' && !actor.isLead) return false;
      if (isLeadParam === 'false' && actor.isLead) return false;

      if (tower) {
        const needles = TOWER_NEEDLES[tower] ?? [tower.toLowerCase()];
        const haystack = `${actor.title} ${actor.categoryLabel} ${actor.affinities.join(' ')}`.toLowerCase();
        if (!needles.some((needle) => haystack.includes(needle))) {
          return false;
        }
      }

      if (search) {
        const haystack = [
          actor.id,
          actor.handle,
          actor.name,
          actor.title,
          actor.categoryLabel,
          actor.rankLabel,
          actor.quote,
          actor.favoriteDesire,
          ...actor.affinities,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }
}
