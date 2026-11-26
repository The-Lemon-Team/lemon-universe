import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateProjectariumLinkDto,
  ProjectariumLinksService,
  UpdateLinkBoardsDto,
} from './projectarium-links.service';

/** Owner-facing management of Projectarium ↔ TimeLines links (tokens issued manually). */
@ApiTags('projectarium')
@Controller('timelines/projectarium/links')
export class ProjectariumLinksController {
  constructor(private readonly links: ProjectariumLinksService) {}

  @Get()
  list(
    @Headers('x-profile-id') profileId?: string,
    @Query('standSlug') standSlug?: string,
  ) {
    return this.links.list(profileId, standSlug);
  }

  @Post()
  create(@Body() dto: CreateProjectariumLinkDto, @Headers('x-profile-id') profileId?: string) {
    return this.links.create(dto, profileId);
  }

  @Patch(':linkId/boards')
  updateBoards(
    @Param('linkId') linkId: string,
    @Body() dto: UpdateLinkBoardsDto,
    @Headers('x-profile-id') profileId?: string,
  ) {
    return this.links.updateBoards(linkId, dto, profileId);
  }

  @Post(':linkId/rotate')
  rotate(@Param('linkId') linkId: string, @Headers('x-profile-id') profileId?: string) {
    return this.links.rotate(linkId, profileId);
  }

  @Delete(':linkId')
  revoke(@Param('linkId') linkId: string, @Headers('x-profile-id') profileId?: string) {
    return this.links.revoke(linkId, profileId);
  }
}
