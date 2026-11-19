import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SeasonsBridgeService } from '../seasons/seasons-bridge.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly seasonsBridge: SeasonsBridgeService,
  ) {}

  @Get()
  async getHealth() {
    let boardsCount = 0;
    try {
      const { rows } = await this.db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM timeline_boards',
      );
      boardsCount = rows[0]?.count ?? 0;
    } catch {
      boardsCount = 0;
    }
    const seasonsConnected = await this.seasonsBridge.checkSeasonsHealth();
    return {
      status: 'ok',
      project: 'lemon-universe',
      backend: 'nestjs',
      database: this.db.databaseName,
      boardsCount,
      seasonsUrl: this.seasonsBridge.seasonsUrl,
      mediaHubUrl: this.seasonsBridge.mediaHubUrl,
      seasonsConnected,
    };
  }
}
