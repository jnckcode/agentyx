/**
 * @file sessions.ts
 * @description /sessions and /new Slash Command implementations for SQLite session management
 * @purpose Creates new conversation sessions, lists saved sessions, switches active session context, renames, and deletes sessions in SQLite.
 * @functions executeSessionsCommand, executeSessionsInteractive, executeNewSessionCommand
 */

import { sessionStore, SessionRecord } from '../database/session-store.js';
import { configManager } from '../config/config-manager.js';
import { manifestManager } from '../docs/manifest-manager.js';
import { PALETTE } from '../ui/tui-theme.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export async function executeSessionsInteractive(): Promise<string> {
  const sessions = sessionStore.listSessions();
  const activeId = configManager.getConfig().ACTIVE_SESSION_ID;

  const choices: { name: string; value: string }[] = [
    {
      name: chalk.bold.hex(PALETTE.lemonLight)('➕ [Buat Sesi Baru / Create New Session]'),
      value: '__NEW__'
    }
  ];

  if (sessions.length > 0) {
    choices.push({
      name: chalk.bold.hex(PALETTE.warmAmber)('✏️ [Ubah Judul Sesi Aktif / Rename Active Session]'),
      value: '__RENAME__'
    });
    choices.push({
      name: chalk.bold.hex('#FF6B6B')('🗑️ [Hapus Sesi / Delete a Session]'),
      value: '__DELETE__'
    });
    choices.push(new inquirer.Separator(chalk.hex(PALETTE.forestMid)('─── Daftar Sesi Tersimpan di SQLite Second Brain ───')) as unknown as { name: string; value: string });

    sessions.forEach(s => {
      const isActive = s.id === activeId;
      const msgCount = sessionStore.getMessageCount(s.id);
      const prefix = isActive ? chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(' ACTIVE ') + ' ' : '        ';
      const idShort = chalk.hex(PALETTE.goldYellow)(`[${s.id.slice(0, 8)}]`);
      const title = chalk.hex(PALETTE.creamSand)(s.title.length > 35 ? s.title.slice(0, 32) + '...' : s.title.padEnd(35));
      const meta = chalk.hex(PALETTE.dimMuted)(`(${msgCount} msgs • ${s.active_agent})`);

      choices.push({
        name: `${prefix}${idShort} ${title} ${meta}`,
        value: s.id
      });
    });
  }

  try {
    const answer = await inquirer.prompt<{ selected: string }>([
      {
        type: 'list',
        name: 'selected',
        message: chalk.bold.hex(PALETTE.goldYellow)('Pilih sesi atau aksi manajemen sesi:'),
        choices
      }
    ]);

    if (answer.selected === '__NEW__') {
      const nameAnswer = await inquirer.prompt<{ title: string }>([
        {
          type: 'input',
          name: 'title',
          message: chalk.bold.hex(PALETTE.creamSand)('Masukkan judul sesi baru (kosongkan untuk default):'),
          default: 'New Agentyx Session'
        }
      ]);
      const res = executeNewSessionCommand(nameAnswer.title);
      return chalk.bold.hex(PALETTE.lemonLight)(`✔ ${res.message}`);
    }

    if (answer.selected === '__RENAME__') {
      const activeSession = sessions.find(s => s.id === activeId) || sessions[0];
      if (!activeSession) {
        return chalk.red('❌ Tidak ada sesi aktif untuk diubah namanya.');
      }
      const renameAnswer = await inquirer.prompt<{ newTitle: string }>([
        {
          type: 'input',
          name: 'newTitle',
          message: chalk.bold.hex(PALETTE.creamSand)(`Masukkan judul baru untuk [${activeSession.id.slice(0, 8)}]:`),
          default: activeSession.title
        }
      ]);
      if (renameAnswer.newTitle && renameAnswer.newTitle.trim()) {
        sessionStore.updateSessionTitle(activeSession.id, renameAnswer.newTitle.trim());
        manifestManager.logFootprint('SESSION_RENAME', `Renamed session [${activeSession.id}] to ${renameAnswer.newTitle.trim()}`);
        return chalk.bold.hex(PALETTE.lemonLight)(`✔ Judul sesi [${activeSession.id.slice(0, 8)}] berhasil diubah menjadi: "${renameAnswer.newTitle.trim()}"`);
      }
      return chalk.yellow('Perubahan judul dibatalkan.');
    }

    if (answer.selected === '__DELETE__') {
      const delAnswer = await inquirer.prompt<{ toDelete: string }>([
        {
          type: 'list',
          name: 'toDelete',
          message: chalk.bold.hex('#FF6B6B')('Pilih sesi yang ingin dihapus permanen:'),
          choices: sessions.map(s => ({
            name: `[${s.id.slice(0, 8)}] ${s.title} (${sessionStore.getMessageCount(s.id)} msgs)`,
            value: s.id
          }))
        }
      ]);

      const target = sessions.find(s => s.id === delAnswer.toDelete);
      sessionStore.deleteSession(delAnswer.toDelete);
      manifestManager.logFootprint('SESSION_DELETE', `Deleted session [${delAnswer.toDelete}]`);

      // If deleted active session, switch to another or create new
      if (delAnswer.toDelete === activeId) {
        const remaining = sessionStore.listSessions();
        if (remaining.length > 0) {
          configManager.updateConfig('ACTIVE_SESSION_ID', remaining[0].id);
        } else {
          executeNewSessionCommand('Default Agentyx Session');
        }
      }

      return chalk.bold.hex(PALETTE.warmAmber)(`✔ Sesi [${delAnswer.toDelete.slice(0, 8)}] "${target?.title || ''}" berhasil dihapus.`);
    }

    // Switched to a specific session
    return executeSessionsCommand(answer.selected);

  } catch {
    return chalk.yellow('Manajemen sesi dibatalkan.');
  } finally {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
      } catch {}
    }
    process.stdin.resume();
  }
}

export function executeSessionsCommand(switchId?: string): string {
  const sessions = sessionStore.listSessions();

  if (switchId) {
    const target = sessions.find(s => s.id === switchId || s.id.startsWith(switchId));
    if (!target) {
      return chalk.red(`❌ Session matching '${switchId}' not found.`);
    }
    configManager.updateConfig('ACTIVE_SESSION_ID', target.id);
    manifestManager.logFootprint('SESSION_SWITCH', `Switched active session to [${target.id}] ${target.title}`);
    const count = sessionStore.getMessageCount(target.id);
    return chalk.bold.hex(PALETTE.lemonLight)(`✔ Active session switched to: [${target.id.slice(0, 8)}] ${target.title} `) + chalk.hex(PALETTE.dimMuted)(`(${count} messages in context)`);
  }

  if (sessions.length === 0) {
    return chalk.yellow('No saved sessions found in SQLite Second Brain. Use /new to start a session.');
  }

  const activeId = configManager.getConfig().ACTIVE_SESSION_ID;

  let output = chalk.bold.hex(PALETTE.forestDark)('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
    chalk.bold.hex(PALETTE.forestDark)('│ ') + chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(' 💾 AGENTYX SAVED SESSIONS (~/.agentyx/memory.db) ') + chalk.bold.hex(PALETTE.forestDark)('                   │\n') +
    chalk.bold.hex(PALETTE.forestDark)('└────────────────────────────────────────────────────────────────────────┘\n\n');

  sessions.forEach(s => {
    const isActive = s.id === activeId;
    const msgCount = sessionStore.getMessageCount(s.id);
    const prefix = isActive ? chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(' ACTIVE ') + ' ' : '        ';
    const idShort = chalk.bold.hex(PALETTE.goldYellow)(`[${s.id.slice(0, 8)}]`);
    output += `${prefix}${idShort} ${chalk.bold.hex(PALETTE.lemonLight)(s.title)}\n         ${chalk.hex(PALETTE.dimMuted)('Info:')} ${chalk.hex(PALETTE.creamSand)(`${msgCount} msgs | ${s.active_agent} | ${s.active_model} | ${s.updated_at}`)}\n\n`;
  });

  output += chalk.bold.hex(PALETTE.warmAmber)('💡 Untuk beralih sesi: ') + chalk.bold.hex(PALETTE.lemonLight)('/sessions <id>') + chalk.hex(PALETTE.warmAmber)(' atau jalankan ') + chalk.bold.hex(PALETTE.lemonLight)('/sessions') + chalk.hex(PALETTE.warmAmber)(' untuk menu interaktif.\n');
  return output;
}

export function executeNewSessionCommand(title = 'New Agentyx Session'): { session: SessionRecord; message: string } {
  const cfg = configManager.getConfig();
  const session = sessionStore.createSession(title, cfg.ACTIVE_AGENT, cfg.DEFAULT_COMBO);
  configManager.updateConfig('ACTIVE_SESSION_ID', session.id);
  manifestManager.logFootprint('SESSION_NEW', `Created new session [${session.id}] ${title}`);

  const msg = chalk.bold.hex(PALETTE.lemonLight)(`Created & activated new session: [${session.id.slice(0, 8)}] ${title}`);
  return { session, message: msg };
}
