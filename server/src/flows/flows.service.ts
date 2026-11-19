import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FlowsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(profileId?: string) {
    const params: unknown[] = [];
    const where = profileId ? (params.push(profileId), 'WHERE profile_id = $1::uuid') : '';
    const { rows } = await this.db.query(
      `
        SELECT
          id,
          name,
          description,
          type,
          status,
          is_exclusive AS "isExclusive",
          folder_id AS "folderId",
          profile_id AS "profileId",
          config,
          orchestrator_rules AS "orchestratorRules",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM flows
        ${where}
        ORDER BY created_at ASC
      `,
      params,
    );
    return rows.map((r) => ({ ...r, tags: [] }));
  }

  async updateStatus(id: string, status: string) {
    const { rows } = await this.db.query(
      `
        UPDATE flows
        SET status = $2::"FlowStatus", updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, name, description, type, status, is_exclusive AS "isExclusive", folder_id AS "folderId", profile_id AS "profileId", config, orchestrator_rules AS "orchestratorRules", created_at AS "createdAt", updated_at AS "updatedAt"
      `,
      [id, status],
    );
    return rows[0] ? { ...rows[0], tags: [] } : null;
  }
}
