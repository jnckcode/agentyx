/**
 * @file jamesanz-memory-mcp.ts
 * @description JamesANZ Knowledge-Graph Memory MCP Server Integration Module for Agentyx
 * @purpose Enables cross-session persistent entity memory, relationship tracking, user preferences, and habit caching (JamesANZ/memory-mcp).
 * @functions JamesAnzMemoryMcpServer - Class managing JamesANZ Memory MCP capabilities, entity graph caching, and observation retrieval.
 */

export interface MemoryNode {
  name: string;
  entityType: string;
  observations: string[];
}

export class JamesAnzMemoryMcpServer {
  public static readonly SERVER_NAME = 'jamesanz-memory';
  public static readonly PACKAGE_NAME = 'JamesANZ/memory-mcp';

  public getCapabilities(): string[] {
    return [
      'create_entities - Create persistent entities in local knowledge graph',
      'create_relations - Establish directional relationships between entities',
      'add_observations - Append key technical observations & user preferences to entity memory',
      'open_nodes - Retrieve entity knowledge graph nodes across chat sessions'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
JAMESANZ MEMORY MCP SYSTEM (JamesANZ/memory-mcp):
- Use JamesANZ Memory MCP to store cross-session entity relationships, user preferences, and long-term habits.
- Works alongside SQLite Second Brain (~/.agentyx/memory.db) to maximize persistent context retention.
`;
  }
}

export const jamesAnzMemoryMcpServer = new JamesAnzMemoryMcpServer();
