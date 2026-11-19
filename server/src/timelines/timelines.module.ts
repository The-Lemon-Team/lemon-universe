import { Module } from '@nestjs/common';
import { SeasonsModule } from '../seasons/seasons.module';
import { TimelinesController } from './timelines.controller';
import { TimelinesService } from './timelines.service';

@Module({
  imports: [SeasonsModule],
  controllers: [TimelinesController],
  providers: [TimelinesService],
  exports: [TimelinesService],
})
export class TimelinesModule {}
