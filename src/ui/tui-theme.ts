/**
 * @file tui-theme.ts
 * @description Premium OpenCode-Style Terminal UI Theme and Component Renderer for Agentyx
 * @purpose Renders sleek, modern, minimalist TUI banners, status cards, tool execution badges, and prompt badges inspired by OpenCode and Claude Code.
 * @functions TuiTheme - Class with renderHeaderBanner, renderCompactBanner, renderBoxPanel, renderPromptBadge methods.
 */

import chalk from 'chalk';
import { configManager } from '../config/config-manager.js';
import { agentManager } from '../agents/agent-manager.js';
import { workspaceDiscoveryEngine } from '../utils/workspace-discovery.js';
import { getAppVersion } from '../utils/version.js';

export const PALETTE = {
  forestDark: '#2C5745',
  forestMid: '#3D735C',
  forestLight: '#529679',
  creamSand: '#EBE3A7',
  warmAmber: '#EB7D00',
  goldYellow: '#FFCC4D',
  lemonLight: '#FFFC8C',
  textLight: '#FAF8EB',
  dimMuted: '#9B9B82'
};

export class TuiTheme {
  public getWidth(): number {
    const cols = process.stdout.columns || 80;
    return Math.max(64, Math.min(cols - 2, 96));
  }

  /**
   * Clears screen cleanly without breaking terminal scrollback
   */
  public clearScreen(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H');
    } else {
      console.clear();
    }
  }

  /**
   * Renders sleek, modern OpenCode-Style Header Banner
   */
  public renderHeaderBanner(): void {
    this.clearScreen();
    const w = this.getWidth();
    const cfg = configManager.getConfig();
    const activeAgent = agentManager.getActiveAgent();
    const stacks = workspaceDiscoveryEngine.inspectWorkspace();
    const stackNames = stacks.map(s => s.language).join(', ') || 'Universal Polyglot';

    const titleText = ` Agentyx CLI v${getAppVersion()} `;
    const topBar = chalk.bold.hex(PALETTE.forestMid)('┌─') +
      chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(titleText) +
      chalk.bold.hex(PALETTE.forestMid)('─'.repeat(Math.max(0, w - titleText.length - 4)) + '┐');
    const bottomBar = chalk.bold.hex(PALETTE.forestMid)('└' + '─'.repeat(w - 2) + '┘');

    console.log(topBar);

    const padRow = (label: string, value: string) => {
      const rawLabel = label.replace(/\u001b\[[0-9;]*m/g, '');
      const rawVal = value.replace(/\u001b\[[0-9;]*m/g, '');
      const totalLen = rawLabel.length + rawVal.length + 4;
      const rightSpace = Math.max(0, w - totalLen - 4);
      return chalk.bold.hex(PALETTE.forestMid)('│ ') + ` ${label}: ${value}` + ' '.repeat(rightSpace) + chalk.bold.hex(PALETTE.forestMid)(' │');
    };

    console.log(padRow(
      chalk.bold.hex(PALETTE.goldYellow)('🤖 Active Persona '),
      chalk.bold.hex(PALETTE.lemonLight)(`${activeAgent.name} `) + chalk.hex(PALETTE.dimMuted)(`[${activeAgent.id}]`)
    ));
    console.log(padRow(
      chalk.bold.hex(PALETTE.goldYellow)('🧠 9router Model  '),
      chalk.bold.hex(PALETTE.lemonLight)(`${cfg.DEFAULT_COMBO} `) + chalk.hex(PALETTE.dimMuted)(`(${cfg.NINEROUTER_BASE_URL})`)
    ));
    console.log(padRow(
      chalk.bold.hex(PALETTE.goldYellow)('📁 Workspace Stack'),
      chalk.hex(PALETTE.creamSand)(stackNames)
    ));
    console.log(padRow(
      chalk.bold.hex(PALETTE.goldYellow)('💾 Second Brain   '),
      chalk.hex(PALETTE.creamSand)('SQLite (~/.agentyx/memory.db) • ') + chalk.bold.hex(PALETTE.forestLight)('8 MCP Tools Active')
    ));

    console.log(bottomBar);
    console.log(chalk.hex(PALETTE.dimMuted)('💡 Ketik ') + chalk.bold.hex(PALETTE.lemonLight)('/') + chalk.hex(PALETTE.dimMuted)(' untuk Menu Interaktif • Ketik ') + chalk.bold.hex(PALETTE.warmAmber)('/exit') + chalk.hex(PALETTE.dimMuted)(' untuk keluar\n'));
  }

  /**
   * Renders OpenCode-style Prompt Badge
   */
  public getRichPromptBadge(): string {
    const activeAgent = agentManager.getActiveAgent();
    const cfg = configManager.getConfig();

    const roleBadge = chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${activeAgent.id} `);
    const modelBadge = chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(` ${cfg.DEFAULT_COMBO} `);
    const arrow = chalk.bold.hex(PALETTE.goldYellow)(' ❯ ');

    return `${roleBadge}${modelBadge}${arrow}`;
  }

  /**
   * Renders styled tool call execution badge
   */
  public renderToolCallBadge(toolName: string, args: Record<string, unknown>): string {
    let detail = '';
    if (args.command) detail = chalk.hex(PALETTE.lemonLight)(`$ ${args.command}`);
    else if (args.path) detail = chalk.hex(PALETTE.creamSand)(`📄 ${args.path}`);
    else if (args.query) detail = chalk.hex(PALETTE.creamSand)(`🔍 ${args.query}`);

    return chalk.bold.hex(PALETTE.warmAmber)(`\n⚡ [Tool: ${toolName}] `) + detail;
  }

  /**
   * Renders tool result box
   */
  public renderToolResult(success: boolean, output: string): string {
    const statusIcon = success ? chalk.bold.hex(PALETTE.forestLight)('✔') : chalk.red('❌');
    const header = `${statusIcon} ${chalk.bold.hex(PALETTE.goldYellow)('Execution Output')}:`;
    return `${header}\n${chalk.hex(PALETTE.creamSand)(output)}\n`;
  }
}

export const tuiTheme = new TuiTheme();
