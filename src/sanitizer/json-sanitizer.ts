/**
 * @file json-sanitizer.ts
 * @description Robust JSON Repair & Sanitization Engine for Agentyx AI outputs
 * @purpose Normalizes quotes, extracts boundaries, repairs unclosed brackets/quotes, and provides structured fallback.
 * @functions JsonSanitizer - Class with sanitizeAndParse, normalizeQuotes, extractBoundaries, autoRepairBalance methods
 */

export interface ParsedJsonResult<T = unknown> {
  success: boolean;
  data: T | null;
  repaired: boolean;
  fallbackUsed: boolean;
  raw: string;
  error?: string;
}

export class JsonSanitizer {
  /**
   * Main entrypoint to robustly parse JSON from raw LLM output
   */
  public sanitizeAndParse<T = unknown>(input: string): ParsedJsonResult<T> {
    if (!input || typeof input !== 'string') {
      return this.createFallback('Empty or non-string input');
    }

    const cleaned = input.trim();

    // 1. Direct parse attempt
    try {
      const data = JSON.parse(cleaned) as T;
      return { success: true, data, repaired: false, fallbackUsed: false, raw: cleaned };
    } catch {
      // Proceed to repair steps
    }

    // 2. Extract JSON Boundaries (```json ... ``` or first { / [ to last } / ])
    const extracted = this.extractBoundaries(cleaned);

    // Try direct parse on extracted
    try {
      const data = JSON.parse(extracted) as T;
      return { success: true, data, repaired: true, fallbackUsed: false, raw: extracted };
    } catch {
      // Continue repair
    }

    // 3. Quote Normalization
    const normalized = this.normalizeQuotes(extracted);
    try {
      const data = JSON.parse(normalized) as T;
      return { success: true, data, repaired: true, fallbackUsed: false, raw: normalized };
    } catch {
      // Continue repair
    }

    // 4. Unclosed Balance Auto-Repair
    const repaired = this.autoRepairBalance(normalized);
    try {
      const data = JSON.parse(repaired) as T;
      return { success: true, data, repaired: true, fallbackUsed: false, raw: repaired };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.createFallback(errorMsg, cleaned);
    }
  }

  /**
   * Extracts JSON payload boundaries from surrounding text or markdown blocks
   */
  public extractBoundaries(text: string): string {
    // Strips markdown code fence blocks if present
    let content = text.replace(/```(?:json)?([\s\S]*?)```/gi, '$1').trim();

    const firstBrace = content.indexOf('{');
    const firstBracket = content.indexOf('[');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = content.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = content.lastIndexOf(']');
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return content.slice(startIdx, endIdx + 1);
    }

    if (startIdx !== -1) {
      return content.slice(startIdx);
    }

    return content;
  }

  /**
   * Normalizes single quotes to double quotes for JSON keys & strings
   */
  public normalizeQuotes(jsonCandidate: string): string {
    let result = jsonCandidate;

    // Convert single quoted keys: 'key': -> "key":
    result = result.replace(/([{,]\s*)'([a-zA-Z0-9_$]+)'\s*:/g, '$1"$2":');

    // Convert single quoted string values: : 'value' -> : "value"
    result = result.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');

    // Fix trailing commas in objects or arrays
    result = result.replace(/,(\s*[}\]])/g, '$1');

    return result;
  }

  /**
   * Auto-repairs unclosed brackets, braces, and strings truncated mid-stream
   */
  public autoRepairBalance(str: string): string {
    let output = str.trim();

    // Check open string quotes count
    let inString = false;
    let escaped = false;
    const stack: string[] = [];

    for (let i = 0; i < output.length; i++) {
      const char = output[i];
      if (char === '\\' && !escaped) {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
      } else if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}' && stack[stack.length - 1] === '{') {
          stack.pop();
        } else if (char === ']' && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }

      escaped = false;
    }

    // Close unclosed string quote if still open
    if (inString) {
      output += '"';
    }

    // Close open brackets in reverse order
    while (stack.length > 0) {
      const open = stack.pop();
      if (open === '{') output += '}';
      if (open === '[') output += ']';
    }

    return output;
  }

  /**
   * Standardized Fallback payload when parsing fails completely
   */
  private createFallback<T>(reason: string, rawInput = ''): ParsedJsonResult<T> {
    return {
      success: false,
      data: {
        status: 'fallback_error',
        reason,
        rawContent: rawInput
      } as unknown as T,
      repaired: false,
      fallbackUsed: true,
      raw: rawInput,
      error: reason
    };
  }
}

export const jsonSanitizer = new JsonSanitizer();
