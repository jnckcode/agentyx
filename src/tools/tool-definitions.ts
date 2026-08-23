/**
 * @file tool-definitions.ts
 * @description Tool Schema Definitions and Universal Semantic Tool Intent Resolver for Agentyx
 * @purpose Defines OpenAI-compatible tool schemas for 9router API and provides a zero-hardcode universal tool intent & parameter inference engine for any LLM payload.
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
 * Normalizes any raw tool action string or alias into a canonical Agentyx native tool name.
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
    clean.includes('command') ||
    clean.includes('shell') ||
    clean.includes('cli') ||
    clean.includes('system') ||
    clean.includes('run')
  ) {
    return 'terminal';
  }
  if (
    clean.includes('write_file') ||
    clean.includes('create_file') ||
    clean.includes('save_file') ||
    clean.includes('write') ||
    clean.includes('create') ||
    clean.includes('save') ||
    clean.includes('put')
  ) {
    return 'write_file';
  }
  if (
    clean.includes('read_file') ||
    clean.includes('view_file') ||
    clean.includes('read') ||
    clean.includes('view') ||
    clean.includes('cat') ||
    clean.includes('load') ||
    clean.includes('show') ||
    clean.includes('open')
  ) {
    return 'read_file';
  }
  if (
    clean.includes('list_dir') ||
    clean.includes('dir_list') ||
    clean.includes('readdir') ||
    clean.includes('ls') ||
    clean.includes('list') ||
    clean.includes('dir') ||
    clean.includes('tree')
  ) {
    return 'list_dir';
  }
  if (
    clean.includes('grep') ||
    clean.includes('search_file') ||
    clean.includes('find_in_files') ||
    clean.includes('search_code')
  ) {
    return 'grep_search';
  }
  if (clean.includes('web_search') || clean.includes('google') || clean.includes('bing') || clean.includes('search_web')) {
    return 'web_search';
  }
  if (clean.includes('web_fetch') || clean.includes('read_url') || clean.includes('curl') || clean.includes('fetch')) {
    return 'web_fetch';
  }

  return clean;
}

/**
 * Zero-Hardcode Universal Tool Intent & Parameter Inference Engine
 * Inspects any JSON payload structure regardless of key names used by any LLM framework.
 */
export function inferToolCallFromObject(obj: Record<string, unknown>): ParsedToolCall | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  // 1. Extract any candidate tool name key (tool, action, name, function, intent, type, operation, method, call)
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

  // 4. Infer Canonical Tool Name using Intent & Signature Analysis
  let canonicalName = normalizeToolName(rawName);

  if (!canonicalName) {
    // Structural Signature Detection if rawName was missing or unmapped
    if (normalizedArgs.command) {
      canonicalName = 'terminal';
    } else if (normalizedArgs.path && normalizedArgs.content !== undefined) {
      canonicalName = 'write_file';
    } else if (normalizedArgs.path && !normalizedArgs.query) {
      canonicalName = 'read_file';
    } else if (normalizedArgs.query) {
      canonicalName = normalizedArgs.url ? 'web_search' : 'grep_search';
    } else if (normalizedArgs.url) {
      canonicalName = 'web_fetch';
    }
  }

  if (!canonicalName) return null;

  return {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: canonicalName,
    arguments: normalizedArgs
  };
}

/**
 * Extracts all valid tool calls from raw LLM text responses (markdown blocks, multiple JSON objects, or key-agnostic payloads).
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

  return toolCalls;
}
