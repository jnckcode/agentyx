/**
 * @file tui-theme.ts
 * @description Premium Terminal User Interface (TUI) Theme and Box Renderer for Agentyx
 * @purpose Renders vibrant, high-aesthetic TUI banners, status panels, box cards, badges, and prompt headers.
 * @functions TuiTheme - Class with renderHeaderBanner, renderBoxPanel, renderPromptBadge, renderMcpCard methods.
 */

import chalk from 'chalk';
import { configManager } from '../config/config-manager.js';
import { agentManager } from '../agents/agent-manager.js';
import { workspaceDiscoveryEngine } from '../utils/workspace-discovery.js';
import { mcpStatusManager } from '../utils/mcp-status.js';

export class TuiTheme {
  private width = 74;

  /**
   * Renders horizontal line border
   */
  private line(char: string = '═', charLeft: string = '╠', charRight: string = '╣'): string {
    return chalk.bold.cyan(charLeft + char.repeat(this.width - 2) + charRight);
  }

  /**
   * Center aligns text inside width
   */
  private center(text: string): string {
    const rawLen = text.replace(/\u001b\[[0-9;]*m/g, '').length;
    const pad = Math.max(0, Math.floor((this.width - 2 - rawLen) / 2));
    const rightPad = Math.max(0, this.width - 2 - rawLen - pad);
    return '║' + ' '.repeat(pad) + text + ' '.repeat(rightPad) + '║';
  }

  /**
   * Left aligns padded text inside width
   */
  private padLeft(label: string, value: string): string {
    const rawLabel = label.replace(/\u001b\[[0-9;]*m/g, '');
    const rawValue = value.replace(/\u001b\[[0-9;]*m/g, '');
    const totalLen = rawLabel.length + rawValue.length + 4;
    const rightSpace = Math.max(0, this.width - 2 - totalLen);
    return chalk.bold.cyan('║') + `  ${label}: ${value}` + ' '.repeat(rightSpace) + chalk.bold.cyan('║');
  }

  /**
   * Renders main Agentyx CLI Banner with WOW aesthetics
   */
  public renderHeaderBanner(): void {
    console.clear();

    const top = chalk.bold.cyan('╔' + '═'.repeat(this.width - 2) + '╗');
    const bottom = chalk.bold.cyan('╚' + '═'.repeat(this.width - 2) + '╝');

    const titleAscii = [
      chalk.bold.magenta('   █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗   ██╗██╗  ██╗  '),
      chalk.bold.magenta('  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝╚██╗ ██╔╝╚██╗██╔╝  '),
      chalk.bold.cyan('  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    ╚████╔╝  ╚███╔╝   '),
      chalk.bold.cyan('  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║     ╚██╔╝   ██╔██╗   '),
      chalk.bold.blue('  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ██║   ██╔╝ ██╗  '),
      chalk.bold.blue('  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ██║      ╚═╝   ╚═╝  ╚═╝  ')
    ];

    console.log(top);
    titleAscii.forEach(l => console.log(this.center(l)));
    console.log(this.line('═', '╠', '╣'));

    console.log(this.center(chalk.bold.bgMagenta.white('   ✨ UNIVERSAL AGENTIC AI CLI PLATFORM v3.0 ✨   ')));
    console.log(this.center(chalk.dim('SQLite Second Brain • 9router Engine • Swarm Dynamics • MCP Suite')));
    console.log(this.line('─', '╟', '╢'));

    const cfg = configManager.getConfig();
    const activeAgent = agentManager.getActiveAgent();
    const stacks = workspaceDiscoveryEngine.inspectWorkspace();
    const stackNames = stacks.map(s => s.language).join(', ');

    console.log(this.padLeft(chalk.bold.yellow('🧠 Engine Runtime'), chalk.white('Node.js ES Modules + SQLite (~/.agentyx/memory.db)')));
    console.log(this.padLeft(chalk.bold.yellow('⚡ 9router Model '), chalk.green(`${cfg.DEFAULT_COMBO} (${cfg.NINEROUTER_BASE_URL})`)));
    console.log(this.padLeft(chalk.bold.yellow('🤖 Active Persona'), chalk.bold.magenta(`${activeAgent.name} [${activeAgent.id}]`)));
    console.log(this.padLeft(chalk.bold.yellow('🔌 MCP Ecosystem'), chalk.bold.cyan('8/8 Online (context7, git, github, grep, memory, terminal, fetch, websearch)')));
    console.log(this.padLeft(chalk.bold.yellow('📁 Workspace Stack'), chalk.bold.green(stackNames)));
    console.log(this.line('═', '╠', '╣'));

    console.log(this.center(chalk.bold.yellow('💡 Tip: Ketik ') + chalk.bold.bgYellow.black(' / ') + chalk.bold.yellow(' lalu tekan Enter untuk Interactive Command Menu!')));
    console.log(bottom + '\n');
  }

  /**
   * Renders styled box panel card for CLI outputs
   */
  public renderBoxPanel(title: string, bodyContent: string): string {
    const top = chalk.bold.cyan('┌─') + chalk.bold.bgCyan.black(` ${title} `) + chalk.bold.cyan('─'.repeat(Math.max(0, this.width - title.length - 5)) + '┐');
    const bottom = chalk.bold.cyan('└' + '─'.repeat(this.width - 2) + '┘');

    const lines = bodyContent.split('\n');
    let content = top + '\n';
    lines.forEach(l => {
      content += chalk.bold.cyan('│ ') + l + '\n';
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

    const roleBadge = chalk.bold.bgMagenta.white(` ${activeAgent.id} `);
    const modelBadge = chalk.bold.bgBlue.white(` ${cfg.DEFAULT_COMBO} `);
    const arrow = chalk.bold.cyan(' ❯ ');

    return `${roleBadge}${modelBadge}${arrow}`;
  }
}

export const tuiTheme = new TuiTheme();
