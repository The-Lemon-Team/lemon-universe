import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChronicleFeedQuery, ChronicleService, IngestChronicleEventDto } from './chronicle.service';

/** Machine-facing chronicle API (Bearer link token), consumed by Projectarium. */
@ApiTags('chronicle')
@Controller('timelines/chronicle')
export class ChronicleController {
  constructor(private readonly chronicle: ChronicleService) {}

  @Get()
  @ApiOperation({ summary: 'Read chronicle feed for boards granted to link token' })
  feed(@Headers('authorization') authorization: string | undefined, @Query() query: ChronicleFeedQuery) {
    return this.chronicle.getFeed(authorization, query);
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest a chronicle event via Bearer link token' })
  ingest(@Headers('authorization') authorization: string | undefined, @Body() dto: IngestChronicleEventDto) {
    return this.chronicle.ingest(authorization, dto);
  }
}
