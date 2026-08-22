/**
 * @file webcrawl-mcp.ts
 * @description WebCrawl Local Archive MCP Server Integration Module for Agentyx
 * @purpose Enables searching, filtering, full-text boolean query, and offline RAG analysis over local web archives (wget, WARC, ArchiveBox, HTTrack) via pragmar/mcp-server-webcrawl.
 * @functions WebcrawlMcpServer - Class managing WebCrawl MCP capabilities, archive search, and offline content retrieval.
 */

export interface ArchiveSearchQuery {
  query: string;
  archiveDir?: string;
  fileType?: string;
  limit?: number;
}

export class WebcrawlMcpServer {
  public static readonly SERVER_NAME = 'webcrawl';
  public static readonly PACKAGE_NAME = 'pragmar/mcp-server-webcrawl';

  public getCapabilities(): string[] {
    return [
      'webcrawl_search_archive - Execute full-text & boolean search over local web archives (WARC, wget, ArchiveBox)',
      'webcrawl_list_crawled_sites - List indexed local domain archives and site structures',
      'webcrawl_filter_resources - Filter archived web resources by MIME type, status codes, and path',
      'webcrawl_extract_content - Read offline scraped web content without live internet latency'
    ];
  }

  public getSystemPromptInstruction(): string {
    return `
WEBCRAWL LOCAL ARCHIVE MCP SYSTEM (pragmar/mcp-server-webcrawl):
- Use WebCrawl MCP to query pre-crawled local web datasets, offline documentation mirrors, and WARC archives.
- Enables high-speed offline RAG without needing live HTTP requests or external crawling keys.
`;
  }
}

export const webcrawlMcpServer = new WebcrawlMcpServer();
