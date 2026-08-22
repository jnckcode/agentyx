/**
 * @file full-team.ts
 * @description Specialized Full-Team Coding Agent Module for Executive Polyglot Development
 * @purpose Implements full-team-promt.md rules, polyglot code implementation, dynamic toolchain integration, adaptive comment headers, and zero-slop execution.
 * @functions FullTeamAgent - Class with generateFullTeamSystemPrompt, applyAdaptiveHeader, prepareHandoffToQA methods.
 */

import { commentHeaderUtility, HeaderMetadata } from '../utils/comment-header.js';
import { workspaceDiscoveryEngine } from '../utils/workspace-discovery.js';
import { manifestManager } from '../docs/manifest-manager.js';
import { heptaseusAgent } from './heptaseus.js';

export class FullTeamAgent {
  /**
   * Generates full system prompt for Full-Team Coding as specified in full-team-promt.md
   */
  public generateFullTeamSystemPrompt(targetDir: string = process.cwd()): string {
    const discoverySummary = workspaceDiscoveryEngine.formatDiscoverySummary(targetDir);

    return `Anda adalah Full-Team Coding, tim agen eksekutor lintas disiplin (Systems, Backend, Frontend, Mobile, DevOps, Cloud, & DB) dalam ekosistem Agentyx.

TANGGUNG JAWAB UTAMA:
- Polyglot Code Implementation: Menulis kode produksi yang efisien, modular, dan idiomatik untuk bahasa target (Python, Rust, Go, C/C++, Java, Kotlin, TS/JS, PHP, Shell, SQL, Docker, dll).
- Dynamic Toolchain Integration: Menyesuaikan eksekusi dengan toolchain lokal proyek.
- Syntax-Adapted Comment Header: Menambahkan Comment Header terstruktur wajib di baris pertama berkas sesuai sintaks komentar bahasa target.
- Zero-Slop Execution: Menulis kode utuh tanpa fungsi placeholder kosong, komentar AI redundan, atau stub code tak terimplementasi.

ATURAN COMMENT HEADER ADAPTIF:
- C-Style (JS/TS, C/C++, Java, Rust, Go, C#, Dart, PHP): /** @file ... @description ... @purpose ... @functions ... */
- Hash-Style (Python, Shell, Ruby, YAML, Dockerfile, Makefile): # @file ... # @description ... # @purpose ... # @functions ...
- SQL / Scripting (-- atau <!-- -->): Sesuaikan dengan sintaks komentar teratas bahasa.

${discoverySummary}

BATASAN KONTROL & ALUR VERIFIKASI:
1. Strict Scope Focus: HANYA ubah atau buat berkas yang ditugaskan oleh .sisyphus.
2. Idiomatic Best Practices: DILARANG memaksakan pola desain JS ke bahasa lain (tulis Pythonic Python, Rust Ownership/Borrowing, Go idiomatik).
3. Handoff to QA Gatekeeper: Setelah menulis kode, serahkan ke .heptaseus untuk diaudit sebelum menandai DONE.`;
  }

  /**
   * Applies adaptive comment header to a code file content based on file extension
   */
  public applyAdaptiveHeader(filePath: string, rawCode: string, meta: HeaderMetadata): string {
    if (commentHeaderUtility.hasValidHeader(filePath, rawCode)) {
      return rawCode;
    }
    const header = commentHeaderUtility.generateHeader(meta, filePath);
    return header + rawCode;
  }

  /**
   * Hands off completed file to .heptaseus QA Gatekeeper for audit
   */
  public handoffToQA(filePath: string): { passed: boolean; issues: string[] } {
    const audit = heptaseusAgent.auditFileHeader(filePath);
    if (!audit.passed) {
      heptaseusAgent.vetoCode(filePath, audit.issues);
      return { passed: false, issues: audit.issues };
    }
    manifestManager.logFootprint('QA_PASS', `File '${filePath}' passed .heptaseus QA Audit.`);
    return { passed: true, issues: [] };
  }
}

export const fullTeamAgent = new FullTeamAgent();
