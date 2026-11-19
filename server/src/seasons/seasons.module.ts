import { Module } from '@nestjs/common';
import { SeasonsBridgeController } from './seasons-bridge.controller';
import { SeasonsBridgeService } from './seasons-bridge.service';

@Module({
  controllers: [SeasonsBridgeController],
  providers: [SeasonsBridgeService],
  exports: [SeasonsBridgeService],
})
export class SeasonsModule {}
