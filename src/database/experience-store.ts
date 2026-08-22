/**
 * @file experience-store.ts
 * @description SQLite Experience Logger & Memory Engine for .hermes Agent backing the experience_bank table in ~/.agentyx/memory.db
 * @purpose Manages logging, search, retrieval, and formatting of execution trajectories, error patterns, root causes, and verified technical solutions.
 * @functions ExperienceLoggerStore - Class managing experience persistence, keyword/stack retrieval, and swarm entry formatting.
 */

import { dbDriver } from './sqlite-driver.js';

export interface ExperienceRecord {
  id: string;
  category: string;
  environment_stack: string;
  trigger_pattern: string;
  root_cause?: string | null;
  verified_solution: string;
  key_takeaway?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExperienceInput {
  category: string;
  environment_stack: string;
  trigger_pattern: string;
  root_cause?: string;
  verified_solution: string;
  key_takeaway?: string;
}

export class ExperienceLoggerStore {
  private db = dbDriver.getDb();

  /**
   * Generates a standard Hermes Entry ID: EXP-[TIMESTAMP]-[CATEGORY]
   */
  private generateEntryId(category: string): string {
    const timestamp = Date.now();
    const cleanCategory = category.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10);
    return `EXP-${timestamp}-${cleanCategory}`;
  }

  /**
   * Logs a new experience trajectory or solution into the experience_bank table
   */
  public logExperience(input: CreateExperienceInput): ExperienceRecord {
    const id = this.generateEntryId(input.category);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO experience_bank (
        id, category, environment_stack, trigger_pattern, root_cause, verified_solution, key_takeaway, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.category,
      input.environment_stack,
      input.trigger_pattern,
      input.root_cause || null,
      input.verified_solution,
      input.key_takeaway || null,
      now,
      now
    );

    return {
      id,
      category: input.category,
      environment_stack: input.environment_stack,
      trigger_pattern: input.trigger_pattern,
      root_cause: input.root_cause || null,
      verified_solution: input.verified_solution,
      key_takeaway: input.key_takeaway || null,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Searches experience_bank for relevant past solutions by query string and optional environment stack filter
   */
  public searchExperiences(query: string, environmentStack?: string): ExperienceRecord[] {
    const searchPattern = `%${query.trim()}%`;
    let sql = `
      SELECT * FROM experience_bank
      WHERE (trigger_pattern LIKE ? OR root_cause LIKE ? OR verified_solution LIKE ? OR key_takeaway LIKE ?)
    `;
    const params: string[] = [searchPattern, searchPattern, searchPattern, searchPattern];

    if (environmentStack) {
      sql += ` AND environment_stack LIKE ?`;
      params.push(`%${environmentStack.trim()}%`);
    }

    sql += ` ORDER BY updated_at DESC LIMIT 10`;

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as ExperienceRecord[];
  }

  /**
   * Fetches an experience entry by ID
   */
  public getExperienceById(id: string): ExperienceRecord | undefined {
    const stmt = this.db.prepare(`SELECT * FROM experience_bank WHERE id = ?`);
    return stmt.get(id) as ExperienceRecord | undefined;
  }

  /**
   * Retrieves recent experience entries
   */
  public listRecentExperiences(limit: number = 10): ExperienceRecord[] {
    const stmt = this.db.prepare(`SELECT * FROM experience_bank ORDER BY created_at DESC LIMIT ?`);
    return stmt.all(limit) as ExperienceRecord[];
  }

  /**
   * Deletes an experience entry by ID
   */
  public deleteExperience(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM experience_bank WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Formats an ExperienceRecord into standard .hermes knowledge entity format
   */
  public formatExperienceEntry(record: ExperienceRecord): string {
    return [
      `* Entry ID: ${record.id}`,
      `* Context / Environment: ${record.environment_stack}`,
      `* Trigger Pattern / Error Log: ${record.trigger_pattern}`,
      `* Root Cause: ${record.root_cause || 'N/A'}`,
      `* Verified Solution Snippet:`,
      `  ${record.verified_solution.split('\n').join('\n  ')}`,
      `* Key Takeaway: ${record.key_takeaway || 'N/A'}`
    ].join('\n');
  }
}

export const experienceStore = new ExperienceLoggerStore();
