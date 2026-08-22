/**
 * @file heptaseus.ts
 * @description Specialized .heptaseus Agent Module for QA, security gatekeeping, header compliance, and AI slop cleansing
 * @purpose Implements heptaseus-promt.md rules, absolute veto power, polyglot comment header audit, vulnerability check, and automated audit logging.
 * @functions HeptaseusAgent - Class with generateHeptaseusSystemPrompt, auditFileHeader, vetoCode, runSlopClean methods.
 */

import fs from 'node:fs';
import { manifestManager } from '../docs/manifest-manager.js';
import { executeRemoveSlopCommand } from '../commands/remove-slop.js';
import { commentHeaderUtility } from '../utils/comment-header.js';

export interface AuditResult {
  passed: boolean;
  hasHeader: boolean;
  issues: string[];
}

export class HeptaseusAgent {
  /**
   * Generates full system prompt for .heptaseus as specified in heptaseus-promt.md
   */
  public generateHeptaseusSystemPrompt(): string {
    return `Anda adalah .heptaseus, penguji kualitas, penempa kode, dan benteng pertahanan terakhir dalam ekosistem Agentyx.

TANGGUNG JAWAB UTAMA:
- Code Verification & Testing: Menjalankan pengujian sintaksis, unit test, dan validasi fungsionalitas pada proyek Polyglot.
- Security & Vulnerability Audit: Memeriksa potensi kebocoran kredensial, injection vulnerability, dan isu keamanan.
- AI Slop Cleansing (/remove-slop): Mengidentifikasi dan menghapus komentar berlebih, kode mati, berkas temporary.
- Header Compliance Check: Memastikan setiap berkas memiliki Comment Header adaptif (C-Style, Hash-Style, SQL-Style, HTML-Style) di baris paling atas.

ATURAN KERJA SOLID & BATASAN KONTROL:
1. Absolute Veto Power: Memiliki HAK VETO MUTLAK untuk MENOLAK kode jika ditemukan error sintaks, test gagal, atau ketiadaan Comment Header.
2. Zero Dead Code Tolerance: DILARANG menyetujui berkas berisi variabel tak terpakai, fungsi placeholder kosong, atau komentar AI redundan.
3. No Code Compromise: Kode WAJIB teruji secara sintaksis dan bebas kebocoran memori.
4. Automated Audit Logging: Catat setiap penolakan kode, error yang ditemukan, dan perbaikan QA di footprint.md.`;
  }

  /**
   * Audits a source file for mandatory adaptive comment header compliance
   */
  public auditFileHeader(filePath: string): AuditResult {
    const issues: string[] = [];
    if (!fs.existsSync(filePath)) {
      return { passed: false, hasHeader: false, issues: [`File '${filePath}' does not exist.`] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const hasHeader = commentHeaderUtility.hasValidHeader(filePath, content);

    if (!hasHeader) {
      issues.push(`Missing mandatory Comment Header (@file, @description, @purpose) at top of file for syntax style ${commentHeaderUtility.detectCommentStyle(filePath)}.`);
    }

    if (content.includes('// TODO: REMOVE THIS') || content.includes('// Put your logic here') || content.includes('# TODO: REMOVE THIS')) {
      issues.push(`Contains AI slop comment markers.`);
    }

    const passed = hasHeader && issues.length === 0;
    return { passed, hasHeader, issues };
  }

  /**
   * Exercises Veto Power to reject flawed code and logs reason in footprint.md
   */
  public vetoCode(filePath: string, reasons: string[]): void {
    const reasonText = reasons.join('; ');
    manifestManager.logFootprint('HEPTASEUS_VETO', `Vetoed code in '${filePath}': ${reasonText}`);
    manifestManager.setAgentState('.heptaseus', `Vetoed '${filePath}' due to: ${reasonText}`);
  }

  /**
   * Runs AI Slop Cleanup
   */
  public runSlopClean(targetDir: string = process.cwd()): string {
    const result = executeRemoveSlopCommand(targetDir);
    manifestManager.logFootprint('HEPTASEUS_SLOP_CLEAN', `Executed AI Slop Cleansing in ${targetDir}`);
    return result;
  }
}

export const heptaseusAgent = new HeptaseusAgent();
