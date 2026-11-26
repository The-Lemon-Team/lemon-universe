import {
  assertOptionalDateKey,
  assertOptionalTimeHm,
  getMoscowNowFormatted,
} from './timelines-mcp.contract';

export interface TimelinesMcpBackend {
  listBoards(opts: { profileId?: string; includeArchived?: boolean }): Promise<any>;
  getBoard(board: string, profileId?: string): Promise<any>;
  createBoard(dto: Record<string, any>, profileId?: string): Promise<any>;
  updateBoard(board: string, dto: Record<string, any>, profileId?: string): Promise<any>;
  getBoardMembers(board: string, profileId?: string): Promise<any>;
  upsertBoardMember(board: string, dto: Record<string, any>, profileId?: string): Promise<any>;
  removeBoardMember(board: string, targetProfileId: string, profileId?: string): Promise<any>;
  getNotes(opts: Record<string, any>): Promise<any>;
  getNoteById(noteId: string, profileId?: string): Promise<any>;
  createNote(dto: Record<string, any>, profileId?: string): Promise<any>;
  updateNote(noteId: string, dto: Record<string, any>, profileId?: string): Promise<any>;
  pinNote(noteId: string, isPinned: boolean, profileId?: string): Promise<any>;
  deleteNote(noteId: string, profileId?: string): Promise<any>;
  createCrossLink(dto: Record<string, any>, profileId?: string): Promise<any>;
  postAgentSummary(dto: Record<string, any>): Promise<any>;
  listActors(query: Record<string, any>): Promise<any>;
  getActorStats(opts: { boardId?: string; profileId?: string }): Promise<any>;
  listProfiles(): Promise<any>;
  upsertProfile(dto: Record<string, any>): Promise<any>;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) {
    throw new Error(`Missing required argument '${fieldName}'.`);
  }
  return str;
}

/** Validates, normalizes (Moscow timezone + no weather), and dispatches an MCP tool call. */
export async function executeTimelinesMcpTool(
  backend: TimelinesMcpBackend,
  name: string,
  rawArgs: Record<string, any> = {},
): Promise<unknown> {
  const args = rawArgs ?? {};

  switch (name) {
    case 'list_boards':
      return backend.listBoards({
        profileId: args.profileId,
        includeArchived: Boolean(args.includeArchived),
      });

    case 'get_board':
      return backend.getBoard(requireNonEmptyString(args.board, 'board'), args.profileId);

    case 'create_board':
      return backend.createBoard(
        {
          title: requireNonEmptyString(args.title, 'title'),
          slug: args.slug,
          description: args.description,
          hashtags: Array.isArray(args.hashtags) ? args.hashtags : undefined,
          icon: args.icon,
          colorTheme: args.colorTheme,
          boardMode: args.boardMode,
          privacy: args.privacy,
          defaultActorId: args.defaultActorId,
          memberProfileIds: Array.isArray(args.memberProfileIds) ? args.memberProfileIds : undefined,
        },
        args.profileId,
      );

    case 'update_board': {
      const board = requireNonEmptyString(args.board, 'board');
      const { board: _b, profileId, ...rest } = args;
      return backend.updateBoard(board, rest, profileId);
    }

    case 'manage_board_members': {
      const action = requireNonEmptyString(args.action, 'action');
      const board = requireNonEmptyString(args.board, 'board');
      if (action === 'list') {
        return backend.getBoardMembers(board, args.profileId);
      }
      if (action === 'upsert') {
        const targetProfileId = requireNonEmptyString(args.targetProfileId, 'targetProfileId');
        return backend.upsertBoardMember(
          board,
          {
            profileId: targetProfileId,
            role: args.role || 'MEMBER',
            canPost: args.canPost ?? true,
            canCrossLink: args.canCrossLink ?? true,
          },
          args.profileId,
        );
      }
      if (action === 'remove') {
        const targetProfileId = requireNonEmptyString(args.targetProfileId, 'targetProfileId');
        return backend.removeBoardMember(board, targetProfileId, args.profileId);
      }
      throw new Error(`Unsupported manage_board_members action '${action}'. Expected list | upsert | remove.`);
    }

    case 'get_timeline_notes': {
      const board = requireNonEmptyString(args.board, 'board');
      return backend.getNotes({
        boardId: board,
        profileId: args.profileId,
        dateKey: assertOptionalDateKey(args.dateKey, 'dateKey'),
        fromDate: assertOptionalDateKey(args.fromDate, 'fromDate'),
        toDate: assertOptionalDateKey(args.toDate, 'toDate'),
        actorId: args.actorId,
        tag: args.tag,
        search: args.search,
        limit: args.limit ?? 30,
        offset: args.offset ?? 0,
        order: args.order === 'chronological' ? 'chronological' : 'latest',
        compact: args.compact !== false,
      });
    }

    case 'get_latest_timeline_notes': {
      const board = requireNonEmptyString(args.board, 'board');
      return backend.getNotes({
        boardId: board,
        profileId: args.profileId,
        actorId: args.actorId,
        tag: args.tag,
        limit: args.limit ?? 10,
        offset: 0,
        order: 'latest',
        compact: args.compact !== false,
      });
    }

    case 'get_note':
      return backend.getNoteById(requireNonEmptyString(args.noteId, 'noteId'), args.profileId);

    case 'post_note': {
      const boardId = requireNonEmptyString(args.boardId, 'boardId');
      const text = requireNonEmptyString(args.text, 'text');
      const nowMsk = getMoscowNowFormatted();
      const dateKey = assertOptionalDateKey(args.dateKey, 'dateKey') ?? nowMsk.dateKey;
      const time = assertOptionalTimeHm(args.time, 'time') ?? nowMsk.time;

      return backend.createNote(
        {
          boardId,
          title: args.title,
          text,
          type: args.type || 'action',
          actorId: args.actorId,
          actorName: args.actorName,
          subActorId: args.subActorId,
          dateKey,
          time,
          moodEmoji: args.moodEmoji,
          tags: Array.isArray(args.tags) ? args.tags : undefined,
          replyToNoteId: args.replyToNoteId,
          sharedWithGroup: Boolean(args.sharedWithGroup),
          crossRefs: Array.isArray(args.crossRefs) ? args.crossRefs : undefined,
        },
        args.profileId,
      );
    }

    case 'patch_note': {
      const noteId = requireNonEmptyString(args.noteId, 'noteId');
      return backend.updateNote(
        noteId,
        {
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.text !== undefined ? { text: args.text } : {}),
          ...(args.type !== undefined ? { type: args.type } : {}),
          ...(args.moodEmoji !== undefined ? { moodEmoji: args.moodEmoji } : {}),
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
        },
        args.profileId,
      );
    }

    case 'pin_note':
      return backend.pinNote(
        requireNonEmptyString(args.noteId, 'noteId'),
        args.isPinned !== false,
        args.profileId,
      );

    case 'delete_note':
      return backend.deleteNote(requireNonEmptyString(args.noteId, 'noteId'), args.profileId);

    case 'create_cross_link':
      return backend.createCrossLink(
        {
          sourceBoardId: args.sourceBoardId,
          sourceNoteId: requireNonEmptyString(args.sourceNoteId, 'sourceNoteId'),
          targetBoardId: requireNonEmptyString(args.targetBoardId, 'targetBoardId'),
          targetNoteId: requireNonEmptyString(args.targetNoteId, 'targetNoteId'),
          relationType: args.relationType,
          relationLabel: args.relationLabel,
        },
        args.profileId,
      );

    case 'post_agent_summary': {
      const text = requireNonEmptyString(args.text, 'text');
      const nowMsk = getMoscowNowFormatted();
      return backend.postAgentSummary({
        agentProfileId: args.agentProfileId,
        sourceBoardId: args.sourceBoardId || 'board-coding-sessions',
        targetBoardId: args.targetBoardId,
        targetNoteId: args.targetNoteId,
        actorId: args.actorId || 'actor-antigravity-agent',
        actorName: args.actorName,
        title: args.title,
        text,
        dateKey: assertOptionalDateKey(args.dateKey, 'dateKey') ?? nowMsk.dateKey,
        time: assertOptionalTimeHm(args.time, 'time') ?? nowMsk.time,
        tags: Array.isArray(args.tags) ? args.tags : undefined,
        relationLabel: args.relationLabel,
        createAnchorOnTarget: args.createAnchorOnTarget !== false,
      });
    }

    case 'list_actors':
      return backend.listActors({
        category: args.category,
        tower: args.tower,
        search: args.search,
        isLead: args.isLead !== undefined ? String(args.isLead) : undefined,
      });

    case 'get_actor_stats':
      return backend.getActorStats({
        boardId: args.board,
        profileId: args.profileId,
      });

    case 'list_profiles':
      return backend.listProfiles();

    case 'upsert_profile':
      return backend.upsertProfile({
        handle: requireNonEmptyString(args.handle, 'handle'),
        displayName: requireNonEmptyString(args.displayName, 'displayName'),
        avatarIcon: args.avatarIcon,
        playerType: args.playerType || 'HUMAN',
        defaultFeedSlug: args.defaultFeedSlug,
      });

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}
