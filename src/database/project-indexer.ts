/**
 * @file project-indexer.ts
 * @description Project indexing engine that scans project workspace hierarchy into SQLite Second Brain
 * @purpose Maps workspace directory structure, file hashes, and metadata to speed up context retrieval.
 * @functions ProjectIndexer - Class providing indexProject, getProjectFiles, updateSlopStatus methods
 */

import { dbDriver } from './sqlite-driver.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface ProjectFileRecord {
  id: string;
  project_path: string;
  file_path: string;
  file_hash: string;
  summary: string;
  slop_status: string;
  updated_at: string;
}

export class ProjectIndexer {
  private db = dbDriver.getDb();

  public indexProject(projectPath: string): number {
    let count = 0;
    if (!fs.existsSync(projectPath)) return count;

    const files = this.scanDir(projectPath, projectPath);
    const stmt = this.db.prepare(`
      INSERT INTO project_files (id, project_path, file_path, file_hash, summary, slop_status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(project_path, file_path) DO UPDATE SET
        file_hash = excluded.file_hash,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const relPath of files) {
      const fullPath = path.join(projectPath, relPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
        const id = crypto.randomUUID();
        const summary = `${path.extname(relPath)} file (${content.length} bytes)`;
        stmt.run(id, projectPath, relPath, hash, summary, 'clean');
        count++;
      } catch {
        // Skip binary or locked files
      }
    }
    return count;
  }

  private scanDir(dir: string, baseDir: string): string[] {
    const results: string[] = [];
    const list = fs.readdirSync(dir);
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'coverage', '.agentyx']);

    for (const item of list) {
      if (ignoreDirs.has(item)) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...this.scanDir(fullPath, baseDir));
      } else if (stat.isFile()) {
        results.push(path.relative(baseDir, fullPath));
      }
    }
    return results;
  }

  public getProjectFiles(projectPath: string): ProjectFileRecord[] {
    const stmt = this.db.prepare('SELECT * FROM project_files WHERE project_path = ? ORDER BY file_path ASC');
    return stmt.all(projectPath) as ProjectFileRecord[];
  }
}

export const projectIndexer = new ProjectIndexer();
