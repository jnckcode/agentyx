/**
 * @file tui-engine.ts
 * @description Full-Screen Interactive TUI Engine with Pinned Header, Scrollable Viewport, and Bottom Input
 * @purpose Implements a true full-screen terminal application (like Lazygit/OpenCode/K9s) with stationary top header, mouse/keyboard scrollable chat history, persistent input HUD, and robust raw-data stream parser that eliminates character anomalies.
 * @functions TuiEngine - Full lifecycle terminal UI manager with renderFrame, handleData, and scroll controls.
 */

import chalk from 'chalk';
import { PALETTE } from './tui-theme.js';
import { markdownRenderer } from './markdown-renderer.js';
import { agentManager } from '../agents/agent-manager.js';
import { configManager } from '../config/config-manager.js';
import { workspaceDiscoveryEngine } from '../utils/workspace-discovery.js';
import { getAppVersion } from '../utils/version.js';

export const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]|(?:\x1b[O\\[][A-Za-z0-9])/g;

export function stripAnsi(str: string): string {
  return (str || '').replace(ANSI_REGEX, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  sender?: string;
  content: string;
  thought?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolSuccess?: boolean;
  timestamp: string;
}

export class TuiEngine {
  private messages: UiMessage[] = [];
  private inputBuffer: string = '';
  private cursorIndex: number = 0;
  private history: string[] = [];
  private historyIndex: number = -1;

  private scrollOffset: number = 0; // 0 = scrolled to bottom, > 0 = scrolled up
  private isAutoScroll: boolean = true;
  private statusText: string = 'Ketik / untuk Menu Perintah • PgUp/PgDn/Mouse Wheel untuk Scroll';
  private isBusy: boolean = false;
  private spinnerFrame: number = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private sessionTitle: string = 'Default Sesi';

  private onInputSubmit?: (input: string) => Promise<void>;
  private isRunning: boolean = false;

  private SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  /**
   * Initializes Full-Screen TUI mode with SGR Mouse & Bracketed Paste reporting
   */
  public start(onInputSubmit: (input: string) => Promise<void>): void {
    this.onInputSubmit = onInputSubmit;
    this.isRunning = true;

    if (process.stdin.isTTY) {
      // Enter Alternate Screen Buffer, normal cursor keys mode (\x1b[?1l), normal keypad mode (\x1b>),
      // enable mouse tracking (SGR mode), enable bracketed paste, hide native cursor
      process.stdout.write('\x1b[?1049h\x1b[?1l\x1b>\x1b[?1000h\x1b[?1002h\x1b[?1006h\x1b[?2004h\x1b[?25l');
      
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      process.stdin.on('data', this.handleRawData);
      process.stdout.on('resize', this.handleResize);
    }

    this.render();
  }

  /**
   * Restores original terminal screen state cleanly
   */
  public stop(): void {
    this.isRunning = false;
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }

    if (process.stdin.isTTY) {
      process.stdin.removeListener('data', this.handleRawData);
      process.stdout.removeListener('resize', this.handleResize);

      // Disable mouse tracking, disable bracketed paste, leave alternate screen, show cursor
      process.stdout.write('\x1b[?1006l\x1b[?1002l\x1b[?1000l\x1b[?2004l\x1b[?1049l\x1b[?25h');

      if (process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(false);
        } catch {}
      }
    }
  }

  public setSessionTitle(title: string): void {
    this.sessionTitle = title;
    this.render();
  }

  public setStatus(text: string, isBusy: boolean = false): void {
    this.statusText = text;
    this.isBusy = isBusy;

    if (isBusy && !this.spinnerInterval) {
      this.spinnerInterval = setInterval(() => {
        this.spinnerFrame = (this.spinnerFrame + 1) % this.SPINNER_FRAMES.length;
        this.render();
      }, 80);
    } else if (!isBusy && this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      this.render();
    }
  }

  public addMessage(msg: Omit<UiMessage, 'id' | 'timestamp'>): void {
    const message: UiMessage = {
      ...msg,
      id: Math.random().toString(36).slice(2, 9),
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    this.messages.push(message);

    if (this.isAutoScroll) {
      this.scrollOffset = 0;
    }
    this.render();
  }

  public updateLastAssistantMessage(content: string, thought?: string): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        this.messages[i].content = content;
        if (thought) this.messages[i].thought = thought;
        if (this.isAutoScroll) this.scrollOffset = 0;
        this.render();
        return;
      }
    }
    this.addMessage({ role: 'assistant', content, thought, sender: agentManager.getActiveAgent().name });
  }

  public clearMessages(): void {
    this.messages = [];
    this.scrollOffset = 0;
    this.isAutoScroll = true;
    this.render();
  }

  public scrollUp(lines: number = 1): void {
    this.scrollOffset += lines;
    this.isAutoScroll = false;
    this.render();
  }

  public scrollDown(lines: number = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    if (this.scrollOffset === 0) {
      this.isAutoScroll = true;
    }
    this.render();
  }

  public scrollToTop(): void {
    this.scrollOffset = 999999;
    this.isAutoScroll = false;
    this.render();
  }

  public scrollToBottom(): void {
    this.scrollOffset = 0;
    this.isAutoScroll = true;
    this.render();
  }

  private handleResize = (): void => {
    this.render();
  };

  private insertText(text: string): void {
    this.inputBuffer = this.inputBuffer.slice(0, this.cursorIndex) + text + this.inputBuffer.slice(this.cursorIndex);
    this.cursorIndex += text.length;
    this.render();
  }

  private handleKeyUp(): void {
    if (this.inputBuffer === '' && this.historyIndex === -1) {
      this.scrollUp(2);
      return;
    }
    if (this.history.length > 0) {
      if (this.historyIndex === -1) {
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.inputBuffer = this.history[this.historyIndex] || '';
      this.cursorIndex = this.inputBuffer.length;
      this.render();
    }
  }

  private handleKeyDown(): void {
    if (this.inputBuffer === '' && this.historyIndex === -1) {
      this.scrollDown(2);
      return;
    }
    if (this.historyIndex !== -1) {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.inputBuffer = this.history[this.historyIndex] || '';
      } else {
        this.historyIndex = -1;
        this.inputBuffer = '';
      }
      this.cursorIndex = this.inputBuffer.length;
      this.render();
    }
  }

  /**
   * Bulletproof Raw Data Stream Parser:
   * Accurately parses SGR mouse wheel, Arrow keys, navigation sequences, control keys,
   * and guarantees ZERO anomaly characters (like A, B, C, D, [) leak into the input buffer.
   */
  private handleRawData = (data: Buffer): void => {
    const str = data.toString('utf-8');

    // 1. SGR Extended Mouse Sequence (\x1b[<Cb;Cx;CyM or m)
    const sgrMatch = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (sgrMatch) {
      const code = parseInt(sgrMatch[1], 10);
      if (code === 64) {
        // Mouse Wheel UP
        this.scrollUp(3);
        return;
      } else if (code === 65) {
        // Mouse Wheel DOWN
        this.scrollDown(3);
        return;
      }
      // Silently discard other mouse motion/click events
      return;
    }

    // 2. Bracketed Paste Mode (\x1b[200~ ... \x1b[201~)
    if (str.startsWith('\x1b[200~') || str.includes('\x1b[201~')) {
      const cleanPaste = str
        .replace(/\x1b\[200~/g, '')
        .replace(/\x1b\[201~/g, '')
        .replace(/[\r\n]+/g, ' ')
        .trim();
      if (cleanPaste) {
        this.insertText(cleanPaste);
      }
      return;
    }

    // 3. Escape Sequences (Arrow keys, Navigation, Function keys)
    if (str.startsWith('\x1b')) {
      // Up Arrow
      if (str === '\x1b[A' || str === '\x1bOA' || /^\x1b\[1;\d+A$/.test(str)) {
        this.handleKeyUp();
        return;
      }

      // Down Arrow
      if (str === '\x1b[B' || str === '\x1bOB' || /^\x1b\[1;\d+B$/.test(str)) {
        this.handleKeyDown();
        return;
      }

      // Right Arrow
      if (str === '\x1b[C' || str === '\x1bOC' || /^\x1b\[1;\d+C$/.test(str)) {
        this.cursorIndex = Math.min(this.inputBuffer.length, this.cursorIndex + 1);
        this.render();
        return;
      }

      // Left Arrow
      if (str === '\x1b[D' || str === '\x1bOD' || /^\x1b\[1;\d+D$/.test(str)) {
        this.cursorIndex = Math.max(0, this.cursorIndex - 1);
        this.render();
        return;
      }

      // Page Up
      if (str === '\x1b[5~' || str === '\x1b[[5~') {
        const height = process.stdout.rows || 24;
        this.scrollUp(Math.max(1, height - 8));
        return;
      }

      // Page Down
      if (str === '\x1b[6~' || str === '\x1b[[6~') {
        const height = process.stdout.rows || 24;
        this.scrollDown(Math.max(1, height - 8));
        return;
      }

      // Home
      if (str === '\x1b[H' || str === '\x1b[1~' || str === '\x1bOH' || str === '\x1b[7~') {
        this.cursorIndex = 0;
        this.render();
        return;
      }

      // End
      if (str === '\x1b[F' || str === '\x1b[4~' || str === '\x1bOF' || str === '\x1b[8~') {
        this.cursorIndex = this.inputBuffer.length;
        this.render();
        return;
      }

      // Delete key
      if (str === '\x1b[3~' || str === '\x1b[3;5~') {
        if (this.cursorIndex < this.inputBuffer.length) {
          this.inputBuffer = this.inputBuffer.slice(0, this.cursorIndex) + this.inputBuffer.slice(this.cursorIndex + 1);
          this.render();
        }
        return;
      }

      // Escape alone
      if (str === '\x1b') {
        if (this.scrollOffset > 0) {
          this.scrollToBottom();
        }
        return;
      }

      // Any other escape sequence starting with \x1b is safely ignored and NEVER leaked
      return;
    }

    // 4. Control Characters
    if (str === '\x03') {
      // Ctrl+C
      if (this.isBusy) {
        this.setStatus('Operasi dibatalkan.', false);
        return;
      }
      this.stop();
      process.exit(0);
      return;
    }

    if (str === '\x01') {
      // Ctrl+A -> Home
      this.cursorIndex = 0;
      this.render();
      return;
    }

    if (str === '\x05') {
      // Ctrl+E -> End
      this.cursorIndex = this.inputBuffer.length;
      this.render();
      return;
    }

    if (str === '\x15') {
      // Ctrl+U -> Clear before cursor
      this.inputBuffer = this.inputBuffer.slice(this.cursorIndex);
      this.cursorIndex = 0;
      this.render();
      return;
    }

    if (str === '\x0b') {
      // Ctrl+K -> Clear after cursor
      this.inputBuffer = this.inputBuffer.slice(0, this.cursorIndex);
      this.render();
      return;
    }

    if (str === '\x0c') {
      // Ctrl+L -> Force redraw
      this.render();
      return;
    }

    // Backspace (\x08 or \x7f)
    if (str === '\x08' || str === '\x7f') {
      if (this.cursorIndex > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorIndex - 1) + this.inputBuffer.slice(this.cursorIndex);
        this.cursorIndex--;
        this.render();
      }
      return;
    }

    // Enter / Return
    if (str === '\r' || str === '\n' || str === '\r\n') {
      const submitted = this.inputBuffer.trim();
      if (!submitted || this.isBusy) return;

      this.history.push(submitted);
      this.historyIndex = -1;
      this.inputBuffer = '';
      this.cursorIndex = 0;
      this.scrollToBottom();

      if (this.onInputSubmit) {
        this.onInputSubmit(submitted);
      }
      return;
    }

    // 5. Printable Text Characters (Strict sanitization: strip any remaining control chars)
    const sanitized = str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    if (sanitized.length > 0) {
      this.insertText(sanitized);
    }
  };

  /**
   * Main Frame Render Engine: Draws Pinned Header, Scrollable Viewport, and Pinned Input HUD
   */
  public render(): void {
    if (!this.isRunning) return;

    const termCols = Math.max(64, process.stdout.columns || 80);
    const termRows = Math.max(16, process.stdout.rows || 24);

    const activeAgent = agentManager.getActiveAgent();
    const cfg = configManager.getConfig();
    const stacks = workspaceDiscoveryEngine.inspectWorkspace();
    const stackNames = stacks.map(s => s.language).join(', ') || 'Universal Polyglot';

    // 1. BUILD TOP PINNED HEADER (4 Rows)
    const headerBorderTop = chalk.bold.hex(PALETTE.forestDark)('╔' + '═'.repeat(termCols - 2) + '╗');
    const headerBorderMid = chalk.bold.hex(PALETTE.forestDark)('╠' + '═'.repeat(termCols - 2) + '╣');
    const headerBorderDivider = chalk.bold.hex(PALETTE.forestDark)('╟' + '─'.repeat(termCols - 2) + '╢');

    const appBadge = chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ⚡ AGENTYX v${getAppVersion()} `);
    const agentBadge = chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(` 🤖 ${activeAgent.name} [${activeAgent.id}] `);
    const modelBadge = chalk.bold.hex(PALETTE.lemonLight)(`🧠 ${cfg.DEFAULT_COMBO} `) + chalk.hex(PALETTE.dimMuted)(`(${cfg.NINEROUTER_BASE_URL})`);

    const headerLine1Content = `${appBadge} ${chalk.hex(PALETTE.forestMid)('│')} ${agentBadge} ${chalk.hex(PALETTE.forestMid)('│')} ${modelBadge}`;
    const headerLine1Pad = Math.max(0, termCols - 4 - visibleLength(headerLine1Content));
    const headerLine1 = chalk.bold.hex(PALETTE.forestDark)('║ ') + headerLine1Content + ' '.repeat(headerLine1Pad) + chalk.bold.hex(PALETTE.forestDark)(' ║');

    const stackBadge = chalk.hex(PALETTE.creamSand)(`📁 ${stackNames}`);
    const sessionBadge = chalk.bold.hex(PALETTE.goldYellow)(`💾 ${this.sessionTitle} `) + chalk.hex(PALETTE.dimMuted)(`(${this.messages.length} msgs)`);
    const mcpBadge = chalk.bold.hex(PALETTE.forestLight)('🔌 MCP: 8 Active');

    const headerLine2Content = `${stackBadge} ${chalk.hex(PALETTE.forestMid)('│')} ${sessionBadge} ${chalk.hex(PALETTE.forestMid)('│')} ${mcpBadge}`;
    const headerLine2Pad = Math.max(0, termCols - 4 - visibleLength(headerLine2Content));
    const headerLine2 = chalk.bold.hex(PALETTE.forestDark)('║ ') + headerLine2Content + ' '.repeat(headerLine2Pad) + chalk.bold.hex(PALETTE.forestDark)(' ║');

    const headerLines = [
      headerBorderTop,
      headerLine1,
      headerLine2,
      headerBorderMid
    ];

    // 2. BUILD BOTTOM PINNED BAR (4 Rows)
    const spinnerChar = this.isBusy ? chalk.bold.hex(PALETTE.lemonLight)(this.SPINNER_FRAMES[this.spinnerFrame] + ' ') : '';
    const statusTextFormatted = this.isBusy
      ? `${spinnerChar}${chalk.bold.hex(PALETTE.goldYellow)(this.statusText)}`
      : chalk.hex(PALETTE.dimMuted)(`💡 ${this.statusText}`);

    const statusPad = Math.max(0, termCols - 4 - visibleLength(statusTextFormatted));
    const statusLine = chalk.bold.hex(PALETTE.forestDark)('║ ') + statusTextFormatted + ' '.repeat(statusPad) + chalk.bold.hex(PALETTE.forestDark)(' ║');

    // Prompt Input Line
    const promptBadge = chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` ${activeAgent.id} `) +
      chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(` ${cfg.DEFAULT_COMBO} `) +
      chalk.bold.hex(PALETTE.goldYellow)(' ❯ ');

    const beforeCursor = this.inputBuffer.slice(0, this.cursorIndex);
    const cursorChar = this.inputBuffer[this.cursorIndex] || ' ';
    const afterCursor = this.inputBuffer.slice(this.cursorIndex + 1);

    const cursorFormatted = chalk.inverse(cursorChar);
    const inputContent = `${promptBadge}${chalk.hex(PALETTE.creamSand)(beforeCursor)}${cursorFormatted}${chalk.hex(PALETTE.creamSand)(afterCursor)}`;
    const inputPad = Math.max(0, termCols - 4 - visibleLength(inputContent));
    const inputLine = chalk.bold.hex(PALETTE.forestDark)('║ ') + inputContent + ' '.repeat(inputPad) + chalk.bold.hex(PALETTE.forestDark)(' ║');

    const bottomBorder = chalk.bold.hex(PALETTE.forestDark)('╚' + '═'.repeat(termCols - 2) + '╝');

    const footerLines = [
      headerBorderDivider,
      statusLine,
      inputLine,
      bottomBorder
    ];

    // 3. BUILD MIDDLE SCROLLABLE VIEWPORT
    const viewportHeight = Math.max(4, termRows - headerLines.length - footerLines.length);
    const viewportWidth = termCols - 4; // 2 left margin, 2 right margin

    // Wrap and format all messages into single line array
    const allFormattedLines: string[] = [];

    if (this.messages.length === 0) {
      allFormattedLines.push('');
      allFormattedLines.push(chalk.bold.hex(PALETTE.goldYellow)('  Selamat datang di Agentyx Agentic AI Platform!'));
      allFormattedLines.push(chalk.hex(PALETTE.creamSand)('  Ketik pertanyaan, instruksi kerja polyglot, atau ketik ') + chalk.bold.hex(PALETTE.lemonLight)('/') + chalk.hex(PALETTE.creamSand)(' untuk Interactive Command Menu.'));
      allFormattedLines.push(chalk.hex(PALETTE.dimMuted)('  Gunakan mouse wheel atau tombol PageUp/PageDown untuk scroll isi terminal ini kapan saja.'));
      allFormattedLines.push('');
    } else {
      for (const msg of this.messages) {
        if (msg.role === 'user') {
          allFormattedLines.push('');
          allFormattedLines.push(chalk.bold.hex(PALETTE.goldYellow)('👤 Anda:') + chalk.hex(PALETTE.dimMuted)(` (${msg.timestamp})`));
          const userLines = msg.content.split('\n');
          userLines.forEach(l => allFormattedLines.push(chalk.hex(PALETTE.textLight)(`  ${l}`)));
          allFormattedLines.push('');
        } else if (msg.role === 'assistant') {
          allFormattedLines.push('');
          allFormattedLines.push(chalk.bold.hex(PALETTE.lemonLight)(`🤖 ${msg.sender || activeAgent.name}:`) + chalk.hex(PALETTE.dimMuted)(` (${msg.timestamp})`));

          if (msg.thought) {
            allFormattedLines.push(chalk.hex(PALETTE.dimMuted).italic(`  💭 Thought: ${msg.thought.slice(0, 120)}...`));
          }

          const renderedMarkdown = markdownRenderer.render(msg.content, viewportWidth - 2);
          const aiLines = renderedMarkdown.split('\n');
          aiLines.forEach(l => allFormattedLines.push(`  ${l}`));
          allFormattedLines.push('');
        } else if (msg.role === 'tool') {
          const statusIcon = msg.toolSuccess ? chalk.bold.hex(PALETTE.forestLight)('✔') : chalk.red('❌');
          allFormattedLines.push(`  ${statusIcon} ${chalk.bold.hex(PALETTE.warmAmber)(`[Tool: ${msg.toolName || 'terminal'}]`)}`);
          const toolLines = msg.content.split('\n');
          toolLines.slice(0, 8).forEach(l => allFormattedLines.push(chalk.hex(PALETTE.creamSand)(`    ${l}`)));
          if (toolLines.length > 8) {
            allFormattedLines.push(chalk.hex(PALETTE.dimMuted)(`    ... (${toolLines.length - 8} baris disembunyikan)`));
          }
        }
      }
    }

    // Calculate Scroll Offset & Clamping
    const maxOffset = Math.max(0, allFormattedLines.length - viewportHeight);
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxOffset));

    const startIndex = Math.max(0, allFormattedLines.length - viewportHeight - this.scrollOffset);
    const visibleViewportLines = allFormattedLines.slice(startIndex, startIndex + viewportHeight);

    while (visibleViewportLines.length < viewportHeight) {
      visibleViewportLines.push('');
    }

    // Draw viewport with vertical scrollbar on right border
    const viewportRendered: string[] = [];
    const totalLines = allFormattedLines.length;

    visibleViewportLines.forEach((line, idx) => {
      const cleanLen = visibleLength(line);
      const rightPad = Math.max(0, viewportWidth - cleanLen);

      let scrollChar = chalk.bold.hex(PALETTE.forestDark)('║');
      if (totalLines > viewportHeight) {
        const thumbHeight = Math.max(1, Math.floor((viewportHeight / totalLines) * viewportHeight));
        const thumbStart = Math.floor((startIndex / totalLines) * viewportHeight);
        if (idx >= thumbStart && idx < thumbStart + thumbHeight) {
          scrollChar = chalk.bold.hex(PALETTE.warmAmber)('█');
        } else {
          scrollChar = chalk.hex(PALETTE.forestMid)('░');
        }
      }

      viewportRendered.push(chalk.bold.hex(PALETTE.forestDark)('║ ') + line + ' '.repeat(rightPad) + ' ' + scrollChar);
    });

    // Atomic screen flush
    let fullBuffer = '\x1b[H'; // Home cursor
    fullBuffer += headerLines.join('\n') + '\n';
    fullBuffer += viewportRendered.join('\n') + '\n';
    fullBuffer += footerLines.join('\n');

    process.stdout.write(fullBuffer);
  }
}

export const tuiEngine = new TuiEngine();
