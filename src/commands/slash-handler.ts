/**
 * @file slash-handler.ts
 * @description Central Slash Command Router and Interactive Menu for Agentyx CLI
 * @purpose Intercepts user slash inputs (/new, /init, /sessions, /remove-slop, /agents, /models, /mcp, /config, /help) and provides a rich TUI interactive command menu.
 * @functions SlashHandler - Class with isSlashCommand, handleSlashCommand, promptInteractiveMenu, getHelpText methods
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { executeInitCommand } from './init.js';
import { executeRemoveSlopCommand } from './remove-slop.js';
import { executeSessionsCommand, executeNewSessionCommand } from './sessions.js';
import { agentManager } from '../agents/agent-manager.js';
import { nineRouterClient } from '../router/ninerouter-client.js';
import { configManager } from '../config/config-manager.js';
import { mcpStatusManager } from '../utils/mcp-status.js';
import { experienceStore } from '../database/experience-store.js';

export interface SlashMenuItem {
  name: string;
  value: string;
  description: string;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { name: '⚙️ /config       - Kelola konfigurasi 9router (URL, API Key, Combo)', value: '/config', description: 'Configure 9router settings' },
  { name: '⚡ /new          - Inisialisasi sesi percakapan/kerja baru di SQLite', value: '/new', description: 'Start new session' },
  { name: '📁 /init         - Inisialisasi 4 file manifest wajib (workflow, footprint, agent, prompt)', value: '/init', description: 'Init manifests' },
  { name: '💾 /sessions     - Tampilkan & pilih sesi tersimpan di SQLite', value: '/sessions', description: 'Manage sessions' },
  { name: '🧹 /remove-slop   - Scan & bersihkan AI Slop (file temp & komentar redundan)', value: '/remove-slop', description: 'Clean AI slop' },
  { name: '🤖 /agents       - Tampilkan & pilih persona Swarm Agent persona', value: '/agents', description: 'Switch agent' },
  { name: '🧠 /models       - Tampilkan & pilih 9router combo model', value: '/models', description: 'Switch model' },
  { name: '🔌 /mcp          - Tampilkan status active MCPs & Swarm tools', value: '/mcp', description: 'Check MCP status' },
  { name: '📚 /experience   - Cari & tampilkan riwayat solusi di Hermes Experience Bank', value: '/experience', description: 'View experience memory' },
  { name: '❓ /help         - Tampilkan bantuan dan daftar perintah', value: '/help', description: 'Display help' },
  { name: '🚪 /exit         - Keluar dari Agentyx CLI secara aman', value: '/exit', description: 'Exit CLI' }
];

export class SlashHandler {
  public isSlashCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  /**
   * Displays an interactive selectable TUI menu when '/' is pressed/entered alone
   */
  public async promptInteractiveMenu(): Promise<string> {
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.bgMagenta.white('    ✨ AGENTYX INTERACTIVE SLASH COMMAND MENU ✨                         ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════════════════╝\n'));

    try {
      const answers = await inquirer.prompt<{ chosenCommand: string }>([
        {
          type: 'list',
          name: 'chosenCommand',
          message: chalk.bold.yellow('Pilih perintah slash yang ingin dieksekusi:'),
          choices: SLASH_MENU_ITEMS.map(item => ({
            name: item.name,
            value: item.value
          }))
        }
      ]);

      return this.handleSlashCommand(answers.chosenCommand);
    } catch {
      return this.getHelpText();
    } finally {
      process.stdin.resume();
    }
  }

  public async handleSlashCommand(input: string): Promise<string> {
    const trimmed = input.trim();

    // If only '/' or '/menu' is entered, trigger interactive menu
    if (trimmed === '/' || trimmed === '/menu') {
      return this.promptInteractiveMenu();
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/config': {
        if (args.length >= 2) {
          const subKey = args[0].toLowerCase();
          const val = args.slice(1).join(' ');

          if (subKey === 'url' || subKey === 'base_url') {
            configManager.updateConfig('NINEROUTER_BASE_URL', val);
            return chalk.bold.green(`✔ 9router Base URL updated to: ${val}`);
          } else if (subKey === 'key' || subKey === 'api_key') {
            configManager.updateConfig('NINEROUTER_API_KEY', val);
            return chalk.bold.green(`✔ 9router API Key updated successfully.`);
          } else if (subKey === 'model' || subKey === 'combo') {
            configManager.updateConfig('DEFAULT_COMBO', val);
            return chalk.bold.green(`✔ 9router Combo Model updated to: ${val}`);
          }
        }

        const cfg = configManager.getConfig();
        let out = chalk.bold.cyan('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
          chalk.bold.cyan('│ ') + chalk.bold.bgCyan.black(' ⚙️ 9ROUTER CONFIGURATION & CONNECTION SETTINGS ') + chalk.bold.cyan('                       │\n') +
          chalk.bold.cyan('└────────────────────────────────────────────────────────────────────────┘\n\n');

        out += `  ${chalk.bold.yellow('Config File Path')} : ${chalk.dim(configManager.getAppDir() + '/config.json')}\n`;
        out += `  ${chalk.bold.yellow('NINEROUTER_BASE_URL')} : ${chalk.green(cfg.NINEROUTER_BASE_URL)}\n`;
        out += `  ${chalk.bold.yellow('NINEROUTER_API_KEY')}  : ${chalk.green(cfg.NINEROUTER_API_KEY ? '••••••••' + cfg.NINEROUTER_API_KEY.slice(-4) : '(not set)')}\n`;
        out += `  ${chalk.bold.yellow('DEFAULT_COMBO')}      : ${chalk.green(cfg.DEFAULT_COMBO)}\n\n`;

        out += chalk.bold.yellow('💡 Untuk memperbarui pengaturan via CLI:\n');
        out += `  • Set Base URL : ${chalk.cyan('/config url http://localhost:3000/v1')}\n`;
        out += `  • Set API Key  : ${chalk.cyan('/config key sk-your-9router-api-key')}\n`;
        out += `  • Set Model    : ${chalk.cyan('/config model default-combo')}\n`;

        return out;
      }

      case '/new': {
        const title = args.join(' ') || 'New Agentyx Session';
        const res = executeNewSessionCommand(title);
        return chalk.bold.green(`✔ ${res.message}`);
      }

      case '/init': {
        return executeInitCommand(process.cwd());
      }

      case '/sessions': {
        const switchId = args[0];
        return executeSessionsCommand(switchId);
      }

      case '/remove-slop': {
        return executeRemoveSlopCommand(process.cwd());
      }

      case '/agents': {
        if (args.length > 0) {
          try {
            const role = agentManager.switchAgent(args.join(' '));
            return chalk.bold.green(`✔ Active Swarm agent switched to: ${role.name} (${role.id})\n`) + chalk.dim(role.boundary);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return chalk.red(`❌ ${msg}`);
          }
        }

        const active = agentManager.getActiveAgent();
        let out = chalk.bold.cyan('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
          chalk.bold.cyan('│ ') + chalk.bold.bgMagenta.white(' 🤖 AGENTYX SWARM ROLES & BOUNDARIES PANEL ') + chalk.bold.cyan('                          │\n') +
          chalk.bold.cyan('└────────────────────────────────────────────────────────────────────────┘\n\n');

        agentManager.getAvailableAgents().forEach(a => {
          const isActive = a.id === active.id;
          const prefix = isActive ? chalk.bold.bgGreen.black(' ACTIVE ') + ' ' : '        ';
          out += `${prefix}${chalk.bold.yellow(a.id.padEnd(18))} ${chalk.bold.white(a.name)}\n         ${chalk.dim(a.boundary)}\n\n`;
        });
        out += chalk.bold.yellow('💡 Gunakan perintah: ') + chalk.cyan('/agents <agent-id>') + chalk.yellow(' untuk beralih persona.\n');
        return out;
      }

      case '/models': {
        if (args.length > 0) {
          const modelId = args[0];
          configManager.updateConfig('DEFAULT_COMBO', modelId);
          return chalk.bold.green(`✔ Active 9router combo model updated to: ${modelId}`);
        }

        try {
          const models = await nineRouterClient.listModels();
          const current = configManager.getConfig().DEFAULT_COMBO;

          let out = chalk.bold.cyan('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
            chalk.bold.cyan('│ ') + chalk.bold.bgBlue.white(' 🧠 9ROUTER AVAILABLE COMBOS & MODELS PANEL ') + chalk.bold.cyan('                        │\n') +
            chalk.bold.cyan('└────────────────────────────────────────────────────────────────────────┘\n\n');

          models.forEach(m => {
            const isCurr = m.id === current;
            const prefix = isCurr ? chalk.bold.bgGreen.black(' ACTIVE ') + ' ' : '        ';
            out += `${prefix}${chalk.bold.yellow(m.id.padEnd(20))}${m.name ? ` - ${chalk.white(m.name)}` : ''}\n`;
          });
          out += chalk.bold.yellow('\n💡 Gunakan perintah: ') + chalk.cyan('/models <combo-id>') + chalk.yellow(' untuk beralih model.\n');
          return out;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return chalk.red(`❌ Error listing models: ${msg}\n`) + chalk.yellow('Gunakan /config untuk memeriksa URL dan API Key 9router.');
        }
      }

      case '/mcp':
      case '/tools': {
        return mcpStatusManager.formatMcpStatusPanel();
      }

      case '/experience':
      case '/exp':
      case '/memory': {
        const query = args.join(' ').trim();
        let records = query ? experienceStore.searchExperiences(query) : experienceStore.listRecentExperiences(5);

        let out = chalk.bold.cyan('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
          chalk.bold.cyan('│ ') + chalk.bold.bgYellow.black(' 📚 HERMES EXPERIENCE BANK MEMORY PANEL ') + chalk.bold.cyan('                             │\n') +
          chalk.bold.cyan('└────────────────────────────────────────────────────────────────────────┘\n\n');

        if (records.length === 0) {
          out += chalk.yellow(`  Tidak ada data pengalaman ditemukan${query ? ` untuk kueri: '${query}'` : ''}.\n\n`);
        } else {
          records.forEach(r => {
            out += chalk.bold.yellow(`📌 [${r.id}] `) + chalk.bold.white(r.trigger_pattern) + `\n`;
            out += `   ${chalk.dim('Stack:')} ${chalk.green(r.environment_stack)} | ${chalk.dim('Category:')} ${chalk.cyan(r.category)}\n`;
            if (r.root_cause) {
              out += `   ${chalk.dim('Akar Masalah:')} ${r.root_cause}\n`;
            }
            out += `   ${chalk.dim('Solusi:')} ${chalk.white(r.verified_solution.slice(0, 100))}${r.verified_solution.length > 100 ? '...' : ''}\n\n`;
          });
        }
        out += chalk.bold.yellow('💡 Gunakan perintah: ') + chalk.cyan('/experience <kata_kunci>') + chalk.yellow(' untuk mencari pengalaman spesifik.\n');
        return out;
      }

      case '/exit':
      case '/quit':
      case 'exit':
      case 'quit': {
        return '__EXIT__';
      }

      case '/help': {
        return this.getHelpText();
      }

      default:
        return chalk.red(`❌ Unknown command '${command}'. Ketik '/' atau '/help' untuk membuka interactive menu.`);
    }
  }

  public getHelpText(): string {
    return chalk.bold.cyan('\n┌────────────────────────────────────────────────────────────────────────┐\n') +
      chalk.bold.cyan('│ ') + chalk.bold.bgCyan.black(' 📌 AGENTYX INTERACTIVE SLASH COMMANDS REFERENCE ') + chalk.bold.cyan('                    │\n') +
      chalk.bold.cyan('└────────────────────────────────────────────────────────────────────────┘\n\n') +
      `  ${chalk.bold.yellow('/menu')} (atau '${chalk.bold.yellow('/')}')  - Tampilkan interactive select menu (panah keyboard)\n` +
      `  ${chalk.bold.yellow('/config [url|key|model]')} - Kelola URL, API Key, atau Combo Model 9router\n` +
      `  ${chalk.bold.yellow('/new [title]')}         - Inisialisasi sesi percakapan/kerja baru di SQLite\n` +
      `  ${chalk.bold.yellow('/init')}                - Inisialisasi 4 file manifest wajib (workflow, footprint, agent, prompt)\n` +
      `  ${chalk.bold.yellow('/sessions [id]')}       - Tampilkan atau beralih sesi tersimpan di SQLite\n` +
      `  ${chalk.bold.yellow('/remove-slop')}         - Scan & bersihkan AI Slop (file temp & komentar redundan)\n` +
      `  ${chalk.bold.yellow('/agents [role]')}       - Tampilkan atau pilih persona Swarm Agent\n` +
      `  ${chalk.bold.yellow('/models [combo]')}      - Tampilkan atau pilih combo/model 9router\n` +
      `  ${chalk.bold.yellow('/mcp')} (atau '${chalk.bold.yellow('/tools')}') - Tampilkan status active MCPs & Swarm tools\n` +
      `  ${chalk.bold.yellow('/experience [query]')} - Cari atau tampilkan riwayat solusi di Hermes Experience Bank\n` +
      `  ${chalk.bold.yellow('/help')}                - Tampilkan referensi bantuan ini\n` +
      `  ${chalk.bold.yellow('/exit')}                - Keluar dari Agentyx CLI secara aman\n\n`;
  }
}

export const slashHandler = new SlashHandler();
