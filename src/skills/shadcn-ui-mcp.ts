/**
 * @file shadcn-ui-mcp.ts
 * @description Shadcn UI MCP Server Integration Module for Agentyx
 * @purpose Provides direct access to shadcn/ui v4 components, blocks, demos, and multi-framework UI discovery (@jpisnice/shadcn-ui-mcp-server).
 * @functions ShadcnUiMcpServer - Class managing Shadcn UI MCP server capabilities, component registry, and design integration.
 */

export interface ShadcnComponentQuery {
  name: string;
  category?: 'component' | 'block' | 'demo';
  framework?: 'react' | 'nextjs' | 'vue' | 'svelte' | 'react-native';
}

export class ShadcnUiMcpServer {
  public static readonly SERVER_NAME = 'shadcn-ui';
  public static readonly PACKAGE_NAME = '@jpisnice/shadcn-ui-mcp-server';
  public static readonly REPO_URL = 'Jpisnice/shadcn-ui-mcp-server';

  public getCapabilities(): string[] {
    return [
      'shadcn_search_components - Discover components, blocks, and UI demos from shadcn/ui registry',
      'shadcn_get_component_code - Retrieve exact TypeScript/JSX code for shadcn components (Button, Dialog, Sheet, Form, Table)',
      'shadcn_get_block_layout - Fetch full UI dashboard/form block templates',
      'shadcn_verify_props - Check component props, variants, and Tailwind styling config'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
SHADCN/UI MCP SERVER INTEGRATION (@jpisnice/shadcn-ui-mcp-server / Jpisnice/shadcn-ui-mcp-server):
- Use shadcn-ui MCP for instant access to shadcn/ui v4 components, UI blocks (Dashboards, Forms, Cards), and official demos.
- Reduces AI code hallucination when building modern React/Next.js/Tailwind UI.
- Works hand-in-hand with UI/UX Pro Max design intelligence for premium glassmorphism & component styling.
`;
  }
}

export const shadcnUiMcpServer = new ShadcnUiMcpServer();
