import { Module } from '@nestjs/common';
import { ActorsModule } from '../actors/actors.module';
import { SeasonsModule } from '../seasons/seasons.module';
import { ChronicleController } from './chronicle.controller';
import { ChronicleService } from './chronicle.service';
import { ProjectariumLinksController } from './projectarium-links.controller';
import { ProjectariumLinksService } from './projectarium-links.service';
import { TimelinesController } from './timelines.controller';
import { TimelinesService } from './timelines.service';

@Module({
  imports: [SeasonsModule, ActorsModule],
  controllers: [TimelinesController, ProjectariumLinksController, ChronicleController],
  providers: [TimelinesService, ProjectariumLinksService, ChronicleService],
  exports: [TimelinesService, ProjectariumLinksService, ChronicleService],
})
export class TimelinesModule {}
