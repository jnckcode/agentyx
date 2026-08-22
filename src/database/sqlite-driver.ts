/**
 * @file sqlite-driver.ts
 * @description Driver for SQLite Second Brain located at ~/.agentyx/memory.db
 * @purpose Initializes SQLite database tables, handles connection lifecycle, and provides query helper execution.
 * @functions DatabaseDriver - Class managing database connection, migrations, and statement preparation.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const DB_DIR = path.join(os.homedir(), '.agentyx');
const DB_PATH = path.join(DB_DIR, 'memory.db');

export class DatabaseDriver {
  private db: Database.Database;

  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        active_agent TEXT NOT NULL,
        active_model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thought TEXT,
        tool_calls TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    // Long-Term Entities Memory table (@modelcontextprotocol/server-memory)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        entity_name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        observations TEXT NOT NULL,
        project_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Project Indexing table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_hash TEXT,
        summary TEXT,
        slop_status TEXT DEFAULT 'clean',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_path, file_path)
      );
    `);

    // Hermes Experience Bank Memory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS experience_bank (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        environment_stack TEXT NOT NULL,
        trigger_pattern TEXT NOT NULL,
        root_cause TEXT,
        verified_solution TEXT NOT NULL,
        key_takeaway TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }
}

export const dbDriver = new DatabaseDriver();
