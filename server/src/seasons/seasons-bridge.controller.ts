import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IngestSeasonNoteInput } from '@lemon/seasons-neurons';
import { MediaUploadInputDto, SeasonsBridgeService } from './seasons-bridge.service';

@ApiTags('seasons')
@Controller('seasons-bridge')
export class SeasonsBridgeController {
  constructor(private readonly seasonsBridge: SeasonsBridgeService) {}

  @Get('feed')
  getFeedNotes(
    @Query('feedSlug') feedSlug?: string,
    @Query('limit') limit?: string,
    @Headers('x-profile-id') profileId?: string,
  ) {
    return this.seasonsBridge.fetchSeasonsFeedNotes({
      feedSlug,
      profileId,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Get('stream')
  getStream(
    @Query('streamSlug') streamSlug?: string,
    @Headers('x-profile-id') profileId?: string,
  ) {
    return this.seasonsBridge.fetchSeasonsStream(streamSlug, profileId);
  }

  @Post('stream/ensure')
  ensureStream(
    @Body() body: { streamSlug?: string },
    @Headers('x-profile-id') profileId?: string,
  ) {
    return this.seasonsBridge.ensureTimelinesStream({
      streamSlug: body?.streamSlug,
      profileId,
    });
  }

  @Post('ingest')
  ingest(@Body() payload: IngestSeasonNoteInput & { metadata?: Record<string, any> }) {
    return this.seasonsBridge.ingestRawNotePayload(payload);
  }

  @Post('media')
  uploadMedia(@Body() payload: MediaUploadInputDto) {
    return this.seasonsBridge.uploadMediaAttachment(payload);
  }
}
