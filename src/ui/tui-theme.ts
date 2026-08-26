/**
 * @file tui-theme.ts
 * @description Premium Terminal User Interface (TUI) Theme and Box Renderer for Agentyx
 * @purpose Renders vibrant, high-aesthetic TUI banners, status panels, box cards, badges, and prompt headers using custom curated palette (#2C5745, #EBE3A7, #EB7D00, #FFCC4D, #FFFC8C).
 * @functions TuiTheme - Class with renderHeaderBanner, renderBoxPanel, renderPromptBadge, renderMcpCard methods.
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
  private width = 74;

  /**
   * Renders horizontal line border
   */
  public line(char: string = '═', charLeft: string = '╠', charRight: string = '╣'): string {
    return chalk.bold.hex(PALETTE.forestDark)(charLeft + char.repeat(this.width - 2) + charRight);
  }

  /**
   * Center aligns text inside width
   */
  public center(text: string): string {
    const rawLen = text.replace(/\u001b\[[0-9;]*m/g, '').length;
    const pad = Math.max(0, Math.floor((this.width - 2 - rawLen) / 2));
    const rightPad = Math.max(0, this.width - 2 - rawLen - pad);
    return chalk.bold.hex(PALETTE.forestDark)('║') + ' '.repeat(pad) + text + ' '.repeat(rightPad) + chalk.bold.hex(PALETTE.forestDark)('║');
  }

  /**
   * Left aligns padded text inside width
   */
  public padLeft(label: string, value: string): string {
    const rawLabel = label.replace(/\u001b\[[0-9;]*m/g, '');
    const rawValue = value.replace(/\u001b\[[0-9;]*m/g, '');
    const totalLen = rawLabel.length + rawValue.length + 4;
    const rightSpace = Math.max(0, this.width - 2 - totalLen);
    return chalk.bold.hex(PALETTE.forestDark)('║') + `  ${label}: ${value}` + ' '.repeat(rightSpace) + chalk.bold.hex(PALETTE.forestDark)('║');
  }

  /**
   * Renders main Agentyx CLI Banner with harmonious custom theme (#2C5745, #EBE3A7, #EB7D00, #FFCC4D, #FFFC8C)
   */
  public renderHeaderBanner(): void {
    console.clear();

    const top = chalk.bold.hex(PALETTE.forestDark)('╔' + '═'.repeat(this.width - 2) + '╗');
    const bottom = chalk.bold.hex(PALETTE.forestDark)('╚' + '═'.repeat(this.width - 2) + '╝');

    const titleAscii = [
      chalk.bold.hex(PALETTE.lemonLight)('   █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗   ██╗██╗  ██╗  '),
      chalk.bold.hex(PALETTE.goldYellow)('  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝╚██╗ ██╔╝╚██╗██╔╝  '),
      chalk.bold.hex(PALETTE.warmAmber) ('  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    ╚████╔╝  ╚███╔╝   '),
      chalk.bold.hex(PALETTE.creamSand) ('  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║     ╚██╔╝   ██╔██╗   '),
      chalk.bold.hex(PALETTE.forestLight)('  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ██║   ██╔╝ ██╗  '),
      chalk.bold.hex(PALETTE.forestMid)  ('  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ██║      ╚═╝   ╚═╝  ╚═╝  ')
    ];

    console.log(top);
    titleAscii.forEach(l => console.log(this.center(l)));
    console.log(this.line('═', '╠', '╣'));

    console.log(this.center(chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(`   ✨ UNIVERSAL AGENTIC AI CLI PLATFORM v${getAppVersion()} ✨   `)));
    console.log(this.center(chalk.hex(PALETTE.creamSand)('SQLite Second Brain • 9router Engine • Swarm Dynamics • MCP Suite')));
    console.log(this.line('─', '╟', '╢'));

    const cfg = configManager.getConfig();
    const activeAgent = agentManager.getActiveAgent();
    const stacks = workspaceDiscoveryEngine.inspectWorkspace();
    const stackNames = stacks.map(s => s.language).join(', ') || 'Auto-Detecting';

    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🧠 Engine Runtime'), chalk.hex(PALETTE.creamSand)('Node.js ES Modules + SQLite (~/.agentyx/memory.db)')));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('⚡ 9router Model '), chalk.bold.hex(PALETTE.lemonLight)(`${cfg.DEFAULT_COMBO} `) + chalk.hex(PALETTE.dimMuted)(`(${cfg.NINEROUTER_BASE_URL})`)));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🤖 Active Persona'), chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${activeAgent.name} [${activeAgent.id}] `)));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('🔌 MCP Ecosystem'), chalk.bold.hex(PALETTE.warmAmber)('Active (context7, git, github, grep, memory, terminal, fetch, websearch)')));
    console.log(this.padLeft(chalk.bold.hex(PALETTE.goldYellow)('📁 Workspace Stack'), chalk.bold.hex(PALETTE.creamSand)(stackNames)));
    console.log(this.line('═', '╠', '╣'));

    console.log(this.center(chalk.bold.hex(PALETTE.creamSand)('💡 Tip: Ketik ') + chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(' / ') + chalk.bold.hex(PALETTE.creamSand)(' lalu tekan Enter untuk Interactive Command Menu!')));
    console.log(bottom + '\n');
  }

  /**
   * Renders styled box panel card for CLI outputs
   */
  public renderBoxPanel(title: string, bodyContent: string): string {
    const top = chalk.bold.hex(PALETTE.forestDark)('┌─') + chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${title} `) + chalk.bold.hex(PALETTE.forestDark)('─'.repeat(Math.max(0, this.width - title.length - 5)) + '┐');
    const bottom = chalk.bold.hex(PALETTE.forestDark)('└' + '─'.repeat(this.width - 2) + '┘');

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
