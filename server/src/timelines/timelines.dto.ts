import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BoardMemberRole, BoardPrivacy, TimelineBoardMode } from './timelines.privacy';

export class CreateBoardDto {
  @ApiPropertyOptional({ description: 'Explicit board ID (auto-generated if omitted)', example: 'board-my-project' })
  id?: string;

  @ApiPropertyOptional({ description: 'URL-safe slug', example: 'my-project' })
  slug?: string;

  @ApiProperty({ description: 'Human-readable title of the TimeLine board', example: 'Сессии Кодинга' })
  title!: string;

  @ApiPropertyOptional({ description: 'Board description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Board hashtags', type: [String], example: ['coding', 'mcp'] })
  hashtags?: string[];

  @ApiPropertyOptional({ description: 'Material symbol icon name', example: 'view_timeline' })
  icon?: string;

  @ApiPropertyOptional({ description: 'Accent color theme', example: 'amber' })
  colorTheme?: string;

  @ApiPropertyOptional({ description: 'Vibe identifier', example: 'CHRONO_DAYFLOW' })
  vibeId?: string;

  @ApiPropertyOptional({ description: 'Board kind', example: 'CUSTOM_PROJECT' })
  boardKind?: string;

  @ApiPropertyOptional({ description: 'Board display mode', enum: ['TIMELINE', 'DIARY'], default: 'TIMELINE' })
  boardMode?: TimelineBoardMode;

  @ApiPropertyOptional({ description: 'Privacy contour', enum: ['PUBLIC', 'PRIVATE'], default: 'PRIVATE' })
  privacy?: BoardPrivacy;

  @ApiPropertyOptional({ description: 'Owner profile UUID' })
  ownerProfileId?: string;

  @ApiPropertyOptional({ description: 'Default actor ID for notes created on this board', example: 'actor-antigravity-agent' })
  defaultActorId?: string;

  @ApiPropertyOptional({ description: 'Core Combinator flow type', example: 'CONTEXT' })
  flowType?: string;

  @ApiPropertyOptional({ description: 'Lemon Seasons stream slug', example: 'lemon-universe' })
  seasonsStreamSlug?: string;

  @ApiPropertyOptional({ description: 'Lemon Seasons feed slug' })
  seasonsFeedSlug?: string;

  @ApiPropertyOptional({ description: 'Initial member profile UUIDs', type: [String] })
  memberProfileIds?: string[];
}

export class UpdateBoardDto {
  @ApiPropertyOptional({ description: 'Board title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Board description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Board hashtags', type: [String] })
  hashtags?: string[];

  @ApiPropertyOptional({ description: 'Material symbol icon name' })
  icon?: string;

  @ApiPropertyOptional({ description: 'Accent color theme' })
  colorTheme?: string;

  @ApiPropertyOptional({ description: 'Vibe identifier' })
  vibeId?: string;

  @ApiPropertyOptional({ description: 'Board mode', enum: ['TIMELINE', 'DIARY'] })
  boardMode?: TimelineBoardMode;

  @ApiPropertyOptional({ description: 'Board privacy', enum: ['PUBLIC', 'PRIVATE'] })
  privacy?: BoardPrivacy;

  @ApiPropertyOptional({ description: 'Default actor ID or null to clear', nullable: true })
  defaultActorId?: string | null;

  @ApiPropertyOptional({ description: 'Lemon Seasons feed slug' })
  seasonsFeedSlug?: string;

  @ApiPropertyOptional({ description: 'Archive flag' })
  isArchived?: boolean;
}

export class UpsertBoardMemberDto {
  @ApiProperty({ description: 'Target profile UUID to add or update' })
  profileId!: string;

  @ApiPropertyOptional({ description: 'Member role', enum: ['OWNER', 'EDITOR', 'MEMBER', 'AGENT', 'VIEWER'], default: 'MEMBER' })
  role?: BoardMemberRole;

  @ApiPropertyOptional({ description: 'Whether member can post notes', default: true })
  canPost?: boolean;

  @ApiPropertyOptional({ description: 'Whether member can create cross-links', default: true })
  canCrossLink?: boolean;
}

export class CrossRefInputDto {
  @ApiProperty({ description: 'Target board ID or slug', example: 'board-tower-fire' })
  targetBoardId!: string;

  @ApiProperty({ description: 'Target note ID' })
  targetNoteId!: string;

  @ApiPropertyOptional({ description: 'Human-readable relation label' })
  relationLabel?: string;
}

export class CreateNoteDto {
  @ApiPropertyOptional({ description: 'Explicit note ID (auto-generated if omitted)' })
  id?: string;

  @ApiPropertyOptional({ description: 'Target TimeLine board ID or slug', default: 'board-global-day', example: 'coding-sessions' })
  boardId?: string;

  @ApiPropertyOptional({ description: 'Date key YYYY-MM-DD (defaults to today in Europe/Moscow)', example: '2026-11-26' })
  dateKey?: string;

  @ApiPropertyOptional({ description: 'Time HH:mm (defaults to current time in Europe/Moscow)', example: '14:30' })
  time?: string;

  @ApiPropertyOptional({ description: 'Minutes since 00:00 (auto-computed from time if omitted)' })
  timeMinutes?: number;

  @ApiPropertyOptional({ description: 'Note type', enum: ['thought', 'action', 'proposal'], default: 'thought' })
  type?: 'thought' | 'action' | 'proposal';

  @ApiPropertyOptional({ description: 'Visibility override for public boards', enum: ['PUBLIC', 'PRIVATE'] })
  visibility?: 'PUBLIC' | 'PRIVATE';

  @ApiPropertyOptional({ description: 'Character / Actor ID (e.g. actor-hades, actor-akin, actor-antigravity-agent)', example: 'actor-hades' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Actor display name (auto-resolved from actorId if omitted)' })
  actorName?: string;

  @ApiPropertyOptional({ description: 'Actor avatar icon key (auto-resolved from actorId if omitted)' })
  actorAvatar?: string;

  @ApiPropertyOptional({ description: 'Actor accent color (auto-resolved from actorId if omitted)' })
  actorAccent?: string;

  @ApiPropertyOptional({ description: 'Actor title/subtitle (auto-resolved from actorId if omitted)' })
  actorTitle?: string;

  @ApiPropertyOptional({ description: 'Optional co-author / sub-character ID' })
  subActorId?: string;

  @ApiPropertyOptional({ description: 'Sub-actor display name' })
  subActorName?: string;

  @ApiPropertyOptional({ description: 'Sub-actor avatar key' })
  subActorAvatar?: string;

  @ApiPropertyOptional({ description: 'Sub-actor accent color' })
  subActorAccent?: string;

  @ApiPropertyOptional({ description: 'Author profile UUID' })
  authorProfileId?: string;

  @ApiPropertyOptional({ description: 'Author profile display name' })
  authorProfileName?: string;

  @ApiPropertyOptional({ description: 'Optional short headline/title of the note' })
  title?: string;

  @ApiProperty({ description: 'Main markdown/text content of the note', example: 'Реализован MCP-сервер для TimeLines' })
  text!: string;

  @ApiPropertyOptional({ description: 'Mood emoji', default: '💭', example: '🔥' })
  moodEmoji?: string;

  @ApiPropertyOptional({ description: 'Tags (merged with inline #hashtags from text)', type: [String], example: ['mcp', 'timelines'] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Media attachments array', type: [Object] })
  mediaAttachments?: any[];

  @ApiPropertyOptional({ description: 'Reply target note ID' })
  replyToNoteId?: string;

  @ApiPropertyOptional({ description: 'Share synced Seasons note with board group', default: false })
  sharedWithGroup?: boolean;

  @ApiPropertyOptional({ description: 'Optional cross-links to attach on creation', type: [CrossRefInputDto] })
  crossRefs?: CrossRefInputDto[];

  // Kept for frontend compatibility; excluded from MCP tools at this stage
  weather?: Record<string, any> | null;
  worldMoment?: Record<string, any> | null;
}

export class UpdateNoteDto {
  @ApiPropertyOptional({ description: 'Updated note title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Updated note text' })
  text?: string;

  @ApiPropertyOptional({ description: 'Note type', enum: ['thought', 'action', 'proposal'] })
  type?: 'thought' | 'action' | 'proposal';

  @ApiPropertyOptional({ description: 'Mood emoji' })
  moodEmoji?: string;

  @ApiPropertyOptional({ description: 'Updated tags', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Updated media attachments', type: [Object] })
  mediaAttachments?: any[];

  // Kept for frontend compatibility; excluded from MCP tools at this stage
  weather?: Record<string, any> | null;
  worldMoment?: Record<string, any> | null;
}

export class PinNoteDto {
  @ApiPropertyOptional({ description: 'Whether note should be pinned', default: true })
  isPinned?: boolean;
}

export class ShareNoteGroupDto {
  @ApiPropertyOptional({ description: 'Share state', default: true })
  shared?: boolean;

  @ApiPropertyOptional({ description: 'Explicit profile UUIDs to share with', type: [String] })
  granteeProfileIds?: string[];
}

export class CreateCrossLinkDto {
  @ApiPropertyOptional({ description: 'Source board ID or slug (inferred from sourceNoteId if omitted)' })
  sourceBoardId?: string;

  @ApiProperty({ description: 'Source note ID' })
  sourceNoteId!: string;

  @ApiProperty({ description: 'Target board ID or slug', example: 'board-tower-fire' })
  targetBoardId!: string;

  @ApiProperty({ description: 'Target note ID' })
  targetNoteId!: string;

  @ApiPropertyOptional({ description: 'Relation type', default: 'CROSS_TIMELINE_REF' })
  relationType?: string;

  @ApiPropertyOptional({ description: 'Human-readable relation label' })
  relationLabel?: string;

  @ApiPropertyOptional({ description: 'Optional preview cache payload', type: Object })
  previewCache?: Record<string, any>;
}

export class AgentSummaryDto {
  @ApiPropertyOptional({ description: 'Agent profile UUID (defaults to Antigravity Agent profile)' })
  agentProfileId?: string;

  @ApiPropertyOptional({ description: 'Source board ID or slug for full summary', default: 'board-coding-sessions' })
  sourceBoardId?: string;

  @ApiPropertyOptional({ description: 'Optional target board ID or slug for cross-linked anchor note' })
  targetBoardId?: string;

  @ApiPropertyOptional({ description: 'Existing target note ID to link to instead of creating an anchor note' })
  targetNoteId?: string;

  @ApiPropertyOptional({ description: 'Actor ID (defaults to actor-antigravity-agent)', example: 'actor-hades' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Actor name (auto-resolved from actorId if omitted)' })
  actorName?: string;

  @ApiPropertyOptional({ description: 'Actor avatar (auto-resolved from actorId if omitted)' })
  actorAvatar?: string;

  @ApiPropertyOptional({ description: 'Actor accent color (auto-resolved from actorId if omitted)' })
  actorAccent?: string;

  @ApiPropertyOptional({ description: 'Summary title', default: 'Сводка Агента' })
  title?: string;

  @ApiProperty({ description: 'Summary markdown/text body' })
  text!: string;

  @ApiPropertyOptional({ description: 'Date key YYYY-MM-DD (defaults to today in Europe/Moscow)' })
  dateKey?: string;

  @ApiPropertyOptional({ description: 'Time HH:mm (defaults to current time in Europe/Moscow)' })
  time?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Media attachments', type: [Object] })
  mediaAttachments?: any[];

  @ApiPropertyOptional({ description: 'Custom cross-link label' })
  relationLabel?: string;

  @ApiPropertyOptional({ description: 'Create an anchor note on targetBoardId when targetNoteId is omitted', default: true })
  createAnchorOnTarget?: boolean;
}
