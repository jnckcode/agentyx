/**
 * @file playwright-mcp.ts
 * @description Playwright MCP (Model Context Protocol) Integration Module for Agentyx
 * @purpose Provides browser automation capabilities, headless E2E testing, visual assertions, and web scraping integration.
 * @functions PlaywrightMcpServer - Class managing Playwright MCP server capabilities, configuration, and browser automation tools.
 */

export interface PlaywrightBrowserTask {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'evaluate' | 'wait';
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
}

export class PlaywrightMcpServer {
  public static readonly SERVER_NAME = 'playwright';
  public static readonly PACKAGE_NAME = '@modelcontextprotocol/server-playwright';

  public getCapabilities(): string[] {
    return [
      'browser_navigate - Open web pages in headless/headed Chromium, Firefox, or WebKit',
      'browser_click - Interact with web elements using CSS selectors or text matches',
      'browser_type - Form input typing with key stroke emulation',
      'browser_screenshot - Capture full-page visual screenshots & artifact generation',
      'browser_evaluate - Execute custom client-side JavaScript in page context',
      'browser_e2e_test - Run automated Playwright E2E assertion test suites'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
PLAYWRIGHT MCP BROWSER AUTOMATION SYSTEM (@modelcontextprotocol/server-playwright):
- Use Playwright MCP for web automation, E2E frontend verification, visual UI regression testing, and interactive scraping.
- Key Actions: navigate(url), click(selector), type(selector, text), screenshot(filename), evaluate(script).
- Ensures headless testing capability across Chromium, Firefox, and WebKit engines.
`;
  }
}

export const playwrightMcpServer = new PlaywrightMcpServer();
