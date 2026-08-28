/**
 * @file version.ts
 * @description Dynamic Version Provider for Agentyx CLI
 * @purpose Reads package version directly from package.json at runtime to guarantee single source of truth across all CLI banners, options, and updaters.
 * @functions getAppVersion - Returns active Agentyx version string.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getAppVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version) {
        return pkg.version;
      }
    }
  } catch {
    // Fallback
  }
  return '3.6.0';
}

export const APP_VERSION = getAppVersion();
