/**
 * @file init.ts
 * @description /init Slash Command implementation for mandatory project documentation bundle
 * @purpose Initializes workflow.md, footprint.md, agent.md, and prompt.md in the current directory.
 * @functions executeInitCommand - Creates 4 manifest files and indexes project in SQLite Second Brain.
 */

import { manifestManager } from '../docs/manifest-manager.js';
import { projectIndexer } from '../database/project-indexer.js';
import chalk from 'chalk';

export function executeInitCommand(targetDir: string = process.cwd()): string {
  const result = manifestManager.initBundle();
  const indexedCount = projectIndexer.indexProject(targetDir);

  let output = chalk.bold.cyan('\n[Agentyx Project Initializer]\n');

  if (result.created.length > 0) {
    output += chalk.green(`✔ Created Manifest Files: ${result.created.join(', ')}\n`);
  }
  if (result.existing.length > 0) {
    output += chalk.yellow(`ℹ Existing Manifest Files Preserved: ${result.existing.join(', ')}\n`);
  }

  output += chalk.blue(`✔ Indexed ${indexedCount} project files into SQLite Second Brain (~/.agentyx/memory.db)\n`);
  manifestManager.logFootprint('PROJECT_INIT', `Initialized mandatory 4 manifest documentation bundle and indexed ${indexedCount} files.`);

  return output;
}
