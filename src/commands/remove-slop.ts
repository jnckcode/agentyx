/**
 * @file remove-slop.ts
 * @description /remove-slop Slash Command implementation for AI Slop cleanup
 * @purpose Scans project workspace for temporary files, backup files, log files, and excessive slop comments.
 * @functions executeRemoveSlopCommand - Performs AI slop detection and file cleanup.
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { manifestManager } from '../docs/manifest-manager.js';

export interface SlopScanResult {
  removedFiles: string[];
  cleanedCommentsCount: number;
}

export function executeRemoveSlopCommand(targetDir: string = process.cwd()): string {
  const removedFiles: string[] = [];
  let cleanedCommentsCount = 0;

  const tempPatterns = [
    /\.tmp$/i,
    /\.bak$/i,
    /~$/,
    /^temp[-_]/i,
    /^scratch[-_]/i
  ];

  function scanDirectory(dir: string): void {
    const list = fs.readdirSync(dir);
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', '.agentyx']);

    for (const file of list) {
      if (ignoreDirs.has(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const isSlopFile = tempPatterns.some(p => p.test(file));
        if (isSlopFile) {
          try {
            fs.unlinkSync(fullPath);
            removedFiles.push(path.relative(targetDir, fullPath));
          } catch {
            // Ignore if locked
          }
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          // Clean excessive slop comments
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const slopCommentRegex = /\/\/\s*(TODO:?\s*REMOVE THIS|TEMP SLOP|REMOVE ME)[\s\S]*?\n/gi;
            if (slopCommentRegex.test(content)) {
              const cleaned = content.replace(slopCommentRegex, '');
              fs.writeFileSync(fullPath, cleaned, 'utf-8');
              cleanedCommentsCount++;
            }
          } catch {
            // Skip
          }
        }
      }
    }
  }

  scanDirectory(targetDir);

  let output = chalk.bold.magenta('\n[Agentyx AI Slop Cleaner]\n');
  if (removedFiles.length === 0 && cleanedCommentsCount === 0) {
    output += chalk.green('✔ Clean workspace! No AI slop detected.\n');
  } else {
    if (removedFiles.length > 0) {
      output += chalk.yellow(`✔ Removed ${removedFiles.length} temporary/backup file(s):\n  - ${removedFiles.join('\n  - ')}\n`);
    }
    if (cleanedCommentsCount > 0) {
      output += chalk.yellow(`✔ Cleaned slop comment markers from ${cleanedCommentsCount} file(s)\n`);
    }
  }

  manifestManager.logFootprint(
    'REMOVE_SLOP',
    `Cleaned AI Slop: ${removedFiles.length} temp file(s) removed, ${cleanedCommentsCount} comment file(s) cleaned.`
  );

  return output;
}
