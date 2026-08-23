/**
 * @file tool-definitions.ts
 * @description Tool Schema Definitions and Fallback Tool Call Extractor for Agentyx
 * @purpose Defines OpenAI-compatible tool schemas for 9router API and extracts JSON/text tool calls from LLM responses.
 * @functions getAgentyxTools, parseToolCallsFromText - Tool schemas & text tool call parser.
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
 * Extracts tool calls from text responses if the LLM returned JSON code blocks or text tool calls instead of standard API tool_calls.
 */
export function parseToolCallsFromText(content: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];
  if (!content) return toolCalls;

  // 1. Look for ```json { "tool": "...", "command": "..." } ``` or ```json { "name": "...", "arguments": {...} } ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawJson = match[1];
    const parsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(rawJson);

    if (parsed.success && parsed.data && typeof parsed.data === 'object') {
      const obj = parsed.data;

      // Pattern A: { "tool": "terminal", "command": "ls -la" } or { "tool": "read_file", "path": "package.json" }
      if (typeof obj.tool === 'string') {
        const toolName = obj.tool;
        const args = { ...obj };
        delete args.tool;
        toolCalls.push({ name: toolName, arguments: args });
      }
      // Pattern B: { "name": "terminal", "arguments": { "command": "ls" } }
      else if (typeof obj.name === 'string' && obj.arguments && typeof obj.arguments === 'object') {
        toolCalls.push({ name: obj.name, arguments: obj.arguments as Record<string, unknown> });
      }
      // Pattern C: { "action": "terminal", "command": "..." }
      else if (typeof obj.action === 'string' && (obj.command || obj.path || obj.query || obj.url)) {
        const toolName = obj.action;
        const args = { ...obj };
        delete args.action;
        toolCalls.push({ name: toolName, arguments: args });
      }
    }
  }

  // 2. Fallback: Check for raw JSON object if no markdown code fences present
  if (toolCalls.length === 0 && (content.includes('{') && content.includes('}'))) {
    const parsed = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(content);
    if (parsed.success && parsed.data && typeof parsed.data === 'object') {
      const obj = parsed.data;
      if (typeof obj.tool === 'string') {
        const toolName = obj.tool;
        const args = { ...obj };
        delete args.tool;
        toolCalls.push({ name: toolName, arguments: args });
      } else if (typeof obj.name === 'string' && obj.arguments && typeof obj.arguments === 'object') {
        toolCalls.push({ name: obj.name, arguments: obj.arguments as Record<string, unknown> });
      }
    }
  }

  return toolCalls;
}
