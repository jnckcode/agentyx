/**
 * @file tui-pager.ts
 * @description Interactive Full-Screen / Viewport Scroll Pager for Agentyx TUI
 * @purpose Allows smooth keyboard-driven scrolling through long AI responses, tool logs, and chat histories with a pinned header and navigation footer.
 * @functions openScrollPager - Opens interactive scroll viewer and resolves when user exits
 */

import chalk from 'chalk';
import readline from 'node:readline';
import { PALETTE } from './tui-theme.js';
import { markdownRenderer } from './markdown-renderer.js';

export interface PagerOptions {
  title?: string;
  renderAsMarkdown?: boolean;
}

export class TuiPager {
  /**
   * Opens an interactive scrollable pager in the terminal
   */
  public async open(content: string, options: PagerOptions = {}): Promise<void> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      // Non-interactive fallback: just print directly
      console.log(content);
      return;
    }

    const title = options.title || 'Agentyx Response Viewer';
    const formattedContent = options.renderAsMarkdown !== false
      ? markdownRenderer.render(content, Math.max(40, (process.stdout.columns || 80) - 4))
      : content;

    const allLines = formattedContent.split('\n');
    let scrollOffset = 0;

    return new Promise<void>((resolve) => {
      // Save current stdin state
      const wasRaw = process.stdin.isRaw;
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Enter pager mode screen
      process.stdout.write('\x1b[?1049h\x1b[H\x1b[?25l'); // enter alt screen, hide cursor

      const renderView = () => {
        const termWidth = Math.max(40, process.stdout.columns || 80);
        const termHeight = Math.max(10, process.stdout.rows || 24);
        const viewportHeight = Math.max(1, termHeight - 4); // 2 header lines + 2 footer lines

        const maxOffset = Math.max(0, allLines.length - viewportHeight);
        scrollOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

        const visibleLines = allLines.slice(scrollOffset, scrollOffset + viewportHeight);
        while (visibleLines.length < viewportHeight) {
          visibleLines.push('');
        }

        // Pinned Header
        const headerTitle = ` 📖 ${title} `;
        const headerBorder = '═'.repeat(Math.max(0, termWidth - headerTitle.length - 4));
        const topHeader = chalk.bold.hex(PALETTE.forestMid)('╔═') +
          chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(headerTitle) +
          chalk.bold.hex(PALETTE.forestMid)(headerBorder + '╗');

        // Pinned Footer
        const currentLineEnd = Math.min(allLines.length, scrollOffset + viewportHeight);
        const currentLineStart = allLines.length === 0 ? 0 : scrollOffset + 1;
        const percent = allLines.length > 0 ? Math.round((currentLineEnd / allLines.length) * 100) : 100;
        const progressText = ` Line ${currentLineStart}-${currentLineEnd}/${allLines.length} (${percent}%) `;
        const helpText = ` [▲/▼/PgUp/PgDn/Home/End: Scroll • q/Esc/Enter: Kembali] `;

        const rightSpace = Math.max(0, termWidth - progressText.length - helpText.length - 4);
        const bottomFooter = chalk.bold.hex(PALETTE.forestMid)('╚═') +
          chalk.bold.bgHex(PALETTE.warmAmber).hex('#1A1A1A')(progressText) +
          ' '.repeat(rightSpace) +
          chalk.hex(PALETTE.creamSand)(helpText) +
          chalk.bold.hex(PALETTE.forestMid)('═╝');

        // Draw entire screen buffer at once
        let buffer = '\x1b[H'; // move to (0,0)
        buffer += topHeader + '\n';
        for (const l of visibleLines) {
          // Clear line then print content truncated or padded
          buffer += '\x1b[2K' + l + '\n';
        }
        buffer += bottomFooter;

        process.stdout.write(buffer);
      };

      const cleanup = () => {
        process.stdin.removeListener('keypress', onKeyPress);
        process.stdout.removeListener('resize', onResize);

        // Leave alt screen & restore cursor
        process.stdout.write('\x1b[?1049l\x1b[?25h');

        if (process.stdin.setRawMode) {
          try {
            process.stdin.setRawMode(Boolean(wasRaw));
          } catch {}
        }
        resolve();
      };

      const onResize = () => {
        renderView();
      };

      const onKeyPress = (_str: string, key: readline.Key) => {
        if (!key) return;

        const termHeight = Math.max(10, process.stdout.rows || 24);
        const viewportHeight = Math.max(1, termHeight - 4);

        if (key.name === 'q' || key.name === 'escape' || key.name === 'return' || (key.ctrl && key.name === 'c')) {
          cleanup();
          return;
        }

        if (key.name === 'up' || key.name === 'k') {
          scrollOffset = Math.max(0, scrollOffset - 1);
          renderView();
        } else if (key.name === 'down' || key.name === 'j') {
          scrollOffset++;
          renderView();
        } else if (key.name === 'pageup' || (key.ctrl && key.name === 'b')) {
          scrollOffset = Math.max(0, scrollOffset - viewportHeight);
          renderView();
        } else if (key.name === 'pagedown' || key.name === 'space' || (key.ctrl && key.name === 'f')) {
          scrollOffset += viewportHeight;
          renderView();
        } else if (key.name === 'home' || key.name === 'g') {
          scrollOffset = 0;
          renderView();
        } else if (key.name === 'end' || key.name === 'G') {
          scrollOffset = allLines.length;
          renderView();
        }
      };

      process.stdin.on('keypress', onKeyPress);
      process.stdout.on('resize', onResize);

      renderView();
    });
  }
}

export const tuiPager = new TuiPager();
