#!/usr/bin/env node

/**
 * @file agentyx.js
 * @description Global binary entrypoint executable for Agentyx CLI (Cross-platform Windows & Linux)
 * @purpose Delegates execution to compiled dist/index.js with error handling and automatic build fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distEntry = path.join(__dirname, '..', 'dist', 'index.js');

if (!fs.existsSync(distEntry)) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Agentyx build artifact not found at dist/index.js.');
  console.log('\x1b[33m%s\x1b[0m', '💡 Running `npm run build` to compile TypeScript project...');

  try {
    const { execSync } = await import('node:child_process');
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Build failed. Please run `npm run build` manually in the agentyx project directory.');
    process.exit(1);
  }
}

import('../dist/index.js').catch((err) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Fatal error starting Agentyx CLI:', err);
  process.exit(1);
});
