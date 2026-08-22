/**
 * @file thinking-isolator.ts
 * @description Thinking / Reasoning isolator module for 9router response streams
 * @purpose Isolates `<thought>...</thought>` blocks and `"thought": ...` JSON keys so reasoning is separated from execution payloads.
 * @functions ThinkingIsolator - Class with isolateThinking, extractThoughtChunk, cleanContent methods
 */

export interface IsolatedResult {
  thought: string;
  cleanContent: string;
  hasThought: boolean;
}

export class ThinkingIsolator {
  /**
   * Separates thought content from clean output payload from a full string
   */
  public isolateThinking(rawInput: string): IsolatedResult {
    let thoughtText = '';
    let cleanContent = rawInput;

    // Pattern 1: <thought>...</thought> or <think>...</think> tags
    const tagRegex = /<(thought|think)>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(rawInput)) !== null) {
      thoughtText += (thoughtText ? '\n' : '') + match[2].trim();
    }

    if (thoughtText) {
      cleanContent = rawInput.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, '').trim();
    }

    // Pattern 2: Unclosed <thought> or <think> tag at stream end
    const openTagRegex = /<(thought|think)>([\s\S]*)$/i;
    const openMatch = openTagRegex.exec(cleanContent);
    if (openMatch) {
      thoughtText += (thoughtText ? '\n' : '') + openMatch[2].trim();
      cleanContent = cleanContent.replace(/<(thought|think)>[\s\S]*$/i, '').trim();
    }

    // Pattern 3: JSON key "thought": "..." or "thinking": "..."
    const jsonThoughtRegex = /"(thought|thinking)"\s*:\s*"([\s\S]*?)"(?=\s*[,}])\s*/gi;
    let jsonMatch: RegExpExecArray | null;
    while ((jsonMatch = jsonThoughtRegex.exec(cleanContent)) !== null) {
      thoughtText += (thoughtText ? '\n' : '') + jsonMatch[2].trim();
    }

    return {
      thought: thoughtText.trim(),
      cleanContent: cleanContent.trim(),
      hasThought: thoughtText.trim().length > 0
    };
  }

  /**
   * Helper for live streaming chunks to extract partial thinking tags
   */
  public processStreamChunk(chunk: string, currentState: { inThought: boolean; thoughtBuffer: string; contentBuffer: string }): {
    thoughtDelta: string;
    contentDelta: string;
  } {
    let thoughtDelta = '';
    let contentDelta = '';

    if (currentState.inThought) {
      const closeIndex = chunk.indexOf('</thought>') !== -1 ? chunk.indexOf('</thought>') : chunk.indexOf('</think>');
      if (closeIndex !== -1) {
        thoughtDelta = chunk.slice(0, closeIndex);
        currentState.inThought = false;
        const tagLength = chunk.includes('</thought>') ? 10 : 8;
        contentDelta = chunk.slice(closeIndex + tagLength);
      } else {
        thoughtDelta = chunk;
      }
    } else {
      const openIndex = chunk.indexOf('<thought>') !== -1 ? chunk.indexOf('<thought>') : chunk.indexOf('<think>');
      if (openIndex !== -1) {
        contentDelta = chunk.slice(0, openIndex);
        currentState.inThought = true;
        const tagLength = chunk.includes('<thought>') ? 9 : 7;
        thoughtDelta = chunk.slice(openIndex + tagLength);
      } else {
        contentDelta = chunk;
      }
    }

    currentState.thoughtBuffer += thoughtDelta;
    currentState.contentBuffer += contentDelta;

    return { thoughtDelta, contentDelta };
  }
}

export const thinkingIsolator = new ThinkingIsolator();
