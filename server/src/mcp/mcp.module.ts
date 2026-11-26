import { Module } from '@nestjs/common';
import { ActorsModule } from '../actors/actors.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TimelinesModule } from '../timelines/timelines.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [TimelinesModule, ActorsModule, ProfilesModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
