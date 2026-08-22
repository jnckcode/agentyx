/**
 * @file gsheets-mcp.ts
 * @description Google Sheets MCP Server Integration Module for Agentyx
 * @purpose Enables reading, writing, row appending, formula calculations, and spreadsheet management via Google Sheets API (freema/mcp-gsheets).
 * @functions GSheetsMcpServer - Class managing Google Sheets MCP server capabilities, spreadsheet operations, and row updates.
 */

export interface SheetRangeQuery {
  spreadsheetId: string;
  range: string;
}

export class GSheetsMcpServer {
  public static readonly SERVER_NAME = 'mcp-gsheets';
  public static readonly PACKAGE_NAME = 'freema/mcp-gsheets';

  public getCapabilities(): string[] {
    return [
      'gsheets_read_range - Read cell ranges & values from Google Sheets spreadsheet',
      'gsheets_write_range - Update cell values & apply formulas in specified range',
      'gsheets_append_row - Append new data rows to bottom of Google Sheet',
      'gsheets_manage_tabs - Create, rename, clear, or manage sheet tab properties'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
GOOGLE SHEETS MCP SERVER SYSTEM (freema/mcp-gsheets):
- Use Google Sheets MCP to read, write, append, and analyze spreadsheets directly in Google Drive.
- Useful for exporting data tables, parsing CSV/XLSX data in Google Cloud, and tracking project metrics.
`;
  }
}

export const gsheetsMcpServer = new GSheetsMcpServer();
