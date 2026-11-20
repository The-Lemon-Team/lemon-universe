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
  AgentSummaryDto,
  CreateBoardDto,
  CreateCrossLinkDto,
  ShareNoteGroupDto,
  TimelinesService,
  UpdateBoardDto,
  UpdateNoteDto,
  UpsertBoardMemberDto,
} from './timelines.service';

@Controller('timelines')
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  @Get('boards')
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
  createBoard(
    @Body() dto: CreateBoardDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createBoard(dto, headerProfileId);
  }

  @Patch('boards/:boardId')
  updateBoard(
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.updateBoard(boardId, dto, headerProfileId);
  }

  @Delete('boards/:boardId')
  deleteBoard(
    @Param('boardId') boardId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.deleteBoard(boardId, headerProfileId);
  }

  @Get('boards/:boardId/members')
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
  addOrUpdateMember(
    @Param('boardId') boardId: string,
    @Body() dto: UpsertBoardMemberDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.addOrUpdateBoardMember(boardId, dto, headerProfileId);
  }

  @Delete('boards/:boardId/members/:profileId')
  removeMember(
    @Param('boardId') boardId: string,
    @Param('profileId') targetProfileId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.removeBoardMember(boardId, targetProfileId, headerProfileId);
  }

  @Get('notes')
  getNotes(
    @Headers('x-profile-id') headerProfileId?: string,
    @Query('profileId') queryProfileId?: string,
    @Query('boardId') boardId?: string,
    @Query('dateKey') dateKey?: string,
    @Query('actorId') actorId?: string,
    @Query('search') search?: string,
  ) {
    return this.timelinesService.getNotes({
      profileId: this.timelinesService.resolveProfileId(headerProfileId, queryProfileId),
      boardId,
      dateKey,
      actorId,
      search,
    });
  }

  @Post('notes')
  createNote(
    @Body() body: any,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createNote(body, headerProfileId);
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.updateNote(noteId, dto, headerProfileId);
  }

  @Patch('notes/:noteId/pin')
  pinNote(
    @Param('noteId') noteId: string,
    @Body() dto: { isPinned?: boolean },
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.pinNote(noteId, Boolean(dto?.isPinned), headerProfileId);
  }

  @Post('notes/:noteId/sync-seasons')
  syncNoteToSeasons(
    @Param('noteId') noteId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.syncNoteToSeasons(noteId, headerProfileId);
  }

  @Post('notes/:noteId/share')
  shareNoteWithBoardGroup(
    @Param('noteId') noteId: string,
    @Body() dto: ShareNoteGroupDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.shareNoteWithBoardGroup(noteId, dto, headerProfileId);
  }

  @Delete('notes/:noteId')
  deleteNote(
    @Param('noteId') noteId: string,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.deleteNote(noteId, headerProfileId);
  }

  @Get('cross-links/candidates')
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
  createCrossLink(
    @Body() dto: CreateCrossLinkDto,
    @Headers('x-profile-id') headerProfileId?: string,
  ) {
    return this.timelinesService.createCrossLink(dto, headerProfileId);
  }

  @Post('agent/summary')
  postAgentSummary(@Body() dto: AgentSummaryDto) {
    return this.timelinesService.postAgentSummary(dto);
  }
}
