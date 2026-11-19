import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ChronicleFeedQuery, ChronicleService, IngestChronicleEventDto } from './chronicle.service';

/** Machine-facing chronicle API (Bearer link token), consumed by Projectarium. */
@Controller('timelines/chronicle')
export class ChronicleController {
  constructor(private readonly chronicle: ChronicleService) {}

  @Get()
  feed(@Headers('authorization') authorization: string | undefined, @Query() query: ChronicleFeedQuery) {
    return this.chronicle.getFeed(authorization, query);
  }

  @Post('events')
  ingest(@Headers('authorization') authorization: string | undefined, @Body() dto: IngestChronicleEventDto) {
    return this.chronicle.ingest(authorization, dto);
  }
}
