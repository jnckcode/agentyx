/**
 * @file comment-header.ts
 * @description Adaptive Comment Header generator and validator for Polyglot project source files
 * @purpose Generates and audits syntax-adapted comment headers (C-Style, Hash-Style, SQL-Style, HTML-Style) per full-team-promt.md rules.
 * @functions CommentHeaderUtility - Class with generateHeader, detectCommentType, hasValidHeader methods.
 */

import path from 'node:path';

export type CommentSyntaxStyle = 'c-style' | 'hash-style' | 'sql-style' | 'html-style';

export interface HeaderMetadata {
  fileName: string;
  description: string;
  purpose: string;
  functions: string[];
}

export class CommentHeaderUtility {
  /**
   * Detects comment style based on file extension
   */
  public detectCommentStyle(filePath: string): CommentSyntaxStyle {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.py':
      case '.sh':
      case '.bash':
      case '.rb':
      case '.yaml':
      case '.yml':
      case '.dockerfile':
      case '.makefile':
      case '.toml':
        return 'hash-style';

      case '.sql':
        return 'sql-style';

      case '.html':
      case '.xml':
      case '.vue':
      case '.svelte':
        return 'html-style';

      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
      case '.c':
      case '.cpp':
      case '.h':
      case '.hpp':
      case '.java':
      case '.kt':
      case '.rs':
      case '.go':
      case '.cs':
      case '.dart':
      case '.php':
      default:
        return 'c-style';
    }
  }

  /**
   * Generates syntax-adapted comment header string
   */
  public generateHeader(meta: HeaderMetadata, filePath: string): string {
    const style = this.detectCommentStyle(filePath);
    const funcsText = meta.functions.join(', ') || 'N/A';

    switch (style) {
      case 'hash-style':
        return `# @file ${meta.fileName}\n# @description ${meta.description}\n# @purpose ${meta.purpose}\n# @functions ${funcsText}\n\n`;

      case 'sql-style':
        return `-- @file ${meta.fileName}\n-- @description ${meta.description}\n-- @purpose ${meta.purpose}\n-- @functions ${funcsText}\n\n`;

      case 'html-style':
        return `<!--\n  @file ${meta.fileName}\n  @description ${meta.description}\n  @purpose ${meta.purpose}\n  @functions ${funcsText}\n-->\n\n`;

      case 'c-style':
      default:
        return `/**\n * @file ${meta.fileName}\n * @description ${meta.description}\n * @purpose ${meta.purpose}\n * @functions ${funcsText}\n */\n\n`;
    }
  }

  /**
   * Validates if source code contains a valid comment header for its language syntax
   */
  public hasValidHeader(filePath: string, fileContent: string): boolean {
    const style = this.detectCommentStyle(filePath);

    switch (style) {
      case 'hash-style':
        return /#\s*@file[\s\S]*?#\s*@description[\s\S]*?#\s*@purpose/i.test(fileContent);

      case 'sql-style':
        return /--\s*@file[\s\S]*?--\s*@description[\s\S]*?--\s*@purpose/i.test(fileContent);

      case 'html-style':
        return /<!--[\s\S]*?@file[\s\S]*?@description[\s\S]*?@purpose[\s\S]*?-->/i.test(fileContent);

      case 'c-style':
      default:
        return /\/\*\*[\s\S]*?@file[\s\S]*?@description[\s\S]*?@purpose[\s\S]*?\*\//i.test(fileContent);
    }
  }
}

export const commentHeaderUtility = new CommentHeaderUtility();
