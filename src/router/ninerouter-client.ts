/**
 * @file ninerouter-client.ts
 * @description HTTP Client integration for self-hosted 9router API instance
 * @purpose Fetches available combo models, manages chat completions, web search, web fetch, and embeddings per official 9Router Skill specs.
 * @functions NineRouterClient - Class with listModels, listModelsByKind, sendChatCompletion, performWebSearch, performWebFetch, generateEmbeddings methods.
 */

import fetch from 'node-fetch';
import { configManager, AgentyxConfig } from '../config/config-manager.js';
import { thinkingIsolator, IsolatedResult } from '../sanitizer/thinking-isolator.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  kind?: string;
  owned_by?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  display_url?: string;
  score?: number;
}

export interface WebFetchResponse {
  provider: string;
  url: string;
  title: string;
  content: {
    format: string;
    text: string;
    length: number;
  };
}

export class NineRouterClient {
  private getConfig(): AgentyxConfig {
    return configManager.getConfig();
  }

  /**
   * Fetches list of available models / combos from 9router
   */
  public async listModels(): Promise<ModelInfo[]> {
    const cfg = this.getConfig();
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/models`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`9router API error (${response.status}): ${response.statusText}`);
      }

      const body = (await response.json()) as { data?: ModelInfo[] };
      return body.data || [{ id: cfg.DEFAULT_COMBO }];
    } catch {
      // Return default combo fallback if server unreachable
      return [
        { id: cfg.DEFAULT_COMBO, name: 'Default Combo (Offline Fallback)' },
        { id: 'jnckcode-fast', name: 'Jnckcode Fast' },
        { id: 'jnckcode-pro', name: 'Jnckcode Pro' }
      ];
    }
  }

  /**
   * Discovers models by specific capability kind (e.g. 'web', 'embedding', 'image', 'tts', 'stt') per 9Router Skill spec
   */
  public async listModelsByKind(kind: 'web' | 'embedding' | 'image' | 'tts' | 'stt'): Promise<ModelInfo[]> {
    const cfg = this.getConfig();
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/models/${kind}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`9router API error (${response.status}): ${response.statusText}`);
      }

      const body = (await response.json()) as { data?: ModelInfo[] };
      return body.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Sends chat completion request to 9router with thinking isolation
   */
  public async sendChatCompletion(
    messages: ChatMessage[],
    modelOverride?: string,
    onThoughtChunk?: (chunk: string) => void,
    onContentChunk?: (chunk: string) => void
  ): Promise<{ content: string; thought: string }> {
    const cfg = this.getConfig();
    const model = modelOverride || cfg.DEFAULT_COMBO;
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`9router API request failed (${response.status}): ${errorText}`);
      }

      const resJson = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawContent = resJson.choices?.[0]?.message?.content || '';

      // Run through ThinkingIsolator
      const isolated: IsolatedResult = thinkingIsolator.isolateThinking(rawContent);

      if (isolated.hasThought && onThoughtChunk) {
        onThoughtChunk(isolated.thought);
      }
      if (onContentChunk) {
        onContentChunk(isolated.cleanContent);
      }

      return {
        content: isolated.cleanContent,
        thought: isolated.thought
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const fallbackMsg = `[9router Offline / Connection Fallback]: ${msg}\nAgentyx response ready.`;
      return {
        content: fallbackMsg,
        thought: '9router offline fallback triggered.'
      };
    }
  }

  /**
   * Executes web search via 9Router /v1/search (Skill 9router-web-search)
   */
  public async performWebSearch(query: string, model: string = 'tavily', maxResults: number = 5): Promise<WebSearchResult[]> {
    const cfg = this.getConfig();
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/search`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, query, max_results: maxResults })
      });

      if (!response.ok) {
        throw new Error(`9Router web search error (${response.status})`);
      }

      const data = (await response.json()) as { results?: WebSearchResult[] };
      return data.results || [];
    } catch {
      return [];
    }
  }

  /**
   * Extracts URL content to Markdown via 9Router /v1/web/fetch (Skill 9router-web-fetch)
   */
  public async performWebFetch(targetUrl: string, model: string = 'jina-reader', format: string = 'markdown'): Promise<WebFetchResponse | null> {
    const cfg = this.getConfig();
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/web/fetch`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, url: targetUrl, format })
      });

      if (!response.ok) {
        throw new Error(`9Router web fetch error (${response.status})`);
      }

      return (await response.json()) as WebFetchResponse;
    } catch {
      return null;
    }
  }

  /**
   * Generates vector embeddings via 9Router /v1/embeddings (Skill 9router-embeddings)
   */
  public async generateEmbeddings(input: string | string[], model: string = 'openai/text-embedding-3-small'): Promise<number[][]> {
    const cfg = this.getConfig();
    const url = `${cfg.NINEROUTER_BASE_URL.replace(/\/$/, '')}/embeddings`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.NINEROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, input })
      });

      if (!response.ok) {
        throw new Error(`9Router embeddings error (${response.status})`);
      }

      const res = (await response.json()) as { data?: Array<{ embedding: number[] }> };
      return res.data?.map(item => item.embedding) || [];
    } catch {
      return [];
    }
  }
}

export const nineRouterClient = new NineRouterClient();

