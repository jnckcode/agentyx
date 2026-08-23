/**
 * @file tool-executor.ts
 * @description Native Tool Execution Engine for Agentyx
 * @purpose Executes terminal commands (Termux/Linux/Windows), filesystem operations, web search, and MCP tools with cross-platform safety.
 * @functions ToolExecutor - Class with executeTool, runTerminalCommand, readFile, writeFile, listDir, grepSearch methods.
 */

import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
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
   * Main dispatcher to execute a named tool call
   */
  public async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const name = toolName.toLowerCase().trim();

    try {
      if (name === 'terminal' || name === 'run_command' || name === 'exec' || name === 'bash' || name === 'cmd') {
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
   * Runs terminal bash/sh/cmd command with cross-platform support (Termux, Linux, Windows)
   */
  public async runTerminalCommand(command: string, cwd: string = process.cwd()): Promise<ToolExecutionResult> {
    if (!command || !command.trim()) {
      return { toolName: 'terminal', success: false, output: 'Error: Empty terminal command provided.' };
    }

    return new Promise((resolve) => {
      // Shell options: on Termux/Linux use /bin/sh or bash, on Windows use default shell
      const isWindows = process.platform === 'win32';
      const shellOption = isWindows ? undefined : (process.env.SHELL || '/bin/sh');

      exec(
        command,
        {
          cwd: path.resolve(cwd),
          timeout: 30000, // 30 second safety timeout
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer
          shell: shellOption
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
              output: combinedOutput || `Command failed with code ${error.code || 1}: ${error.message}`,
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
   * Reads file content from local path
   */
  public readFile(filePath: string): ToolExecutionResult {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return { toolName: 'read_file', success: false, output: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      return { toolName: 'read_file', success: false, output: `Target path is a directory, not a file: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return {
      toolName: 'read_file',
      success: true,
      output: `--- File: ${filePath} (${content.length} bytes) ---\n${content.slice(0, 8000)}`
    };
  }

  /**
   * Writes content to local file
   */
  public writeFile(filePath: string, content: string): ToolExecutionResult {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
    return {
      toolName: 'write_file',
      success: true,
      output: `✔ Successfully wrote ${content.length} characters to ${filePath}`
    };
  }

  /**
   * Lists directory contents
   */
  public listDir(dirPath: string): ToolExecutionResult {
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      return { toolName: 'list_dir', success: false, output: `Directory not found: ${dirPath}` };
    }

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
      output: `--- Directory Listing: ${dirPath} ---\n${items.join('\n')}`
    };
  }

  /**
   * Searches pattern in workspace files
   */
  public grepSearch(query: string, searchPath: string = '.'): ToolExecutionResult {
    const resolved = path.resolve(searchPath);
    const results: string[] = [];

    const walk = (dir: string) => {
      if (results.length > 50) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
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
            // Ignore unreadable binary files
          }
        }
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
