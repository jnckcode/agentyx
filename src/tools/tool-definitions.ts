/**
 * @file tool-definitions.ts
 * @description Tool Schema Definitions and Robust Fallback Tool Call Extractor for Agentyx
 * @purpose Defines OpenAI-compatible tool schemas for 9router API and extracts single/multiple JSON tool calls & aliases from LLM text responses.
 * @functions getAgentyxTools, normalizeToolName, parseToolCallsFromText - Tool schemas & multi-JSON tool call extractor.
 */

import { jsonSanitizer } from '../sanitizer/json-sanitizer.js';

export interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ParsedToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export function getAgentyxTools(): OpenAIFunctionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'terminal',
        description: 'Executes bash/sh command in Termux/Linux/macOS shell or cmd/powershell in Windows.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The exact terminal shell command to execute.' },
            cwd: { type: 'string', description: 'Optional working directory path.' }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Reads contents of a file from the workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read.' }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Creates or overwrites a file with content.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write.' },
            content: { type: 'string', description: 'Complete content to write into file.' }
          },
          required: ['path', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'Lists files and folders inside a directory.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list.' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'grep_search',
        description: 'Searches for text pattern in project files.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term or text pattern.' },
            path: { type: 'string', description: 'Optional directory path.' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Performs live web search for documentation or information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Web search query string.' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: 'Fetches URL web page content in markdown format.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Target URL to fetch.' }
          },
          required: ['url']
        }
      }
    }
  ];
}

/**
 * Normalizes tool name aliases like "filesystem.write_file", "terminal.execute_command", etc.
 */
export function normalizeToolName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.toLowerCase().trim();

  if (
    clean.includes('terminal') ||
    clean.includes('exec') ||
    clean.includes('bash') ||
    clean.includes('cmd') ||
    clean.includes('sh') ||
    clean.includes('command')
  ) {
    return 'terminal';
  }
  if (clean.includes('write_file') || clean.includes('create_file') || clean.includes('save_file')) {
    return 'write_file';
  }
  if (clean.includes('read_file') || clean.includes('view_file') || clean.includes('cat')) {
    return 'read_file';
  }
  if (clean.includes('list_dir') || clean.includes('ls') || clean.includes('dir')) {
    return 'list_dir';
  }
  if (clean.includes('grep') || clean.includes('search_file')) {
    return 'grep_search';
  }
  if (clean.includes('web_search') || clean.includes('google')) {
    return 'web_search';
  }
  if (clean.includes('web_fetch') || clean.includes('read_url')) {
    return 'web_fetch';
  }

  return clean;
}

/**
 * Extracts multiple JSON tool calls & action aliases from raw text responses if LLM returns text blocks instead of API tool_calls.
 */
export function parseToolCallsFromText(content: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  if (!content || !content.trim()) return toolCalls;

  const processJsonObject = (obj: Record<string, unknown>) => {
    if (!obj || typeof obj !== 'object') return;

    let rawName = '';
    let rawArgs: Record<string, unknown> = {};

    // Format A: { "tool": "terminal", "command": "..." } or { "tool": "write_file", "path": "...", "content": "..." }
    if (typeof obj.tool === 'string') {
      rawName = obj.tool;
      rawArgs = { ...obj };
      delete rawArgs.tool;
    }
    // Format B: { "action": "filesystem.write_file", "path": "...", "content": "..." }
    else if (typeof obj.action === 'string') {
      rawName = obj.action;
      rawArgs = { ...obj };
      delete rawArgs.action;
    }
    // Format C: { "name": "terminal", "arguments": { "command": "..." } }
    else if (typeof obj.name === 'string') {
      rawName = obj.name;
      if (obj.arguments && typeof obj.arguments === 'object') {
        rawArgs = obj.arguments as Record<string, unknown>;
      } else {
        rawArgs = { ...obj };
        delete rawArgs.name;
      }
    }
    // Format D: { "command": "..." } or { "path": "...", "content": "..." } without explicit tool name key
    else if (typeof obj.command === 'string') {
      rawName = 'terminal';
      rawArgs = { ...obj };
    } else if (typeof obj.path === 'string' && typeof obj.content === 'string') {
      rawName = 'write_file';
      rawArgs = { ...obj };
    }

    if (rawName) {
      const canonicalName = normalizeToolName(rawName);
      toolCalls.push({
        id: `call_${Date.now()}_${toolCalls.length}`,
        name: canonicalName,
        arguments: rawArgs
      });
    }
  };

  // 1. Extract markdown code blocks ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawText = match[1].trim();
    // Try to parse array or single object
    const parsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown> | Array<Record<string, unknown>>>(rawText);
    if (parsed.success && parsed.data) {
      if (Array.isArray(parsed.data)) {
        parsed.data.forEach(item => processJsonObject(item));
      } else {
        processJsonObject(parsed.data as Record<string, unknown>);
      }
    } else {
      // Check for multiple JSON objects inside codeblock without outer array
      const innerJsonMatches = rawText.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g);
      if (innerJsonMatches) {
        for (const jsonStr of innerJsonMatches) {
          const innerParsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(jsonStr);
          if (innerParsed.success && innerParsed.data && typeof innerParsed.data === 'object') {
            processJsonObject(innerParsed.data);
          }
        }
      }
    }
  }

  // 2. Extract standalone JSON objects { ... } from text if no markdown blocks matched
  if (toolCalls.length === 0) {
    const jsonMatches = content.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g);
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        const parsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(jsonStr);
        if (parsed.success && parsed.data && typeof parsed.data === 'object') {
          processJsonObject(parsed.data);
        }
      }
    }
  }

  return toolCalls;
}
