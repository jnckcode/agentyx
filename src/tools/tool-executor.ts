/**
 * @file tool-executor.ts
 * @description Native Cross-Platform Tool Execution Engine for Agentyx
 * @purpose Executes terminal commands (Termux Android, Linux, macOS, Windows), filesystem operations, web search, and MCP tools with cross-platform safety & directory persistence.
 * @functions ToolExecutor - Class with executeTool, runTerminalCommand, readFile, writeFile, listDir, grepSearch methods.
 */

import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { nineRouterClient } from '../router/ninerouter-client.js';

export interface ToolCallPayload {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
}

export class ToolExecutor {
  /**
   * Expands tilde (~) to user home directory and resolves absolute path cross-platform
   */
  public expandPath(filePath: string): string {
    if (!filePath || !filePath.trim()) return process.cwd();
    let cleaned = filePath.trim();

    if (cleaned.startsWith('~/') || cleaned === '~') {
      cleaned = path.join(os.homedir(), cleaned.slice(1).replace(/^[/\\]/, ''));
    }

    return path.resolve(cleaned);
  }

  /**
   * Dynamically resolves shell executable path across Termux (Android), Linux, macOS, and Windows
   */
  public resolveShell(): string | undefined {
    if (process.platform === 'win32') {
      return undefined; // Uses Windows default cmd.exe / powershell
    }

    // 1. Termux environment detection ($PREFIX/bin/bash or $PREFIX/bin/sh)
    if (process.env.PREFIX) {
      const termuxBash = path.join(process.env.PREFIX, 'bin', 'bash');
      if (fs.existsSync(termuxBash)) return termuxBash;

      const termuxSh = path.join(process.env.PREFIX, 'bin', 'sh');
      if (fs.existsSync(termuxSh)) return termuxSh;
    }

    // 2. Custom $SHELL environment variable check
    if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
      return process.env.SHELL;
    }

    // 3. Standard Linux / macOS / Android fallback paths
    const candidates = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh', '/system/bin/sh'];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Main dispatcher to execute a named tool call
   */
  public async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const name = toolName.toLowerCase().trim();

    try {
      if (name === 'terminal' || name === 'run_command' || name === 'exec' || name === 'bash' || name === 'cmd' || name === 'sh') {
        const command = String(args.command || args.cmd || args.script || '');
        const cwd = args.cwd ? String(args.cwd) : process.cwd();
        return await this.runTerminalCommand(command, cwd);
      }

      if (name === 'read_file' || name === 'view_file' || name === 'cat') {
        const filePath = String(args.path || args.filePath || args.file || '');
        return this.readFile(filePath);
      }

      if (name === 'write_file' || name === 'create_file' || name === 'save_file') {
        const filePath = String(args.path || args.filePath || args.file || '');
        const content = String(args.content || args.text || args.code || '');
        return this.writeFile(filePath, content);
      }

      if (name === 'list_dir' || name === 'ls' || name === 'dir') {
        const dirPath = String(args.path || args.dirPath || args.dir || '.');
        return this.listDir(dirPath);
      }

      if (name === 'grep_search' || name === 'grep' || name === 'search_file') {
        const query = String(args.query || args.pattern || args.term || '');
        const targetPath = String(args.path || '.');
        return this.grepSearch(query, targetPath);
      }

      if (name === 'web_search' || name === 'search_web' || name === 'google') {
        const query = String(args.query || args.term || '');
        const results = await nineRouterClient.performWebSearch(query);
        const formatted = results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
        return {
          toolName,
          success: true,
          output: formatted || 'No search results found.'
        };
      }

      if (name === 'web_fetch' || name === 'read_url' || name === 'fetch_url') {
        const url = String(args.url || args.link || '');
        const res = await nineRouterClient.performWebFetch(url);
        if (!res) {
          return { toolName, success: false, output: 'Failed to fetch URL content via 9router API.' };
        }
        return {
          toolName,
          success: true,
          output: `Title: ${res.title}\nURL: ${res.url}\n\n${res.content.text.slice(0, 4000)}`
        };
      }

      return {
        toolName,
        success: false,
        output: `Unknown tool: ${toolName}. Available tools: terminal, read_file, write_file, list_dir, grep_search, web_search, web_fetch`
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        toolName,
        success: false,
        output: `Tool execution failed (${toolName}): ${errorMsg}`,
        error: errorMsg
      };
    }
  }

  /**
   * Runs terminal command with cross-platform shell detection, `cd` tracking, and environment preservation
   */
  public async runTerminalCommand(command: string, cwd: string = process.cwd()): Promise<ToolExecutionResult> {
    const trimmedCmd = (command || '').trim();
    if (!trimmedCmd) {
      return { toolName: 'terminal', success: false, output: 'Error: Empty terminal command provided.' };
    }

    // Intercept `cd <dir>` commands to persist working directory across turns
    if (trimmedCmd.startsWith('cd ') || trimmedCmd === 'cd') {
      const targetArg = trimmedCmd.slice(2).trim().replace(/^['"]|['"]$/g, '');
      const targetDir = this.expandPath(targetArg || '~');

      if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
        try {
          process.chdir(targetDir);
          return {
            toolName: 'terminal',
            success: true,
            output: `✔ Changed working directory to: ${process.cwd()}`
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { toolName: 'terminal', success: false, output: `Failed to change directory: ${msg}` };
        }
      } else {
        return { toolName: 'terminal', success: false, output: `Directory not found: ${targetDir}` };
      }
    }

    return new Promise((resolve) => {
      const shellExecutable = this.resolveShell();
      const workingDir = this.expandPath(cwd);

      exec(
        trimmedCmd,
        {
          cwd: workingDir,
          timeout: 45000, // 45 second timeout for heavy builds
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          shell: shellExecutable,
          env: {
            ...process.env,
            PAGER: 'cat'
          }
        },
        (error, stdout, stderr) => {
          const combinedOutput = [
            stdout ? stdout.trim() : '',
            stderr ? `[STDERR]:\n${stderr.trim()}` : ''
          ].filter(Boolean).join('\n\n');

          if (error) {
            resolve({
              toolName: 'terminal',
              success: false,
              output: combinedOutput || `Command exited with code ${error.code || 1}: ${error.message}`,
              error: error.message
            });
            return;
          }

          resolve({
            toolName: 'terminal',
            success: true,
            output: combinedOutput || '(Command executed successfully with empty output)'
          });
        }
      );
    });
  }

  /**
   * Reads file content with path expansion & error handling
   */
  public readFile(filePath: string): ToolExecutionResult {
    const resolvedPath = this.expandPath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { toolName: 'read_file', success: false, output: `File not found: ${filePath} (Resolved: ${resolvedPath})` };
    }

    try {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        return { toolName: 'read_file', success: false, output: `Target path is a directory: ${filePath}` };
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return {
        toolName: 'read_file',
        success: true,
        output: `--- File: ${path.relative(process.cwd(), resolvedPath)} (${content.length} bytes) ---\n${content.slice(0, 10000)}`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: 'read_file', success: false, output: `Read error: ${msg}` };
    }
  }

  /**
   * Writes content to file with directory creation
   */
  public writeFile(filePath: string, content: string): ToolExecutionResult {
    const resolvedPath = this.expandPath(filePath);
    const dir = path.dirname(resolvedPath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(resolvedPath, content, 'utf-8');
      return {
        toolName: 'write_file',
        success: true,
        output: `✔ Successfully wrote ${content.length} characters to ${path.relative(process.cwd(), resolvedPath)}`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: 'write_file', success: false, output: `Write error: ${msg}` };
    }
  }

  /**
   * Lists directory contents with icons & sizes
   */
  public listDir(dirPath: string): ToolExecutionResult {
    const resolvedPath = this.expandPath(dirPath);

    if (!fs.existsSync(resolvedPath)) {
      return { toolName: 'list_dir', success: false, output: `Directory not found: ${dirPath}` };
    }

    try {
      const files = fs.readdirSync(resolvedPath);
      const items = files.map(file => {
        try {
          const full = path.join(resolvedPath, file);
          const stat = fs.statSync(full);
          return stat.isDirectory() ? `📁 ${file}/` : `📄 ${file} (${stat.size}B)`;
        } catch {
          return `❓ ${file}`;
        }
      });

      return {
        toolName: 'list_dir',
        success: true,
        output: `--- Directory: ${path.relative(process.cwd(), resolvedPath) || '.'} (${files.length} items) ---\n${items.join('\n')}`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: 'list_dir', success: false, output: `List directory error: ${msg}` };
    }
  }

  /**
   * Searches pattern in workspace files with safety exclusions
   */
  public grepSearch(query: string, searchPath: string = '.'): ToolExecutionResult {
    const resolved = this.expandPath(searchPath);
    const results: string[] = [];

    const walk = (dir: string) => {
      if (results.length > 50) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === '.agentyx' ||
            entry.name.endsWith('.db') ||
            entry.name.endsWith('.sqlite')
          ) {
            continue;
          }

          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            try {
              const content = fs.readFileSync(full, 'utf-8');
              const lines = content.split('\n');
              lines.forEach((line, idx) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  results.push(`${path.relative(process.cwd(), full)}:${idx + 1}: ${line.trim()}`);
                }
              });
            } catch {
              // Ignore binary / unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };

    walk(resolved);

    return {
      toolName: 'grep_search',
      success: true,
      output: results.length > 0 ? results.slice(0, 50).join('\n') : `No matches found for query: "${query}"`
    };
  }
}

export const toolExecutor = new ToolExecutor();
