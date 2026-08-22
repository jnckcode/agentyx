/**
 * @file ninerouter-skills.ts
 * @description 9Router Multi-Capability Skill System for Agentyx Swarm
 * @purpose Implements official 9Router Skill specs (9router, 9router-chat, 9router-embeddings, 9router-web-search, 9router-web-fetch) to prevent model disorganization.
 * @functions NineRouterSkillsManager - Class providing skill definitions, endpoint specifications, and model classification.
 */

export interface NineRouterSkillDef {
  name: string;
  description: string;
  rawUrl: string;
  kindEndpoint: string;
  primaryEndpoint: string;
}

export class NineRouterSkillsManager {
  public static readonly SKILLS: NineRouterSkillDef[] = [
    {
      name: '9router',
      description: 'Entry point for 9Router local/remote AI gateway with OpenAI-compatible REST endpoints.',
      rawUrl: 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router/SKILL.md',
      kindEndpoint: '/v1/models',
      primaryEndpoint: '/api/health'
    },
    {
      name: '9router-chat',
      description: 'Chat & code generation using /v1/chat/completions (OpenAI) or /v1/messages (Anthropic) with streaming & combo auto-fallback.',
      rawUrl: 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router-chat/SKILL.md',
      kindEndpoint: '/v1/models',
      primaryEndpoint: '/v1/chat/completions'
    },
    {
      name: '9router-embeddings',
      description: 'Vector embeddings via /v1/embeddings using OpenAI, Gemini, Mistral, Voyage, Nvidia, or GitHub models.',
      rawUrl: 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router-embeddings/SKILL.md',
      kindEndpoint: '/v1/models/embedding',
      primaryEndpoint: '/v1/embeddings'
    },
    {
      name: '9router-web-search',
      description: 'Web search via /v1/search using Tavily, Exa, Brave, Serper, SearXNG, Google PSE, Linkup, SearchAPI, Perplexity.',
      rawUrl: 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router-web-search/SKILL.md',
      kindEndpoint: '/v1/models/web',
      primaryEndpoint: '/v1/search'
    },
    {
      name: '9router-web-fetch',
      description: 'Web scraping & URL-to-markdown conversion via /v1/web/fetch using Firecrawl, Jina Reader, Tavily Extract, Exa.',
      rawUrl: 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router-web-fetch/SKILL.md',
      kindEndpoint: '/v1/models/web',
      primaryEndpoint: '/v1/web/fetch'
    }
  ];

  public getSkillByName(name: string): NineRouterSkillDef | undefined {
    return NineRouterSkillsManager.SKILLS.find(s => s.name === name);
  }

  public getAllSkills(): NineRouterSkillDef[] {
    return NineRouterSkillsManager.SKILLS;
  }

  public getSystemPromptInstruction(): string {
    return `
9ROUTER SYSTEM CAPABILITY SKILLS (5 OFFICIAL SKILLS):
1. 9router (Core Gateway): Endpoint /v1/models, /api/health. Multi-provider auto-fallback.
2. 9router-chat (Chat & Code-Gen): OpenAI format (/v1/chat/completions) and Anthropic format (/v1/messages). Combos auto-fallback.
3. 9router-embeddings (RAG & Vector Embeddings): Endpoint /v1/embeddings, supports float/base64, batch array input.
4. 9router-web-search (Live Web Search): Endpoint /v1/search, model kind 'webSearch' (Tavily, Exa, Brave, Serper, SearXNG, Linkup).
5. 9router-web-fetch (Web Content Extractor): Endpoint /v1/web/fetch, model kind 'webFetch' (Firecrawl, Jina Reader, Tavily, Exa). Converts URL to Markdown/Text/HTML.
`;
  }
}

export const nineRouterSkillsManager = new NineRouterSkillsManager();
