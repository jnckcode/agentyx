/**
 * @file markdown-renderer.ts
 * @description Rich Terminal Markdown and Codeblock Renderer for Agentyx
 * @purpose Parses markdown elements (headers, codeblocks, lists, quotes, inline code) and renders them with vibrant aesthetic TUI borders and colors.
 * @functions renderMarkdown - Transforms markdown text to terminal ANSI styled string
 */

import chalk from 'chalk';
import { PALETTE } from './tui-theme.js';

export class MarkdownRenderer {
  /**
   * Renders raw markdown into styled ANSI terminal string
   */
  public render(text: string, maxWidth?: number): string {
    if (!text) return '';

    const width = maxWidth || (process.stdout.columns ? Math.min(process.stdout.columns - 4, 100) : 76);
    const lines = text.split('\n');
    const outputLines: string[] = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block detection
      const codeBlockMatch = line.match(/^```(\w*)/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          codeLanguage = codeBlockMatch[1] || 'code';
          codeLines = [];
        } else {
          // Ending a code block
          inCodeBlock = false;
          outputLines.push(this.renderCodeBlockBox(codeLines, codeLanguage, width));
          codeLines = [];
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Headers
      if (/^#\s+(.*)/.test(line)) {
        const title = line.replace(/^#\s+/, '');
        outputLines.push('\n' + chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(` 📌 ${title} `) + '\n');
        continue;
      }
      if (/^##\s+(.*)/.test(line)) {
        const title = line.replace(/^##\s+/, '');
        outputLines.push('\n' + chalk.bold.hex(PALETTE.goldYellow)(`◈ ${title}`));
        continue;
      }
      if (/^###\s+(.*)/.test(line)) {
        const title = line.replace(/^###\s+/, '');
        outputLines.push(chalk.bold.hex(PALETTE.lemonLight)(`  ▸ ${title}`));
        continue;
      }

      // Horizontal Rule
      if (/^([-*_]){3,}$/.test(line.trim())) {
        outputLines.push(chalk.hex(PALETTE.forestMid)('─'.repeat(width)));
        continue;
      }

      // Blockquotes
      if (/^>\s?(.*)/.test(line)) {
        const quote = line.replace(/^>\s?/, '');
        outputLines.push(chalk.hex(PALETTE.forestMid)('▌ ') + chalk.hex(PALETTE.creamSand).italic(this.formatInline(quote)));
        continue;
      }

      // Unordered lists
      if (/^\s*[-*+]\s+(.*)/.test(line)) {
        const match = line.match(/^(\s*)[-*+]\s+(.*)/);
        if (match) {
          const indent = match[1];
          const content = match[2];
          outputLines.push(`${indent}${chalk.bold.hex(PALETTE.warmAmber)('•')} ${chalk.hex(PALETTE.creamSand)(this.formatInline(content))}`);
          continue;
        }
      }

      // Ordered lists
      if (/^\s*(\d+)\.\s+(.*)/.test(line)) {
        const match = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (match) {
          const indent = match[1];
          const num = match[2];
          const content = match[3];
          outputLines.push(`${indent}${chalk.bold.hex(PALETTE.goldYellow)(`${num}.`)} ${chalk.hex(PALETTE.creamSand)(this.formatInline(content))}`);
          continue;
        }
      }

      // Standard text line
      outputLines.push(chalk.hex(PALETTE.creamSand)(this.formatInline(line)));
    }

    // In case code block wasn't closed
    if (inCodeBlock && codeLines.length > 0) {
      outputLines.push(this.renderCodeBlockBox(codeLines, codeLanguage, width));
    }

    return outputLines.join('\n');
  }

  /**
   * Formats inline markdown elements (bold, italic, inline code)
   */
  private formatInline(text: string): string {
    let formatted = text;

    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, (_match, code) => {
      return chalk.bold.bgHex('#1A2E24').hex(PALETTE.lemonLight)(` ${code} `);
    });

    // Bold **text** or __text__
    formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, (_match, _p1, p2) => {
      return chalk.bold.hex(PALETTE.lemonLight)(p2);
    });

    // Italic *text* or _text_
    formatted = formatted.replace(/(\*|_)(.*?)\1/g, (_match, _p1, p2) => {
      return chalk.italic(p2);
    });

    return formatted;
  }

  /**
   * Renders a fenced code block with top badge header and border
   */
  private renderCodeBlockBox(lines: string[], language: string, width: number): string {
    const lang = language ? ` ${language.toUpperCase()} ` : ' CODE ';
    const topBar = chalk.bold.hex(PALETTE.forestMid)('╭─') +
      chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(lang) +
      chalk.bold.hex(PALETTE.forestMid)('─'.repeat(Math.max(0, width - lang.length - 4)) + '╮');
    const bottomBar = chalk.bold.hex(PALETTE.forestMid)('╰' + '─'.repeat(Math.max(0, width - 2)) + '╯');

    const formattedLines = lines.map((l, index) => {
      const lineNum = chalk.hex(PALETTE.dimMuted)((index + 1).toString().padStart(3, ' ') + ' │ ');
      return chalk.bold.hex(PALETTE.forestMid)('│ ') + lineNum + chalk.hex(PALETTE.lemonLight)(l);
    });

    return [topBar, ...formattedLines, bottomBar].join('\n');
  }
}

export const markdownRenderer = new MarkdownRenderer();
