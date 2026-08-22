/**
 * @file ninerouter-client.ts
 * @description HTTP Client integration for self-hosted 9router API instance
 * @purpose Fetches available combo models and manages chat completion streaming with thinking isolation.
 * @functions NineRouterClient - Class with listModels, chatCompletionStream, chatCompletionSync methods
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
  owned_by?: string;
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
      // Simulation / Fallback answer if 9router isn't currently running locally
      const fallbackMsg = `[9router Offline / Connection Fallback]: ${msg}\nAgentyx response ready.`;
      return {
        content: fallbackMsg,
        thought: '9router offline fallback triggered.'
      };
    }
  }
}

export const nineRouterClient = new NineRouterClient();
