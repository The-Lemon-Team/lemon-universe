import type { OpenAPIObject } from '@nestjs/swagger';

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: Record<string, unknown>;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  example?: unknown;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  /** Optional Swagger DTO schema name to sync property metadata with OpenAPI. */
  swaggerDto?: string;
  /** Property names omitted from the Swagger DTO when building MCP schema (e.g. weather). */
  excludeFields?: string[];
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

export interface SwaggerMcpSyncReport {
  syncedTools: string[];
  missingSchemas: string[];
  syncedAt: string;
}

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const TIME_PATTERN = '^\\d{2}:\\d{2}$';

export const TIMELINES_MCP_INSTRUCTIONS =
  'Lemon Universe TimeLines MCP Server. ' +
  'Use list_boards / get_board to inspect boards, get_timeline_notes / get_latest_timeline_notes to read notes of a specific timeline (accepts board ID or slug), ' +
  'post_note / post_agent_summary to publish structured reports (defaults to Europe/Moscow date/time and resolves actor metadata by actorId), ' +
  'and create_cross_link to link notes across boards. Weather module is intentionally excluded at this stage.';

export const TIMELINES_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_boards',
    description: 'List visible TimeLine boards (returns board id, slug, title, privacy, boardMode, defaultActorId, notesCount, and members).',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string', description: 'Optional caller profile UUID (defaults to system human profile).' },
        includeArchived: { type: 'boolean', description: 'Include archived boards (default: false).', default: false },
      },
    },
  },
  {
    name: 'get_board',
    description: 'Get a single TimeLine board by board ID (e.g. "board-tower-fire") or slug (e.g. "tower-fire", "coding-sessions").',
    inputSchema: {
      type: 'object',
      properties: {
        board: { type: 'string', description: 'Board ID or slug.' },
        profileId: { type: 'string', description: 'Optional caller profile UUID.' },
      },
      required: ['board'],
    },
  },
  {
    name: 'create_board',
    description: 'Create a new TimeLine board and its Core Combinator flow.',
    swaggerDto: 'CreateBoardDto',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Human-readable title of the TimeLine board.' },
        slug: { type: 'string', description: 'Optional URL-safe slug.' },
        description: { type: 'string', description: 'Board description.' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Board hashtags.' },
        icon: { type: 'string', description: 'Material symbol icon name.' },
        colorTheme: { type: 'string', description: 'Accent color theme.' },
        boardMode: { type: 'string', enum: ['TIMELINE', 'DIARY'], default: 'TIMELINE', description: 'Board display mode.' },
        privacy: { type: 'string', enum: ['PUBLIC', 'PRIVATE'], default: 'PRIVATE', description: 'Privacy contour.' },
        defaultActorId: { type: 'string', description: 'Default character/actor ID for this board.' },
        memberProfileIds: { type: 'array', items: { type: 'string' }, description: 'Initial member profile UUIDs.' },
        profileId: { type: 'string', description: 'Caller/owner profile UUID.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_board',
    description: 'Update settings, title, description, privacy, defaultActorId, or archive state of an existing TimeLine board.',
    swaggerDto: 'UpdateBoardDto',
    inputSchema: {
      type: 'object',
      properties: {
        board: { type: 'string', description: 'Board ID or slug.' },
        title: { type: 'string', description: 'Board title.' },
        description: { type: 'string', description: 'Board description.' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Board hashtags.' },
        icon: { type: 'string', description: 'Material symbol icon name.' },
        colorTheme: { type: 'string', description: 'Accent color theme.' },
        boardMode: { type: 'string', enum: ['TIMELINE', 'DIARY'], description: 'Board mode.' },
        privacy: { type: 'string', enum: ['PUBLIC', 'PRIVATE'], description: 'Board privacy.' },
        defaultActorId: { type: 'string', nullable: true, description: 'Default actor ID or null to clear.' },
        isArchived: { type: 'boolean', description: 'Archive flag.' },
        profileId: { type: 'string', description: 'Caller profile UUID (must be owner/editor).' },
      },
      required: ['board'],
    },
  },
  {
    name: 'manage_board_members',
    description: 'List, add/update, or remove members (humans or AI agents) of a TimeLine board.',
    swaggerDto: 'UpsertBoardMemberDto',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'upsert', 'remove'], description: 'Operation to perform on board members.' },
        board: { type: 'string', description: 'Board ID or slug.' },
        targetProfileId: { type: 'string', description: 'Target member profile UUID (required for upsert/remove).' },
        role: { type: 'string', enum: ['OWNER', 'EDITOR', 'MEMBER', 'AGENT', 'VIEWER'], default: 'MEMBER', description: 'Member role.' },
        canPost: { type: 'boolean', default: true, description: 'Whether member can post notes.' },
        canCrossLink: { type: 'boolean', default: true, description: 'Whether member can create cross-links.' },
        profileId: { type: 'string', description: 'Caller profile UUID.' },
      },
      required: ['action', 'board'],
    },
  },
  {
    name: 'get_timeline_notes',
    description:
      'Get notes of a specific TimeLine board (by ID or slug) with date, date-range, actor, tag, search, ordering, and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        board: { type: 'string', description: 'Target TimeLine board ID or slug (e.g. "coding-sessions", "board-tower-fire").' },
        dateKey: { type: 'string', pattern: DATE_PATTERN, description: 'Exact date filter YYYY-MM-DD.' },
        fromDate: { type: 'string', pattern: DATE_PATTERN, description: 'Start date inclusive YYYY-MM-DD.' },
        toDate: { type: 'string', pattern: DATE_PATTERN, description: 'End date inclusive YYYY-MM-DD.' },
        actorId: { type: 'string', description: 'Filter by actorId or subActorId (e.g. "actor-hades").' },
        tag: { type: 'string', description: 'Filter by hashtag (with or without #).' },
        search: { type: 'string', description: 'Case-insensitive text/title/tag search query.' },
        limit: { type: 'number', minimum: 1, maximum: 200, default: 30, description: 'Maximum number of notes to return (1..200, default 30).' },
        offset: { type: 'number', minimum: 0, default: 0, description: 'Pagination offset.' },
        order: { type: 'string', enum: ['latest', 'chronological'], default: 'latest', description: 'Sort order: "latest" (newest first) or "chronological".' },
        compact: { type: 'boolean', default: true, description: 'Return lightweight notes without mediaAttachments/heavy metadata (default: true). Pass false for full objects.' },
        profileId: { type: 'string', description: 'Optional caller profile UUID.' },
      },
      required: ['board'],
    },
  },
  {
    name: 'get_latest_timeline_notes',
    description: 'Quickly fetch the N most recent notes of a specific TimeLine board (by ID or slug), newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        board: { type: 'string', description: 'Target TimeLine board ID or slug.' },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 10, description: 'Number of latest notes (default 10).' },
        actorId: { type: 'string', description: 'Optional actorId filter.' },
        tag: { type: 'string', description: 'Optional hashtag filter.' },
        compact: { type: 'boolean', default: true, description: 'Return lightweight notes without mediaAttachments/heavy metadata (default: true).' },
        profileId: { type: 'string', description: 'Optional caller profile UUID.' },
      },
      required: ['board'],
    },
  },
  {
    name: 'get_note',
    description: 'Get a single TimeLine note by noteId together with its crossRefs and boardSlug.',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Note ID (e.g. "note-...").' },
        profileId: { type: 'string', description: 'Optional caller profile UUID.' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'post_note',
    description:
      'Create a structured note on a specific TimeLine board. Resolves board slug->id, auto-resolves actorName/avatar by actorId, and defaults dateKey/time to Europe/Moscow (+03:00).',
    swaggerDto: 'CreateNoteDto',
    excludeFields: ['weather', 'worldMoment'],
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Target TimeLine board ID or slug (e.g. "coding-sessions", "tower-fire").' },
        title: { type: 'string', description: 'Short headline/title of the note.' },
        text: { type: 'string', description: 'Main markdown/text content of the note.' },
        type: { type: 'string', enum: ['thought', 'action', 'proposal'], default: 'action', description: 'Note type.' },
        actorId: { type: 'string', description: 'Character/Actor ID (e.g. "actor-hades", "actor-akin", "actor-antigravity-agent").' },
        actorName: { type: 'string', description: 'Optional display name (auto-resolved from actorId if omitted).' },
        subActorId: { type: 'string', description: 'Optional co-author sub-character ID.' },
        dateKey: { type: 'string', pattern: DATE_PATTERN, description: 'Date YYYY-MM-DD (defaults to today in Europe/Moscow).' },
        time: { type: 'string', pattern: TIME_PATTERN, description: 'Time HH:mm (defaults to current time in Europe/Moscow).' },
        moodEmoji: { type: 'string', default: '💭', description: 'Mood emoji.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags (merged with inline #hashtags from text).' },
        replyToNoteId: { type: 'string', description: 'Optional parent note ID to reply to.' },
        sharedWithGroup: { type: 'boolean', default: false, description: 'Share synced Seasons note with board group.' },
        crossRefs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              targetBoardId: { type: 'string' },
              targetNoteId: { type: 'string' },
              relationLabel: { type: 'string' },
            },
            required: ['targetBoardId', 'targetNoteId'],
          },
          description: 'Optional cross-links to attach immediately.',
        },
        profileId: { type: 'string', description: 'Author profile UUID (defaults to agent profile if omitted in agent tools or human profile).' },
      },
      required: ['boardId', 'text'],
    },
  },
  {
    name: 'patch_note',
    description: 'Update title, text, type, moodEmoji, or tags of an existing note.',
    swaggerDto: 'UpdateNoteDto',
    excludeFields: ['weather', 'worldMoment'],
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Existing note ID.' },
        title: { type: 'string', description: 'Updated note title.' },
        text: { type: 'string', description: 'Updated note text.' },
        type: { type: 'string', enum: ['thought', 'action', 'proposal'], description: 'Note type.' },
        moodEmoji: { type: 'string', description: 'Mood emoji.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags.' },
        profileId: { type: 'string', description: 'Caller profile UUID (must be author or board owner/editor).' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'pin_note',
    description: 'Pin or unpin a note on its board (requires board owner permissions).',
    swaggerDto: 'PinNoteDto',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Note ID.' },
        isPinned: { type: 'boolean', default: true, description: 'Whether note should be pinned.' },
        profileId: { type: 'string', description: 'Board owner profile UUID.' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note by ID (requires author or board owner/editor permissions).',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Note ID to delete.' },
        profileId: { type: 'string', description: 'Caller profile UUID.' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'create_cross_link',
    description: 'Create a cross-link between two notes across TimeLine boards within the same privacy contour.',
    swaggerDto: 'CreateCrossLinkDto',
    inputSchema: {
      type: 'object',
      properties: {
        sourceBoardId: { type: 'string', description: 'Optional source board ID or slug.' },
        sourceNoteId: { type: 'string', description: 'Source note ID.' },
        targetBoardId: { type: 'string', description: 'Target board ID or slug.' },
        targetNoteId: { type: 'string', description: 'Target note ID.' },
        relationType: { type: 'string', default: 'CROSS_TIMELINE_REF', description: 'Relation type.' },
        relationLabel: { type: 'string', description: 'Human-readable relation label.' },
        profileId: { type: 'string', description: 'Caller profile UUID.' },
      },
      required: ['sourceNoteId', 'targetBoardId', 'targetNoteId'],
    },
  },
  {
    name: 'post_agent_summary',
    description:
      'Publish an AI agent summary note onto sourceBoardId (default: board-coding-sessions) and optionally create a cross-linked anchor on targetBoardId (e.g. board-tower-fire or board-lemon-space).',
    swaggerDto: 'AgentSummaryDto',
    inputSchema: {
      type: 'object',
      properties: {
        agentProfileId: { type: 'string', description: 'Agent profile UUID (defaults to Antigravity Agent profile).' },
        sourceBoardId: { type: 'string', default: 'board-coding-sessions', description: 'Source board ID or slug for the full summary.' },
        targetBoardId: { type: 'string', description: 'Optional target board ID or slug for cross-linked anchor note.' },
        targetNoteId: { type: 'string', description: 'Optional existing target note ID instead of creating an anchor note.' },
        actorId: { type: 'string', default: 'actor-antigravity-agent', description: 'Actor ID (e.g. "actor-hades", "actor-akin").' },
        actorName: { type: 'string', description: 'Optional actor name (auto-resolved from actorId if omitted).' },
        title: { type: 'string', description: 'Summary title.' },
        text: { type: 'string', description: 'Summary markdown/text body.' },
        dateKey: { type: 'string', pattern: DATE_PATTERN, description: 'Date YYYY-MM-DD (defaults to today in Europe/Moscow).' },
        time: { type: 'string', pattern: TIME_PATTERN, description: 'Time HH:mm (defaults to current time in Europe/Moscow).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags.' },
        relationLabel: { type: 'string', description: 'Custom cross-link label.' },
        createAnchorOnTarget: { type: 'boolean', default: true, description: 'Create an anchor note on targetBoardId when targetNoteId is omitted.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_actors',
    description: 'List canonical Lemon Universe characters (actors) filtered by category, tower (FIRE/AIR/EARTH/WATER), search, or isLead.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Actor category filter (e.g. LEAD, SAGE, MYTHIC, HUMAN, AI_AGENT).' },
        tower: { type: 'string', enum: ['FIRE', 'AIR', 'EARTH', 'WATER'], description: 'Filter actors belonging to a Space Tower.' },
        search: { type: 'string', description: 'Search by actor id, handle, name, title, or affinities.' },
        isLead: { type: 'boolean', description: 'Filter lead characters.' },
      },
    },
  },
  {
    name: 'get_actor_stats',
    description: 'Get aggregated note counts and last activity date per actor across visible boards or for a specific TimeLine board.',
    inputSchema: {
      type: 'object',
      properties: {
        board: { type: 'string', description: 'Optional TimeLine board ID or slug to scope stats.' },
        profileId: { type: 'string', description: 'Optional caller profile UUID.' },
      },
    },
  },
  {
    name: 'list_profiles',
    description: 'List registered human and AI agent profiles (id, handle, displayName, playerType).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'upsert_profile',
    description: 'Register or update a human or AI agent profile by handle.',
    swaggerDto: 'RegisterProfileDto',
    inputSchema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Unique handle.' },
        displayName: { type: 'string', description: 'Human-readable display name.' },
        avatarIcon: { type: 'string', description: 'Material icon key or avatar.' },
        playerType: { type: 'string', enum: ['HUMAN', 'AGENT', 'GM'], default: 'HUMAN', description: 'Player type.' },
        defaultFeedSlug: { type: 'string', description: 'Default Seasons feed slug.' },
      },
      required: ['handle', 'displayName'],
    },
  },
];

/** Synchronizes MCP tool property metadata (descriptions, enums, defaults) with the NestJS Swagger OpenAPI document. */
export function syncToolsWithOpenApi(
  tools: McpToolDefinition[],
  openApiDoc?: OpenAPIObject | null,
): { tools: McpToolDefinition[]; report: SwaggerMcpSyncReport } {
  const schemas = (openApiDoc?.components?.schemas ?? {}) as Record<string, any>;
  const syncedTools: string[] = [];
  const missingSchemas: string[] = [];

  const cloned = tools.map((tool) => {
    const nextTool: McpToolDefinition = {
      ...tool,
      inputSchema: {
        ...tool.inputSchema,
        properties: { ...tool.inputSchema.properties },
        required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
      },
    };

    if (!tool.swaggerDto) {
      return nextTool;
    }

    const dtoSchema = schemas[tool.swaggerDto];
    if (!dtoSchema || typeof dtoSchema !== 'object') {
      missingSchemas.push(tool.swaggerDto);
      return nextTool;
    }

    const dtoProps = (dtoSchema.properties ?? {}) as Record<string, any>;
    const excluded = new Set(tool.excludeFields ?? []);

    for (const [propKey, propMeta] of Object.entries(nextTool.inputSchema.properties)) {
      if (excluded.has(propKey)) continue;
      const swaggerProp = dtoProps[propKey];
      if (!swaggerProp) continue;

      nextTool.inputSchema.properties[propKey] = {
        ...propMeta,
        ...(swaggerProp.description && !propMeta.description
          ? { description: swaggerProp.description }
          : swaggerProp.description
            ? { description: swaggerProp.description }
            : {}),
        ...(Array.isArray(swaggerProp.enum) ? { enum: swaggerProp.enum } : {}),
        ...(swaggerProp.default !== undefined && propMeta.default === undefined
          ? { default: swaggerProp.default }
          : {}),
      };
    }

    syncedTools.push(tool.name);
    return nextTool;
  });

  return {
    tools: cloned,
    report: {
      syncedTools,
      missingSchemas: Array.from(new Set(missingSchemas)),
      syncedAt: new Date().toISOString(),
    },
  };
}

export function assertOptionalDateKey(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid ${fieldName} '${trimmed}': expected YYYY-MM-DD.`);
  }
  return trimmed;
}

export function assertOptionalTimeHm(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const trimmed = String(value).trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid ${fieldName} '${trimmed}': expected HH:mm.`);
  }
  const [hh, mm] = trimmed.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error(`Invalid ${fieldName} '${trimmed}': hour must be 00..23 and minute 00..59.`);
  }
  return trimmed;
}

export function getMoscowNowFormatted(now: Date = new Date()): { dateKey: string; time: string } {
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
