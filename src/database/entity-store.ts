/**
 * @file entity-store.ts
 * @description Long-term entity memory storage module backing Second Brain capabilities in Agentyx
 * @purpose Stores entities, observations, environment settings, and cross-session knowledge snippets.
 * @functions EntityStore - Class providing addEntity, getEntity, listEntities, searchEntities methods
 */

import { dbDriver } from './sqlite-driver.js';
import crypto from 'node:crypto';

export interface EntityRecord {
  id: string;
  entity_name: string;
  entity_type: string;
  observations: string;
  project_path?: string;
  created_at: string;
  updated_at: string;
}

export class EntityStore {
  private db = dbDriver.getDb();

  public saveEntity(name: string, type: string, observations: string[], projectPath?: string): EntityRecord {
    const existing = this.db.prepare(
      'SELECT * FROM entities WHERE entity_name = ? AND (project_path = ? OR project_path IS NULL)'
    ).get(name, projectPath || null) as EntityRecord | undefined;

    const obsString = JSON.stringify(observations);
    const now = new Date().toISOString();

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE entities SET observations = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(obsString, now, existing.id);
      return { ...existing, observations: obsString, updated_at: now };
    }

    const id = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO entities (id, entity_name, entity_type, observations, project_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, type, obsString, projectPath || null, now, now);
    return { id, entity_name: name, entity_type: type, observations: obsString, project_path: projectPath, created_at: now, updated_at: now };
  }

  public getEntitiesByProject(projectPath?: string): EntityRecord[] {
    if (projectPath) {
      const stmt = this.db.prepare('SELECT * FROM entities WHERE project_path = ? OR project_path IS NULL ORDER BY updated_at DESC');
      return stmt.all(projectPath) as EntityRecord[];
    }
    const stmt = this.db.prepare('SELECT * FROM entities ORDER BY updated_at DESC');
    return stmt.all() as EntityRecord[];
  }
}

export const entityStore = new EntityStore();
