/**
 * @file codebase-index-mcp.ts
 * @description Codebase Indexing & Semantic Search MCP Server Integration Module for Agentyx
 * @purpose Enables AST-powered codebase indexing, symbol lookup, call-graph resolution, and semantic search (MikeRecognex/mcp-codebase-index).
 * @functions CodebaseIndexMcpServer - Class managing Codebase Index MCP capabilities, symbol queries, and call-graph resolution.
 */

export interface CodebaseIndexQuery {
  symbol?: string;
  query?: string;
  filePattern?: string;
}

export class CodebaseIndexMcpServer {
  public static readonly SERVER_NAME = 'codebase-index';
  public static readonly PACKAGE_NAME = 'MikeRecognex/mcp-codebase-index';

  public getCapabilities(): string[] {
    return [
      'codebase_index_workspace - Index local workspace AST symbols, classes, and function signatures',
      'codebase_search_symbols - Perform semantic symbol search across polyglot project files',
      'codebase_call_graph - Resolve caller/callee function call graphs & cross-file references',
      'codebase_semantic_query - Locate code implementation snippets by natural language semantic query'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
CODEBASE INDEX MCP SYSTEM (MikeRecognex/mcp-codebase-index):
- Use Codebase Index MCP for deep structural codebase navigation, symbol lookup, and call-graph analysis.
- Complements AST-grep & Second Brain to provide complete workspace symbol intelligence.
`;
  }
}

export const codebaseIndexMcpServer = new CodebaseIndexMcpServer();
