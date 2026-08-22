/**
 * @file sessions.ts
 * @description /sessions and /new Slash Command implementations for SQLite session management
 * @purpose Creates new conversation sessions, lists saved sessions, and switches active session context in SQLite.
 * @functions executeSessionsCommand, executeNewSessionCommand - Session list/switch/create handlers.
 */

import { sessionStore, SessionRecord } from '../database/session-store.js';
import { configManager } from '../config/config-manager.js';
import { manifestManager } from '../docs/manifest-manager.js';
import chalk from 'chalk';

export function executeSessionsCommand(switchId?: string): string {
  const sessions = sessionStore.listSessions();

  if (switchId) {
    const target = sessions.find(s => s.id === switchId || s.id.startsWith(switchId));
    if (!target) {
      return chalk.red(`❌ Session matching '${switchId}' not found.`);
    }
    configManager.updateConfig('ACTIVE_SESSION_ID', target.id);
    manifestManager.logFootprint('SESSION_SWITCH', `Switched active session to [${target.id}] ${target.title}`);
    return chalk.green(`✔ Active session switched to: [${target.id.slice(0, 8)}] ${target.title}`);
  }

  if (sessions.length === 0) {
    return chalk.yellow('No saved sessions found in SQLite Second Brain. Use /new to start a session.');
  }

  const activeId = configManager.getConfig().ACTIVE_SESSION_ID;

  let output = chalk.bold.cyan('\n[Agentyx Saved Sessions (~/.agentyx/memory.db)]\n');
  sessions.forEach(s => {
    const isActive = s.id === activeId;
    const prefix = isActive ? chalk.bold.green('➤ [ACTIVE] ') : '  ';
    const idShort = s.id.slice(0, 8);
    output += `${prefix}${chalk.yellow(idShort)} | ${s.title} (${s.active_agent} | ${s.active_model}) - ${s.updated_at}\n`;
  });

  output += chalk.dim('\nTo switch session, run: /sessions <session-id>\n');
  return output;
}

export function executeNewSessionCommand(title = 'New Agentyx Session'): { session: SessionRecord; message: string } {
  const cfg = configManager.getConfig();
  const session = sessionStore.createSession(title, cfg.ACTIVE_AGENT, cfg.DEFAULT_COMBO);
  configManager.updateConfig('ACTIVE_SESSION_ID', session.id);
  manifestManager.logFootprint('SESSION_NEW', `Created new session [${session.id}] ${title}`);

  const msg = chalk.green(`✔ Created & activated new session: [${session.id.slice(0, 8)}] ${title}`);
  return { session, message: msg };
}
