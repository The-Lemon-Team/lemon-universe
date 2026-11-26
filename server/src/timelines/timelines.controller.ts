import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
import { TimelinesService } from './timelines.service';

@ApiTags('timelines')
@ApiHeader({ name: 'x-profile-id', required: false, description: 'Active profile UUID' })
@Controller('timelines')
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  @Get('boards')
  @ApiOperation({ summary: 'List visible TimeLine boards' })
  @ApiQuery({ name: 'profileId', required: false })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  getBoards(
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.timelinesService.getBoards(
      this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
      includeArchived === 'true',
    );
  }

  @Post('boards')
  @ApiOperation({ summary: 'Create a new TimeLine board' })
  @ApiBody({ type: CreateBoardDto })
  createBoard(
    @Body() dto: CreateBoardDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createBoard(dto, headerProfileId);
  }

  @Get('actors/stats')
  @ApiOperation({ summary: 'Get aggregated note statistics grouped by actor' })
  @ApiQuery({ name: 'boardId', required: false, description: 'Optional board ID or slug filter' })
  @ApiQuery({ name: 'profileId', required: false })
  getActorStats(
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
    @Query('boardId') boardId?: string,
  ) {
    return this.timelinesService.getActorStats({
      profileId: this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
      boardId,
    });
  }

  @Get('boards/:boardIdOrSlug')
  @ApiOperation({ summary: 'Get a single TimeLine board by ID or slug' })
  @ApiParam({ name: 'boardIdOrSlug', description: 'Board ID (board-...) or slug' })
  @ApiQuery({ name: 'profileId', required: false })
  getBoard(
    @Param('boardIdOrSlug') boardIdOrSlug: string,
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
  ) {
    return this.timelinesService.getBoard(
      boardIdOrSlug,
      this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
    );
  }

  @Get('boards/:boardIdOrSlug/notes')
  @ApiOperation({ summary: 'Get notes of a specific TimeLine board (by ID or slug) with pagination and filters' })
  @ApiParam({ name: 'boardIdOrSlug', description: 'Board ID (board-...) or slug' })
  @ApiQuery({ name: 'profileId', required: false })
  @ApiQuery({ name: 'dateKey', required: false, description: 'Exact date YYYY-MM-DD' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start date inclusive YYYY-MM-DD' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End date inclusive YYYY-MM-DD' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max notes to return (1..200)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset' })
  @ApiQuery({ name: 'order', required: false, enum: ['latest', 'chronological'] })
  @ApiQuery({ name: 'compact', required: false, type: Boolean, description: 'Return lightweight note objects without heavy metadata' })
  getBoardNotes(
    @Param('boardIdOrSlug') boardIdOrSlug: string,
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
    @Query('dateKey') dateKey?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('actorId') actorId?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('order') order?: 'latest' | 'chronological',
    @Query('compact') compact?: string,
  ) {
    return this.timelinesService.getNotes({
      profileId: this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
      boardId: boardIdOrSlug,
      dateKey,
      fromDate,
      toDate,
      actorId,
      search,
      tag,
      limit,
      offset,
      order,
      compact,
    });
  }

  @Patch('boards/:boardId')
  @ApiOperation({ summary: 'Update a TimeLine board' })
  @ApiParam({ name: 'boardId' })
  @ApiBody({ type: UpdateBoardDto })
  updateBoard(
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.updateBoard(boardId, dto, headerProfileId);
  }

  @Delete('boards/:boardId')
  @ApiOperation({ summary: 'Delete a non-default TimeLine board' })
  @ApiParam({ name: 'boardId' })
  deleteBoard(
    @Param('boardId') boardId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.deleteBoard(boardId, headerProfileId);
  }

  @Get('boards/:boardId/members')
  @ApiOperation({ summary: 'List members of a TimeLine board' })
  @ApiParam({ name: 'boardId' })
  @ApiQuery({ name: 'profileId', required: false })
  getBoardMembers(
    @Param('boardId') boardId: string,
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
  ) {
    return this.timelinesService.getBoardMembers(
      boardId,
      this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
    );
  }

  @Post('boards/:boardId/members')
  @ApiOperation({ summary: 'Add or update a TimeLine board member' })
  @ApiParam({ name: 'boardId' })
  @ApiBody({ type: UpsertBoardMemberDto })
  addOrUpdateMember(
    @Param('boardId') boardId: string,
    @Body() dto: UpsertBoardMemberDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.addOrUpdateBoardMember(boardId, dto, headerProfileId);
  }

  @Delete('boards/:boardId/members/:profileId')
  @ApiOperation({ summary: 'Remove a member from a TimeLine board' })
  @ApiParam({ name: 'boardId' })
  @ApiParam({ name: 'profileId' })
  removeMember(
    @Param('boardId') boardId: string,
    @Param('profileId') targetProfileId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.removeBoardMember(boardId, targetProfileId, headerProfileId);
  }

  @Get('notes')
  @ApiOperation({ summary: 'Query notes across visible TimeLine boards or for a specific board' })
  @ApiQuery({ name: 'profileId', required: false })
  @ApiQuery({ name: 'boardId', required: false, description: 'Board ID or slug' })
  @ApiQuery({ name: 'dateKey', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'order', required: false, enum: ['latest', 'chronological'] })
  @ApiQuery({ name: 'compact', required: false, type: Boolean, description: 'Return lightweight note objects without heavy metadata' })
  getNotes(
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
    @Query('boardId') boardId?: string,
    @Query('dateKey') dateKey?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('actorId') actorId?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('order') order?: 'latest' | 'chronological',
    @Query('compact') compact?: string,
  ) {
    return this.timelinesService.getNotes({
      profileId: this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
      boardId,
      dateKey,
      fromDate,
      toDate,
      actorId,
      search,
      tag,
      limit,
      offset,
      order,
      compact,
    });
  }

  @Get('notes/:noteId')
  @ApiOperation({ summary: 'Get a single note by ID with crossRefs and boardSlug' })
  @ApiParam({ name: 'noteId' })
  @ApiQuery({ name: 'profileId', required: false })
  getNoteById(
    @Param('noteId') noteId: string,
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
  ) {
    return this.timelinesService.getNoteById(
      noteId,
      this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
    );
  }

  @Post('notes')
  @ApiOperation({ summary: 'Create a note on a TimeLine board' })
  @ApiBody({ type: CreateNoteDto })
  createNote(
    @Body() body: CreateNoteDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createNote(body, headerProfileId);
  }

  @Patch('notes/:noteId')
  @ApiOperation({ summary: 'Update an existing note' })
  @ApiParam({ name: 'noteId' })
  @ApiBody({ type: UpdateNoteDto })
  updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.updateNote(noteId, dto, headerProfileId);
  }

  @Patch('notes/:noteId/pin')
  @ApiOperation({ summary: 'Pin or unpin a note' })
  @ApiParam({ name: 'noteId' })
  @ApiBody({ type: PinNoteDto })
  pinNote(
    @Param('noteId') noteId: string,
    @Body() dto: PinNoteDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.pinNote(noteId, Boolean(dto?.isPinned), headerProfileId);
  }

  @Post('notes/:noteId/sync-seasons')
  @ApiOperation({ summary: 'Sync note to Lemon Seasons' })
  @ApiParam({ name: 'noteId' })
  syncNoteToSeasons(
    @Param('noteId') noteId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.syncNoteToSeasons(noteId, headerProfileId);
  }

  @Post('notes/:noteId/share')
  @ApiOperation({ summary: 'Share note with board group in Lemon Seasons' })
  @ApiParam({ name: 'noteId' })
  @ApiBody({ type: ShareNoteGroupDto })
  shareNoteWithBoardGroup(
    @Param('noteId') noteId: string,
    @Body() dto: ShareNoteGroupDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.shareNoteWithBoardGroup(noteId, dto, headerProfileId);
  }

  @Delete('notes/:noteId')
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'noteId' })
  deleteNote(
    @Param('noteId') noteId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.deleteNote(noteId, headerProfileId);
  }

  @Get('cross-links/candidates')
  @ApiOperation({ summary: 'List candidate notes from compatible boards for cross-linking' })
  @ApiQuery({ name: 'sourceBoardId', required: true })
  @ApiQuery({ name: 'profileId', required: false })
  getCrossLinkCandidates(
    @Query('sourceBoardId') sourceBoardId: string,
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
  ) {
    return this.timelinesService.getCrossLinkCandidates(
      sourceBoardId,
      this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
    );
  }

  @Post('cross-links')
  @ApiOperation({ summary: 'Create a cross-link between two notes across boards' })
  @ApiBody({ type: CreateCrossLinkDto })
  createCrossLink(
    @Body() dto: CreateCrossLinkDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createCrossLink(dto, headerProfileId);
  }

  @Post('agent/summary')
  @ApiOperation({ summary: 'Post an AI agent summary note with optional cross-linked anchor on target board' })
  @ApiBody({ type: AgentSummaryDto })
  postAgentSummary(@Body() dto: AgentSummaryDto) {
    return this.timelinesService.postAgentSummary(dto);
  }
}
