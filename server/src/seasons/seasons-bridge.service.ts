import { Injectable, Logger } from '@nestjs/common';
import {
  MediaIngestRequest,
  MediaLifecycleAxon,
  MediaVisibility,
} from '@lemon/media-hub-neurons';
import {
  IngestSeasonNoteInput,
  NoteMediaAttachmentInput,
  SeasonsApiClient,
  SeasonsCombinatorBridge,
  SeasonsMediaAxon,
} from '@lemon/seasons-neurons';
import { DatabaseService } from '../database/database.service';
import { BoardPrivacy, TimelineBoardMode } from '../timelines/timelines.privacy';

export interface TimelineBoardSyncTarget {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  hashtags?: string[];
  icon?: string;
  privacy: BoardPrivacy;
  boardKind: string;
  boardMode: TimelineBoardMode;
  ownerProfileId?: string | null;
  seasonsStreamSlug: string;
  seasonsFeedSlug: string;
}

export interface TimelineNoteSyncPayload {
  id: string;
  boardId: string;
  dateKey: string;
  time: string;
  type: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  subActorId?: string | null;
  authorProfileId?: string | null;
  authorProfileName?: string | null;
  title?: string | null;
  text: string;
  moodEmoji?: string | null;
  tags?: string[];
  mediaAttachments?: NoteMediaAttachmentInput[];
  crossRefs?: any[];
  replyToNoteId?: string | null;
  activeFlowSessionIds?: string[];
}

export interface MediaUploadInputDto {
  filename: string;
  mimeType: string;
  dataBase64: string;
  caption?: string;
  boardPrivacy?: BoardPrivacy;
  folderPath?: string;
  tags?: string[];
}

interface ResolvedAccountContext {
  seasonsUserId: string;
  client: SeasonsApiClient;
  bridge: SeasonsCombinatorBridge;
  mediaAxon: SeasonsMediaAxon;
}

@Injectable()
export class SeasonsBridgeService {
  private readonly logger = new Logger(SeasonsBridgeService.name);
  public readonly seasonsUrl: string;
  public readonly mediaHubUrl: string;
  private readonly defaultSeasonsToken: string;
  private readonly defaultClient: SeasonsApiClient;
  private readonly defaultBridge: SeasonsCombinatorBridge;
  private readonly mediaAxon: MediaLifecycleAxon;
  private readonly defaultSeasonsMediaAxon: SeasonsMediaAxon;
  private readonly ensuredStreams = new Set<string>();

  constructor(private readonly db: DatabaseService) {
    this.seasonsUrl = (process.env.LEMON_SEASONS_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
    this.mediaHubUrl = (process.env.LEMON_MEDIA_HUB_URL || 'http://127.0.0.1:3005').replace(/\/+$/, '');
    this.defaultSeasonsToken =
      process.env.LEMON_SEASONS_TOKEN ||
      'lenta_adm_master_permanent_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c';

    this.defaultClient = new SeasonsApiClient({
      baseUrl: this.seasonsUrl,
      token: this.defaultSeasonsToken,
    });

    this.defaultBridge = new SeasonsCombinatorBridge({
      seasons: this.defaultClient,
      defaultStreamSlug: 'lemon-universe',
      defaultPrivacy: 'private',
      bestEffortTelemetry: true,
    });

    this.mediaAxon = new MediaLifecycleAxon({
      baseUrl: this.mediaHubUrl,
      token: process.env.LEMON_MEDIA_HUB_TOKEN || this.defaultSeasonsToken,
      apiKey: process.env.LEMON_MEDIA_HUB_API_KEY,
      folderPath: 'universe/timelines',
      autoConnectSse: false,
    });

    this.defaultSeasonsMediaAxon = new SeasonsMediaAxon({
      bridge: this.defaultBridge,
      mediaAxon: this.mediaAxon,
      defaultFolderPath: 'universe/timelines',
    });
  }

  async resolveAccountId(profileId?: string | null): Promise<string | undefined> {
    if (!profileId) return undefined;
    try {
      const { rows } = await this.db.query<{ seasonsUserId: string | null }>(
        `SELECT seasons_user_id AS "seasonsUserId" FROM profiles WHERE id = $1::uuid LIMIT 1`,
        [profileId],
      );
      return rows[0]?.seasonsUserId || profileId;
    } catch {
      return profileId;
    }
  }

  private async resolveAccountContext(profileId?: string | null): Promise<ResolvedAccountContext> {
    if (!profileId) {
      return {
        seasonsUserId: 'usr-admin-master',
        client: this.defaultClient,
        bridge: this.defaultBridge,
        mediaAxon: this.defaultSeasonsMediaAxon,
      };
    }

    try {
      const { rows } = await this.db.query<{
        seasonsUserId: string | null;
        seasonsUserKey: string | null;
      }>(
        `SELECT seasons_user_id AS "seasonsUserId", seasons_user_key AS "seasonsUserKey" FROM profiles WHERE id = $1::uuid LIMIT 1`,
        [profileId],
      );
      const row = rows[0];
      const seasonsUserId = row?.seasonsUserId || profileId;
      const customKey = row?.seasonsUserKey?.trim();
      if (!customKey) {
        return {
          seasonsUserId,
          client: this.defaultClient,
          bridge: this.defaultBridge,
          mediaAxon: this.defaultSeasonsMediaAxon,
        };
      }

      const client = new SeasonsApiClient({ baseUrl: this.seasonsUrl, token: customKey });
      const bridge = new SeasonsCombinatorBridge({
        seasons: client,
        defaultStreamSlug: 'lemon-universe',
        defaultPrivacy: 'private',
        bestEffortTelemetry: true,
      });
      const mediaAxon = new SeasonsMediaAxon({
        bridge,
        mediaAxon: this.mediaAxon,
        defaultFolderPath: 'universe/timelines',
      });
      return { seasonsUserId, client, bridge, mediaAxon };
    } catch {
      return {
        seasonsUserId: profileId,
        client: this.defaultClient,
        bridge: this.defaultBridge,
        mediaAxon: this.defaultSeasonsMediaAxon,
      };
    }
  }

  async checkSeasonsHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.seasonsUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  private normalizeStreamSlug(slug?: string): string {
    const raw = (slug || 'lemon_universe').trim();
    return raw.replace(/-/g, '_');
  }

  async ensureBoardTopology(board: TimelineBoardSyncTarget): Promise<void> {
    const streamSlug = this.normalizeStreamSlug(board.seasonsStreamSlug);
    const feedSlug = board.seasonsFeedSlug || `universe-${board.slug}`;
    const privacy = board.privacy === 'PUBLIC' ? 'public' : 'private';
    const ctx = await this.resolveAccountContext(board.ownerProfileId);

    const boardHashtags = Array.from(
      new Set([
        'lemon-universe',
        `board:${board.slug}`,
        `mode:${board.boardMode.toLowerCase()}`,
        ...(Array.isArray(board.hashtags) ? board.hashtags : []),
      ]),
    );

    try {
      const streamRes = await ctx.client.ensureStream({
        slug: streamSlug,
        title: '🌌 Lemon Universe',
        description: 'Сводный поток всех досок и каналов TimeLines из Lemon Universe',
        icon: '🌌',
        color: '#8b5cf6',
        privacy: 'public',
        tags: ['lemon-universe', 'timelines'],
      }).catch(() => undefined);

      const feedRes = await ctx.client.ensureFeed({
        slug: feedSlug,
        title: board.title,
        description: board.description || undefined,
        icon: board.icon || 'timeline',
        privacy,
        hashtags: boardHashtags,
      });

      const streamId = streamRes?.id || streamSlug;
      const feedId = feedRes?.id || feedSlug;
      await ctx.client.attachFeedToStream(streamId, feedId).catch(() => undefined);

      this.ensuredStreams.add(`${streamSlug}:${privacy}`);
    } catch (err) {
      this.logger.debug(
        `Seasons topology ensure skipped (${streamSlug}/${feedSlug}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async ensureTimelinesStream(opts?: {
    streamSlug?: string;
    profileId?: string | null;
  }): Promise<{
    success: boolean;
    stream?: any;
    streamSlug: string;
    attachedFeedsCount: number;
    feeds: Array<{ slug: string; title: string; attached: boolean }>;
    error?: string;
  }> {
    const streamSlug = this.normalizeStreamSlug(opts?.streamSlug);
    const ctx = await this.resolveAccountContext(opts?.profileId);

    try {
      const streamRes = await ctx.client.ensureStream({
        slug: streamSlug,
        title: '🌌 Lemon Universe',
        description: 'Сводный поток всех досок и каналов TimeLines из Lemon Universe',
        icon: '🌌',
        color: '#8b5cf6',
        privacy: 'public',
        tags: ['lemon-universe', 'timelines', 'universe'],
      });

      const streamId = streamRes?.id || streamSlug;

      const { rows: boards } = await this.db
        .query<any>(
          `
        SELECT
          id, slug, title, description, hashtags, icon, privacy,
          board_kind AS "boardKind",
          board_mode AS "boardMode",
          seasons_stream_slug AS "seasonsStreamSlug",
          seasons_feed_slug AS "seasonsFeedSlug"
        FROM timeline_boards
        WHERE is_archived = FALSE
        ORDER BY created_at ASC
      `,
        )
        .catch(() => ({ rows: [] }));

      const feedTargets: Array<{
        slug: string;
        title: string;
        icon: string;
        privacy: 'public' | 'private';
        hashtags?: string[];
      }> = [
        {
          slug: 'universe-personal-feed',
          title: 'Личный фид Universe',
          icon: '👤',
          privacy: 'private',
          hashtags: ['lemon-universe', 'personal-feed'],
        },
      ];

      for (const b of boards) {
        const feedSlug = b.seasonsFeedSlug || `universe-${b.slug}`;
        if (!feedTargets.some((f) => f.slug === feedSlug)) {
          feedTargets.push({
            slug: feedSlug,
            title: b.title || feedSlug,
            icon: b.icon || 'timeline',
            privacy: b.privacy === 'PUBLIC' ? 'public' : 'private',
            hashtags: Array.isArray(b.hashtags) ? b.hashtags : [],
          });
        }
      }

      const results: Array<{ slug: string; title: string; attached: boolean }> = [];
      let attachedCount = 0;

      for (const f of feedTargets) {
        try {
          const feedRes = await ctx.client.ensureFeed({
            slug: f.slug,
            title: f.title,
            icon: f.icon,
            privacy: f.privacy,
            hashtags: ['lemon-universe', ...(f.hashtags || [])],
          });
          const feedId = feedRes?.id || f.slug;
          await ctx.client.attachFeedToStream(streamId, feedId).catch(() => undefined);
          results.push({ slug: f.slug, title: f.title, attached: true });
          attachedCount++;
        } catch {
          results.push({ slug: f.slug, title: f.title, attached: false });
        }
      }

      this.ensuredStreams.add(`${streamSlug}:public`);
      this.ensuredStreams.add(`${streamSlug}:private`);

      return {
        success: true,
        stream: streamRes,
        streamSlug,
        attachedFeedsCount: attachedCount,
        feeds: results,
      };
    } catch (err) {
      return {
        success: false,
        streamSlug,
        attachedFeedsCount: 0,
        feeds: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async fetchSeasonsStream(rawSlug?: string, profileId?: string) {
    try {
      const streamSlug = this.normalizeStreamSlug(rawSlug);
      const ctx = await this.resolveAccountContext(profileId);
      const stream = await ctx.client.ensureStream({
        slug: streamSlug,
        title: '🌌 Lemon Universe',
        description: 'Сводный поток всех досок и каналов TimeLines из Lemon Universe',
        icon: '🌌',
        color: '#8b5cf6',
        privacy: 'public',
        tags: ['lemon-universe', 'timelines', 'universe'],
      });
      return {
        connected: true,
        stream,
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async uploadMediaAttachment(input: MediaUploadInputDto): Promise<{
    uploadedToHub: boolean;
    attachment: NoteMediaAttachmentInput;
  }> {
    const cleanBase64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const visibility: MediaVisibility = input.boardPrivacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';

    try {
      const req: MediaIngestRequest = {
        file: buffer,
        filename: input.filename,
        mimeType: input.mimeType || 'image/png',
        folderPath: input.folderPath || 'universe/timelines',
        visibility,
        title: input.caption || input.filename,
        tags: ['lemon-universe', 'timelines', ...(input.tags || [])],
      };

      const ingested = await this.mediaAxon.addMedia(req);
      let resolvedView: any;
      try {
        resolvedView = await this.mediaAxon.viewMedia({
          assetId: ingested.asset.id,
          trackUsage: false,
        });
      } catch {
        resolvedView = undefined;
      }

      return {
        uploadedToHub: true,
        attachment: this.defaultSeasonsMediaAxon.toNoteAttachment(ingested.asset, {
          isMain: true,
          caption: input.caption,
          resolvedView,
        }),
      };
    } catch (err) {
      this.logger.warn(
        `Media Hub offline/unavailable, returning inline data attachment fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const dataUrl = input.dataBase64.startsWith('data:')
        ? input.dataBase64
        : `data:${input.mimeType || 'image/png'};base64,${cleanBase64}`;
      return {
        uploadedToHub: false,
        attachment: {
          url: dataUrl,
          thumbnailUrl: dataUrl,
          filename: input.filename,
          mimeType: input.mimeType || 'image/png',
          sizeBytes: buffer.byteLength,
          caption: input.caption,
          isMain: true,
        },
      };
    }
  }

  async syncTimelineNote(
    note: TimelineNoteSyncPayload,
    board: TimelineBoardSyncTarget,
  ): Promise<{ synced: boolean; noteId?: string; externalId: string; seasonsAccountId?: string; error?: string }> {
    const origin =
      board.boardMode === 'AGENT_SUMMARY' || board.boardKind === 'CODING_SESSIONS'
        ? 'CODING_AGENT'
        : board.boardMode === 'DIARY'
          ? 'TIMELINE_DIARY'
          : 'NEURON_PARTY';

    const noteType =
      note.type === 'action' ? 'DONE' : note.type === 'proposal' ? 'EVENT' : 'SINGLE';

    const externalId = `${origin.toLowerCase()}:${board.id}:${note.id}`;
    const privacy: 'public' | 'private' = board.privacy === 'PUBLIC' ? 'public' : 'private';
    const feedSlug = board.seasonsFeedSlug || `universe-${board.slug}`;
    const streamSlug = this.normalizeStreamSlug(board.seasonsStreamSlug);

    const ctx = await this.resolveAccountContext(note.authorProfileId || board.ownerProfileId);
    const summaryText = note.text.replace(/\s+/g, ' ').trim();
    const title = note.title?.trim() || `${note.actorName}: ${summaryText.slice(0, 64)}`;

    const mediaList = Array.isArray(note.mediaAttachments) ? note.mediaAttachments : [];
    const existingAssetIds = mediaList
      .map((m) => m.mediaAssetId)
      .filter((id): id is string => Boolean(id));

    const ingestInput: IngestSeasonNoteInput = {
      externalId,
      title,
      content: note.text,
      summary: summaryText.slice(0, 180),
      type: noteType,
      privacy,
      ownerUserId: ctx.seasonsUserId,
      status: 'PUBLISHED',
      feedSlug,
      streamSlug,
      author: note.actorId,
      parentNoteId: note.replyToNoteId || undefined,
      startDate: `${note.dateKey}T${note.time.length === 5 ? `${note.time}:00` : note.time}Z`,
      icon: note.moodEmoji || '🍋',
      tags: Array.from(
        new Set([
          ...(note.tags || []),
          'lemon-universe',
          `board:${board.slug}`,
          `mode:${board.boardMode.toLowerCase()}`,
          `privacy:${privacy}`,
          `actor:${note.actorId}`,
          ...(note.authorProfileId ? [`user:${note.authorProfileId}`] : []),
        ]),
      ),
      origin,
      images: mediaList.length > 0 ? mediaList : undefined,
      mediaAssetIds: existingAssetIds.length > 0 ? existingAssetIds : undefined,
      metadata: {
        lemonUniverseKind: 'TimelineNote',
        boardId: board.id,
        boardTitle: board.title,
        boardMode: board.boardMode,
        boardPrivacy: board.privacy,
        partyNoteId: note.id,
        dateKey: note.dateKey,
        time: note.time,
        actorId: note.actorId,
        actorName: note.actorName,
        actorAvatar: note.actorAvatar,
        subActorId: note.subActorId ?? null,
        authorProfileId: note.authorProfileId ?? null,
        authorProfileName: note.authorProfileName ?? null,
        seasonsAccountId: ctx.seasonsUserId,
        crossRefs: note.crossRefs || [],
        activeFlowSessionIds: note.activeFlowSessionIds || [],
      },
    };

    try {
      await this.ensureBoardTopology(board);
      const res =
        existingAssetIds.length > 0 || mediaList.length > 0
          ? await ctx.mediaAxon.ingestNoteWithMedia({
              note: ingestInput,
              existingAssetIds,
            })
          : await ctx.bridge.ingestNote(ingestInput);

      if (res.noteId) {
        await this.db
          .query(
            `UPDATE timeline_notes
             SET seasons_note_id = $1,
                 seasons_external_id = $2,
                 seasons_account_id = $3,
                 seasons_synced_at = NOW()
             WHERE id = $4`,
            [res.noteId, externalId, ctx.seasonsUserId, note.id],
          )
          .catch(() => undefined);
      }

      return {
        synced: true,
        noteId: res.noteId,
        externalId,
        seasonsAccountId: ctx.seasonsUserId,
      };
    } catch (err) {
      return {
        synced: false,
        externalId,
        seasonsAccountId: ctx.seasonsUserId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async deleteSeasonsNote(seasonsNoteId?: string | null, authorProfileId?: string | null): Promise<void> {
    if (!seasonsNoteId) return;
    try {
      const ctx = await this.resolveAccountContext(authorProfileId);
      await ctx.client.deleteNote(seasonsNoteId);
    } catch (err) {
      this.logger.debug(
        `Seasons note delete skipped (${seasonsNoteId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async shareSeasonsNoteToGroup(input: {
    seasonsNoteId: string;
    ownerProfileId?: string | null;
    granteeProfileIds: string[];
    boardId: string;
  }): Promise<{ sharedCount: number }> {
    const ctx = await this.resolveAccountContext(input.ownerProfileId);
    const granteeUserIds = (
      await Promise.all(input.granteeProfileIds.map((pid) => this.resolveAccountId(pid)))
    ).filter((id): id is string => Boolean(id && id !== ctx.seasonsUserId));

    if (granteeUserIds.length === 0) return { sharedCount: 0 };

    try {
      const rows = await ctx.client.shareNote(input.seasonsNoteId, {
        granteeUserIds,
        scopeType: 'TIMELINE_GROUP',
        scopeRef: input.boardId,
        canReadMedia: true,
      });
      return { sharedCount: Array.isArray(rows) ? rows.length : granteeUserIds.length };
    } catch (err) {
      this.logger.debug(
        `Seasons NoteShare sync skipped (${input.seasonsNoteId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { sharedCount: 0 };
    }
  }

  async revokeSeasonsNoteShare(input: {
    seasonsNoteId: string;
    ownerProfileId?: string | null;
    granteeProfileId?: string;
    boardId?: string;
  }): Promise<void> {
    try {
      const ctx = await this.resolveAccountContext(input.ownerProfileId);
      const granteeUserId = input.granteeProfileId
        ? await this.resolveAccountId(input.granteeProfileId)
        : undefined;
      await ctx.client.revokeNoteShare(input.seasonsNoteId, {
        granteeUserId,
        scopeRef: input.boardId,
      });
    } catch {
      // Non-blocking
    }
  }

  async shareSeasonsFeedToMember(input: {
    feedSlug: string;
    ownerProfileId?: string | null;
    granteeProfileId: string;
    permission?: 'READ' | 'WRITE';
  }): Promise<void> {
    try {
      const ctx = await this.resolveAccountContext(input.ownerProfileId);
      const granteeUserId = await this.resolveAccountId(input.granteeProfileId);
      if (!granteeUserId || granteeUserId === ctx.seasonsUserId) return;
      await ctx.client.shareFeed(input.feedSlug, {
        granteeUserId,
        permission: input.permission || 'READ',
      });
    } catch {
      // Non-blocking
    }
  }

  async revokeSeasonsFeedShare(input: {
    feedSlug: string;
    ownerProfileId?: string | null;
    granteeProfileId: string;
  }): Promise<void> {
    try {
      const ctx = await this.resolveAccountContext(input.ownerProfileId);
      const granteeUserId = await this.resolveAccountId(input.granteeProfileId);
      if (!granteeUserId) return;
      await ctx.client.revokeFeedShare(input.feedSlug, granteeUserId);
    } catch {
      // Non-blocking
    }
  }

  async fetchSeasonsFeedNotes(opts: {
    feedSlug?: string;
    profileId?: string;
    limit?: number;
  }) {
    try {
      const ctx = await this.resolveAccountContext(opts.profileId);
      const page = opts.feedSlug
        ? await ctx.client.getFeedNotesPage(opts.feedSlug, { limit: opts.limit ?? 30 })
        : await ctx.client.getNotesPage({ streamSource: 'lemon-universe', limit: opts.limit ?? 30 });
      return {
        connected: true,
        seasonsAccountId: ctx.seasonsUserId,
        ...page,
      };
    } catch (err) {
      return {
        connected: false,
        total: 0,
        limit: opts.limit ?? 30,
        offset: 0,
        hasMore: false,
        items: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async ingestRawNotePayload(payload: IngestSeasonNoteInput & { metadata?: Record<string, any> }) {
    try {
      const streamSlug = this.normalizeStreamSlug(payload.streamSlug);
      const feedSlug = payload.feedSlug || 'universe-personal-feed';
      const privacy = payload.privacy === 'public' ? 'public' : 'private';
      const profileId = payload.metadata?.authorProfileId as string | undefined;
      const ctx = await this.resolveAccountContext(profileId);

      await ctx.bridge
        .ensureTopology({
          streamSlug,
          streamTitle: '🌌 Lemon Universe',
          feeds: [
            {
              slug: feedSlug,
              title: payload.metadata?.boardTitle || feedSlug,
              icon: '🍋',
              privacy,
            },
          ],
        })
        .catch(() => undefined);

      const res = await ctx.mediaAxon.ingestNoteWithMedia({
        note: {
          ...payload,
          ownerUserId: payload.ownerUserId || ctx.seasonsUserId,
        },
        existingAssetIds: payload.mediaAssetIds,
      });

      if (payload.metadata?.partyNoteId && res.noteId) {
        await this.db
          .query(
            `UPDATE timeline_notes
             SET seasons_note_id = $1,
                 seasons_external_id = $2,
                 seasons_account_id = $3,
                 seasons_synced_at = NOW()
             WHERE id = $4`,
            [res.noteId, payload.externalId || null, ctx.seasonsUserId, payload.metadata.partyNoteId],
          )
          .catch(() => undefined);
      }

      return { synced: true, ...res };
    } catch (err) {
      return {
        synced: false,
        queuedInPersonalFeed: true,
        error: err instanceof Error ? err.message : String(err),
        noteId: payload.externalId || `seasons-local-${Date.now()}`,
        feedSlug: payload.feedSlug || 'universe-personal-feed',
        streamSlug: payload.streamSlug || 'lemon-universe',
      };
    }
  }
}
