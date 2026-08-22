/**
 * @file session-store.ts
 * @description Session and chat message storage manager backed by SQLite memory.db
 * @purpose Retains active session history, message logs, thoughts, and tool call payload states across application runs.
 * @functions SessionStore - Methods for createSession, getSessions, getSessionById, deleteSession, addMessage, getSessionMessages
 */

import { dbDriver } from './sqlite-driver.js';
import crypto from 'node:crypto';

export interface SessionRecord {
  id: string;
  title: string;
  active_agent: string;
  active_model: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thought?: string;
  tool_calls?: string;
  timestamp: string;
}

export class SessionStore {
  private db = dbDriver.getDb();

  public createSession(title: string, agent: string, model: string): SessionRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, active_agent, active_model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, agent, model, now, now);
    return { id, title, active_agent: agent, active_model: model, created_at: now, updated_at: now };
  }

  public listSessions(): SessionRecord[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all() as SessionRecord[];
  }

  public getSessionById(id: string): SessionRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as SessionRecord | undefined;
  }

  public updateSessionAgent(id: string, agent: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET active_agent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(agent, id);
  }

  public updateSessionModel(id: string, model: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET active_model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(model, id);
  }

  public deleteSession(id: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }

  public addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    thought?: string,
    toolCalls?: object | string
  ): MessageRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const serializedToolCalls = typeof toolCalls === 'object' ? JSON.stringify(toolCalls) : toolCalls;

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, thought, tool_calls, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, role, content, thought || null, serializedToolCalls || null, now);

    // Touch session updated_at
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    return {
      id,
      session_id: sessionId,
      role,
      content,
      thought,
      tool_calls: serializedToolCalls,
      timestamp: now
    };
  }

  public getSessionMessages(sessionId: string): MessageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC');
    return stmt.all(sessionId) as MessageRecord[];
  }
}

export const sessionStore = new SessionStore();
