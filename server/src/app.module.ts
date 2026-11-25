import { Module } from '@nestjs/common';
import { ActorsModule } from './actors/actors.module';
import { DatabaseModule } from './database/database.module';
import { FlowsModule } from './flows/flows.module';
import { HealthController } from './health/health.controller';
import { ProfilesModule } from './profiles/profiles.module';
import { SeasonsModule } from './seasons/seasons.module';
import { TimelinesModule } from './timelines/timelines.module';

@Module({
  imports: [
    DatabaseModule,
    ActorsModule,
    ProfilesModule,
    FlowsModule,
    SeasonsModule,
    TimelinesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
