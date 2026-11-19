import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { IngestSeasonNoteInput } from '@lemon/seasons-neurons';
import { MediaUploadInputDto, SeasonsBridgeService } from './seasons-bridge.service';

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

  @Post('ingest')
  ingest(@Body() payload: IngestSeasonNoteInput & { metadata?: Record<string, any> }) {
    return this.seasonsBridge.ingestRawNotePayload(payload);
  }

  @Post('media')
  uploadMedia(@Body() payload: MediaUploadInputDto) {
    return this.seasonsBridge.uploadMediaAttachment(payload);
  }
}
