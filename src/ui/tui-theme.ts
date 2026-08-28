/**
 * @file tui-theme.ts
 * @description Premium Terminal User Interface (TUI) Theme, Status HUD, and Box Renderer for Agentyx
 * @purpose Renders vibrant, high-aesthetic TUI banners, persistent status HUDs, box cards, badges, and prompt headers using custom curated palette (#2C5745, #EBE3A7, #EB7D00, #FFCC4D, #FFFC8C).
 * @functions TuiTheme - Class with renderHeaderBanner, renderStatusHud, renderAiResponseCard, renderToolExecutionCard, renderBoxPanel, renderPromptBadge methods.
 */

import chalk from 'chalk';
import { configManager } from '../config/config-manager.js';
import { agentManager } from '../agents/agent-manager.js';
import { workspaceDiscoveryEngine } from '../utils/workspace-discovery.js';
import { getAppVersion } from '../utils/version.js';
import { markdownRenderer } from './markdown-renderer.js';

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
  /**
   * Dynamically calculates terminal width with safe min/max bounds
   */
  public getWidth(): number {
    const cols = process.stdout.columns || 80;
    return Math.max(64, Math.min(cols - 2, 100));
  }

  /**
   * Renders horizontal line border
   */
  public line(char: string = '═', charLeft: string = '╠', charRight: string = '╣', customWidth?: number): string {
    const w = customWidth || this.getWidth();
    return chalk.bold.hex(PALETTE.forestDark)(charLeft + char.repeat(Math.max(0, w - 2)) + charRight);
  }

  /**
   * Center aligns text inside width
   */
  public center(text: string, customWidth?: number): string {
    const w = customWidth || this.getWidth();
    const rawLen = text.replace(/\u001b\[[0-9;]*m/g, '').length;
    const pad = Math.max(0, Math.floor((w - 2 - rawLen) / 2));
    const rightPad = Math.max(0, w - 2 - rawLen - pad);
    return chalk.bold.hex(PALETTE.forestDark)('║') + ' '.repeat(pad) + text + ' '.repeat(rightPad) + chalk.bold.hex(PALETTE.forestDark)('║');
  }

  /**
   * Left aligns padded text inside width
   */
  public padLeft(label: string, value: string, customWidth?: number): string {
    const w = customWidth || this.getWidth();
    const rawLabel = label.replace(/\u001b\[[0-9;]*m/g, '');
    const rawValue = value.replace(/\u001b\[[0-9;]*m/g, '');
    const totalLen = rawLabel.length + rawValue.length + 4;
    const rightSpace = Math.max(0, w - 2 - totalLen);
    return chalk.bold.hex(PALETTE.forestDark)('║') + `  ${label}: ${value}` + ' '.repeat(rightSpace) + chalk.bold.hex(PALETTE.forestDark)('║');
  }

  /**
   * Enters terminal execution mode - ensures cursor is visible and terminal mode is normal
   * without destroying scrollback history
   */
  public enterTerminalMode(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25h');
    }
  }

  /**
   * Legacy alias preserved for backwards-compatibility
   */
  public enterAlternateScreen(): void {
    this.enterTerminalMode();
  }

  /**
   * Leaves Alternate Screen Buffer cleanly
   */
  public leaveAlternateScreen(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25h');
    }
  }

  /**
   * Clears screen without wiping out scrollback history
   */
  public clearScreen(): void {
    if (process.stdout.isTTY) {
      // Clear viewport and home cursor without deleting scrollback buffer (\x1b[3J removed)
      process.stdout.write('\x1b[2J\x1b[H');
    } else {
      console.clear();
    }
  }

  /**
   * Renders main Agentyx CLI Banner with harmonious custom theme (#2C5745, #EBE3A7, #EB7D00, #FFCC4D, #FFFC8C)
   */
  public renderHeaderBanner(): void {
    this.clearScreen();
    const w = this.getWidth();

    const top = chalk.bold.hex(PALETTE.forestDark)('╔' + '═'.repeat(w - 2) + '╗');
    const bottom = chalk.bold.hex(PALETTE.forestDark)('╚' + '═'.repeat(w - 2) + '╝');

    const titleAscii = [
      chalk.bold.hex(PALETTE.lemonLight)('  █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗   ██╗██╗  ██╗  '),
      chalk.bold.hex(PALETTE.goldYellow)(' ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝╚██╗ ██╔╝╚██╗██╔╝  '),
      chalk.bold.hex(PALETTE.warmAmber) (' ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    ╚████╔╝  ╚███╔╝   '),
      chalk.bold.hex(PALETTE.creamSand) (' ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║     ╚██╔╝   ██╔██╗   '),
      chalk.bold.hex(PALETTE.forestLight)(' ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ██║   ██╔╝ ██╗  '),
      chalk.bold.hex(PALETTE.forestMid)  (' ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ██║      ╚═╝   ╚═╝  ╚═╝  ')
    ];

    console.log(top);
    titleAscii.forEach(l => console.log(this.center(l, w)));
    console.log(this.line('═', '╠', '╣', w));

    console.log(this.center(chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(`   ✨ AGENTYX AGENTIC AI CLI PLATFORM v${getAppVersion()} ✨   `), w));
    console.log(this.center(chalk.hex(PALETTE.creamSand)('SQLite Second Brain • 9router Engine • Swarm Dynamics • MCP Suite'), w));
    console.log(this.line('─', '╟', '╢', w));

    const cfg = configManager.getConfig();
    const activeAgent = agentManager.getActiveAgent();
    const stacks = workspaceDiscoveryEngine.inspectWorkspace();
    const stackNames = stacks.map(s => s.language).join(', ') || 'Auto-Detecting';

    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🧠 Engine Runtime'), chalk.hex(PALETTE.creamSand)('Node.js ES Modules + SQLite (~/.agentyx/memory.db)'), w));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('⚡ 9router Model '), chalk.bold.hex(PALETTE.lemonLight)(`${cfg.DEFAULT_COMBO} `) + chalk.hex(PALETTE.dimMuted)(`(${cfg.NINEROUTER_BASE_URL})`), w));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🤖 Active Persona'), chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${activeAgent.name} [${activeAgent.id}] `), w));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🔌 MCP Ecosystem'), chalk.bold.hex(PALETTE.warmAmber)('Active (context7, git, github, grep, memory, terminal, fetch, websearch)'), w));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('📁 Workspace Stack'), chalk.bold.hex(PALETTE.creamSand)(stackNames), w));
    console.log(this.line('═', '╠', '╣', w));

    console.log(this.center(chalk.bold.hex(PALETTE.creamSand)('💡 Tip: Ketik ') + chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(' / ') + chalk.bold.hex(PALETTE.creamSand)(' untuk Menu Interaktif • Ketik ') + chalk.bold.hex(PALETTE.lemonLight)('/view') + chalk.bold.hex(PALETTE.creamSand)(' untuk Scroll Pager'), w));
    console.log(bottom + '\n');
  }

  /**
   * Renders a persistent Status HUD banner bar above prompts so the user always has clear context
   */
  public renderStatusHud(sessionTitle?: string): string {
    const w = this.getWidth();
    const activeAgent = agentManager.getActiveAgent();
    const cfg = configManager.getConfig();

    const top = chalk.bold.hex(PALETTE.forestMid)('╭' + '─'.repeat(w - 2) + '╮');
    const bottom = chalk.bold.hex(PALETTE.forestMid)('╰' + '─'.repeat(w - 2) + '╯');

    const appBadge = chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ⚡ AGENTYX v${getAppVersion()} `);
    const agentBadge = chalk.bold.hex(PALETTE.goldYellow)(`🤖 ${activeAgent.name}`);
    const modelBadge = chalk.bold.hex(PALETTE.lemonLight)(`🧠 ${cfg.DEFAULT_COMBO}`);
    const sessionBadge = sessionTitle
      ? chalk.hex(PALETTE.creamSand)(`💾 ${sessionTitle.slice(0, 22)}${sessionTitle.length > 22 ? '...' : ''}`)
      : chalk.hex(PALETTE.creamSand)(`💾 Sesi Aktif`);

    const rawContent = ` ⚡ AGENTYX v${getAppVersion()}  │ ${activeAgent.name} │ ${cfg.DEFAULT_COMBO} │ ${sessionTitle || 'Sesi Aktif'} `;
    const padCount = Math.max(0, w - 4 - rawContent.length);

    const lineContent = chalk.bold.hex(PALETTE.forestMid)('│ ') +
      `${appBadge} ${chalk.hex(PALETTE.dimMuted)('│')} ${agentBadge} ${chalk.hex(PALETTE.dimMuted)('│')} ${modelBadge} ${chalk.hex(PALETTE.dimMuted)('│')} ${sessionBadge}` +
      ' '.repeat(padCount) +
      chalk.bold.hex(PALETTE.forestMid)(' │');

    return `\n${top}\n${lineContent}\n${bottom}`;
  }

  /**
   * Renders AI Assistant response card with rich markdown formatting and optional scroll tip
   */
  public renderAiResponseCard(agentName: string, content: string): string {
    const w = this.getWidth();
    const formatted = markdownRenderer.render(content, w - 4);
    const lineCount = formatted.split('\n').length;

    const topHeader = chalk.bold.hex(PALETTE.forestMid)('┌─') +
      chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` 🤖 ${agentName} `) +
      chalk.bold.hex(PALETTE.forestMid)('─'.repeat(Math.max(0, w - agentName.length - 8)) + '┐');

    const bottomFooter = chalk.bold.hex(PALETTE.forestMid)('└' + '─'.repeat(w - 2) + '┘');

    let out = `\n${topHeader}\n\n${formatted}\n\n${bottomFooter}`;

    // If response is long, show interactive scroll hint
    if (lineCount > 15) {
      out += `\n${chalk.hex(PALETTE.dimMuted)('  [💡 Respon panjang (')} ${chalk.bold.hex(PALETTE.goldYellow)(`${lineCount} baris`)}${chalk.hex(PALETTE.dimMuted)('). Ketik')} ${chalk.bold.hex(PALETTE.lemonLight)('/view')} ${chalk.hex(PALETTE.dimMuted)('atau')} ${chalk.bold.hex(PALETTE.lemonLight)('/scroll')} ${chalk.hex(PALETTE.dimMuted)('untuk membuka Scroll Pager Interaktif]\n')}`;
    }

    return out;
  }

  /**
   * Renders styled box panel card for CLI outputs
   */
  public renderBoxPanel(title: string, bodyContent: string): string {
    const w = this.getWidth();
    const top = chalk.bold.hex(PALETTE.forestDark)('┌─') + chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${title} `) + chalk.bold.hex(PALETTE.forestDark)('─'.repeat(Math.max(0, w - title.length - 5)) + '┐');
    const bottom = chalk.bold.hex(PALETTE.forestDark)('└' + '─'.repeat(w - 2) + '┘');

    const lines = bodyContent.split('\n');
    let content = top + '\n';
    lines.forEach(l => {
      content += chalk.bold.hex(PALETTE.forestDark)('│ ') + chalk.hex(PALETTE.creamSand)(l) + '\n';
    });
    content += bottom + '\n';
    return content;
  }

  /**
   * Renders rich multi-color prompt badge
   */
  public getRichPromptBadge(): string {
    const activeAgent = agentManager.getActiveAgent();
    const cfg = configManager.getConfig();

    const roleBadge = chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${activeAgent.id} `);
    const modelBadge = chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(` ${cfg.DEFAULT_COMBO} `);
    const arrow = chalk.bold.hex(PALETTE.goldYellow)(' ❯ ');

    return `${roleBadge}${modelBadge}${arrow}`;
  }
}

export const tuiTheme = new TuiTheme();
