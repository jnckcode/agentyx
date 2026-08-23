/**
 * @file tool-definitions.ts
 * @description Tool Schema Definitions, Tokenized Intent Resolver, and Shell Codeblock Interceptor for Agentyx
 * @purpose Defines OpenAI-compatible tool schemas for 9router API and provides shell codeblock fallback interception.
 * @functions getAgentyxTools, normalizeToolName, inferToolCallFromObject, parseToolCallsFromText - Tool schemas & universal tool call extractor.
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
 * Normalizes any raw tool action string or alias into a canonical Agentyx native tool name using token boundary matching.
 */
export function normalizeToolName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.toLowerCase().trim();
  const tokens = clean.split(/[._\-\s\/]+/);

  // Check write_file tokens first
  if (tokens.some(t => ['write_file', 'write', 'create_file', 'create', 'save_file', 'save', 'put'].includes(t)) || clean.includes('write_file')) {
    return 'write_file';
  }

  // Check read_file tokens
  if (tokens.some(t => ['read_file', 'read', 'view_file', 'view', 'cat', 'load', 'show', 'open'].includes(t)) || clean.includes('read_file')) {
    return 'read_file';
  }

  // Check list_dir tokens
  if (tokens.some(t => ['list_dir', 'readdir', 'ls', 'dir_list', 'tree'].includes(t)) || clean.includes('list_dir')) {
    return 'list_dir';
  }

  // Check grep_search tokens
  if (tokens.some(t => ['grep', 'grep_search', 'search_file', 'find_in_files'].includes(t)) || clean.includes('grep_search')) {
    return 'grep_search';
  }

  // Check web_search tokens
  if (tokens.some(t => ['web_search', 'google', 'bing', 'search_web'].includes(t)) || clean.includes('web_search')) {
    return 'web_search';
  }

  // Check web_fetch tokens
  if (tokens.some(t => ['web_fetch', 'read_url', 'curl', 'fetch'].includes(t)) || clean.includes('web_fetch')) {
    return 'web_fetch';
  }

  // Check terminal tokens (exact token matching to avoid false substring match of 'sh' inside 'filesystem')
  if (tokens.some(t => ['terminal', 'execute_command', 'exec', 'bash', 'cmd', 'shell', 'cli', 'system', 'command', 'run'].includes(t)) || clean.includes('terminal')) {
    return 'terminal';
  }

  return clean;
}

/**
 * Universal Tool Intent & Parameter Inference Engine
 * Uses structural signature checking first, followed by tokenized name normalization.
 */
export function inferToolCallFromObject(obj: Record<string, unknown>): ParsedToolCall | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  // 1. Extract any candidate tool name key
  let rawName = '';
  const possibleNameKeys = ['tool', 'action', 'name', 'function', 'intent', 'type', 'operation', 'method', 'call', 'tool_name'];
  for (const k of possibleNameKeys) {
    if (typeof obj[k] === 'string' && obj[k]) {
      rawName = obj[k] as string;
      break;
    }
  }

  // 2. Extract raw arguments dictionary from nested wrapper or root properties
  let rawArgs: Record<string, unknown> = {};
  if (obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments)) {
    rawArgs = { ...(obj.arguments as Record<string, unknown>) };
  } else if (obj.parameters && typeof obj.parameters === 'object' && !Array.isArray(obj.parameters)) {
    rawArgs = { ...(obj.parameters as Record<string, unknown>) };
  } else if (obj.input && typeof obj.input === 'object' && !Array.isArray(obj.input)) {
    rawArgs = { ...(obj.input as Record<string, unknown>) };
  } else if (obj.params && typeof obj.params === 'object' && !Array.isArray(obj.params)) {
    rawArgs = { ...(obj.params as Record<string, unknown>) };
  } else {
    rawArgs = { ...obj };
    possibleNameKeys.forEach(k => delete rawArgs[k]);
  }

  // 3. Normalize parameter key variations into canonical Agentyx arguments
  const normalizedArgs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawArgs)) {
    const lk = k.toLowerCase();
    if (['command', 'cmd', 'script', 'shell', 'code_command', 'exec'].includes(lk) && typeof v === 'string') {
      normalizedArgs['command'] = v;
    } else if (['path', 'file', 'filepath', 'filename', 'target', 'file_path', 'dest'].includes(lk) && typeof v === 'string') {
      normalizedArgs['path'] = v;
    } else if (['content', 'text', 'code', 'data', 'body', 'file_content'].includes(lk) && typeof v === 'string') {
      normalizedArgs['content'] = v;
    } else if (['query', 'pattern', 'search', 'term', 'keyword', 'q'].includes(lk) && typeof v === 'string') {
      normalizedArgs['query'] = v;
    } else if (['url', 'link', 'href', 'uri'].includes(lk) && typeof v === 'string') {
      normalizedArgs['url'] = v;
    } else if (['cwd', 'working_dir', 'dir_path', 'directory'].includes(lk) && typeof v === 'string') {
      normalizedArgs['cwd'] = v;
    } else {
      normalizedArgs[k] = v;
    }
  }

  // 4. Structural Signature Check FIRST (Highest Priority to prevent name alias confusion)
  let canonicalName = '';

  if (normalizedArgs.path && normalizedArgs.content !== undefined) {
    canonicalName = 'write_file';
  } else if (normalizedArgs.command && !normalizedArgs.content) {
    canonicalName = 'terminal';
  } else if (normalizedArgs.path && !normalizedArgs.query) {
    canonicalName = 'read_file';
  } else if (normalizedArgs.query) {
    canonicalName = normalizedArgs.url ? 'web_search' : 'grep_search';
  } else if (normalizedArgs.url) {
    canonicalName = 'web_fetch';
  }

  // Fallback to tokenized tool name normalization if signature was ambiguous
  if (!canonicalName) {
    canonicalName = normalizeToolName(rawName);
  }

  if (!canonicalName) return null;

  return {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: canonicalName,
    arguments: normalizedArgs
  };
}

/**
 * Extracts all valid tool calls from raw LLM text responses:
 * 1. Markdown JSON codeblocks
 * 2. Multiple raw JSON objects
 * 3. Fallback Interceptor for tagged shell/bash codeblocks (```bash ... ```)
 */
export function parseToolCallsFromText(content: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  if (!content || !content.trim()) return toolCalls;

  const tryAddObject = (obj: Record<string, unknown>) => {
    const inferred = inferToolCallFromObject(obj);
    if (inferred) {
      toolCalls.push(inferred);
    }
  };

  // 1. Extract markdown code blocks ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawText = match[1].trim();
    const parsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown> | Array<Record<string, unknown>>>(rawText);
    if (parsed.success && parsed.data) {
      if (Array.isArray(parsed.data)) {
        parsed.data.forEach(item => tryAddObject(item));
      } else {
        tryAddObject(parsed.data as Record<string, unknown>);
      }
    } else {
      // Extract multiple JSON objects inside codeblock without outer array
      const innerJsonMatches = rawText.match(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g);
      if (innerJsonMatches) {
        for (const jsonStr of innerJsonMatches) {
          const innerParsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(jsonStr);
          if (innerParsed.success && innerParsed.data && typeof innerParsed.data === 'object') {
            tryAddObject(innerParsed.data);
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
          tryAddObject(parsed.data);
        }
      }
    }
  }

  // 3. Fallback Interceptor: Shell/Bash Codeblocks (```bash ... ```, ```sh ... ```, ```cmd ... ```)
  // If no structured JSON tool call was extracted, catch tagged shell blocks and convert to terminal tool call automatically!
  if (toolCalls.length === 0) {
    const shellBlockRegex = /```(?:bash|sh|shell|powershell|cmd|zsh)\s*([\s\S]*?)\s*```/gi;
    let shellMatch;
    while ((shellMatch = shellBlockRegex.exec(content)) !== null) {
      const rawCmd = shellMatch[1].trim();
      if (rawCmd && !rawCmd.startsWith('{')) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          name: 'terminal',
          arguments: { command: rawCmd }
        });
      }
    }
  }

  return toolCalls;
}
