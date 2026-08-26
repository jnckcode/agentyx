/**
 * @file update.ts
 * @description /update Slash Command & CLI updater for Agentyx
 * @purpose Checks npm registry/git for newer versions and autonomously updates Agentyx globally (npm install -g or git pull & rebuild) without requiring clean reinstall.
 * @functions executeUpdateCommand, checkLatestVersion - Updates Agentyx in-place and checks registry version.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import ora from 'ora';
import { manifestManager } from '../docs/manifest-manager.js';
import { PALETTE } from '../ui/tui-theme.js';
import { getAppVersion } from '../utils/version.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getCurrentVersion(): string {
  return getAppVersion();
}

export async function checkLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('https://registry.npmjs.org/agentyx/latest', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json() as { version?: string };
      return data.version || null;
    }
  } catch {
    // Attempt fallback with npm CLI
    try {
      const { stdout } = await execAsync('npm view agentyx version', { timeout: 4000 });
      const ver = stdout.trim();
      if (ver && /^\d+\.\d+\.\d+/.test(ver)) {
        return ver;
      }
    } catch {
      // Offline / network failure
    }
  }
  return null;
}

export function isNewerVersion(current: string, latest: string): boolean {
  const cParts = current.split('.').map(n => parseInt(n, 10) || 0);
  const lParts = latest.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function executeUpdateCommand(force: boolean = false): Promise<string> {
  const currentVersion = getCurrentVersion();
  const spinner = ora(chalk.bold.hex(PALETTE.goldYellow)(`Memeriksa versi terbaru Agentyx dari npm registry...`)).start();

  const latestVersion = await checkLatestVersion();

  if (!latestVersion && !force) {
    spinner.warn(chalk.hex(PALETTE.warmAmber)(`Gagal memeriksa versi terbaru dari npm registry (mungkin offline atau package baru).`));
    return chalk.hex(PALETTE.creamSand)(`\nℹ Versi lokal saat ini: v${currentVersion}\n`) + chalk.bold.hex(PALETTE.warmAmber)(`💡 Untuk memaksa pembaruan: /update force atau jalankan 'npm install -g agentyx@latest'\n`);
  }

  const hasUpdate = latestVersion ? isNewerVersion(currentVersion, latestVersion) : false;

  if (!hasUpdate && !force) {
    spinner.succeed(chalk.bold.hex(PALETTE.lemonLight)(`Agentyx sudah menggunakan versi terbaru: v${currentVersion}`));
    return chalk.bold.hex(PALETTE.lemonLight)(`\n✔ Versi Agentyx Anda sudah up-to-date (v${currentVersion}). Tidak perlu update!\n`);
  }

  spinner.text = chalk.bold.hex(PALETTE.goldYellow)(`Memperbarui Agentyx dari v${currentVersion} ke v${latestVersion || 'latest'}...`);

  // Detect whether running in a git clone repository or global npm package
  const rootDir = path.resolve(__dirname, '../../');
  const isGitRepo = fs.existsSync(path.join(rootDir, '.git'));

  try {
    if (isGitRepo) {
      spinner.text = chalk.bold.hex(PALETTE.goldYellow)(`Terdeteksi repo git lokal. Menjalankan git pull & npm run build...`);
      await execAsync('git pull origin main && npm run build', { cwd: rootDir });
    } else {
      spinner.text = chalk.bold.hex(PALETTE.goldYellow)(`Menjalankan npm install -g agentyx@latest...`);
      await execAsync('npm install -g agentyx@latest');
    }

    spinner.succeed(chalk.bold.hex(PALETTE.lemonLight)(`Pembaruan berhasil diselesaikan!`));

    const updatedVersion = latestVersion || 'latest';
    manifestManager.logFootprint('SYSTEM_UPDATE', `Updated Agentyx from v${currentVersion} to v${updatedVersion}`);

    let report = chalk.bold.hex(PALETTE.forestDark)('\n┌────────────────────────────────────────────────────────────────────────┐\n');
    report += chalk.bold.hex(PALETTE.forestDark)('│ ') + chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(' ✨ AGENTYX BERHASIL DIPERBARUI KE VERSI TERBARU ✨ ') + chalk.bold.hex(PALETTE.forestDark)('                 │\n');
    report += chalk.bold.hex(PALETTE.forestDark)('└────────────────────────────────────────────────────────────────────────┘\n\n');
    report += `  ${chalk.bold.hex(PALETTE.goldYellow)('Versi Lama')}     : ${chalk.hex(PALETTE.warmAmber)('v' + currentVersion)}\n`;
    report += `  ${chalk.bold.hex(PALETTE.goldYellow)('Versi Terbaru')}  : ${chalk.bold.hex(PALETTE.lemonLight)('v' + updatedVersion)}\n`;
    report += `  ${chalk.bold.hex(PALETTE.goldYellow)('Metode Update')}  : ${chalk.hex(PALETTE.creamSand)(isGitRepo ? 'Git Pull & Recompile (Local Build)' : 'Global NPM In-Place Upgrade')}\n\n`;
    report += chalk.bold.hex(PALETTE.warmAmber)('💡 Catatan: ') + chalk.hex(PALETTE.creamSand)('Silakan restart CLI Agentyx Anda untuk memuat seluruh modul baru.\n');

    return report;
  } catch (err: unknown) {
    spinner.fail(chalk.red(`Gagal memperbarui Agentyx otomatis.`));
    const msg = err instanceof Error ? err.message : String(err);
    return chalk.red(`\n❌ Error saat update: ${msg}\n`) +
      chalk.hex(PALETTE.warmAmber)(`💡 Solusi alternatif: Jalankan perintah berikut di terminal Anda:\n  npm install -g agentyx@latest\n`);
  }
}
