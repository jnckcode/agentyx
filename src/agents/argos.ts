/**
 * @file argos.ts
 * @description Specialized .argos Agent Module for Web Security Auditing, Deep Bug Research, Engine Runtime Self-Healing & Hot-Patching, and Prometheus Handoff
 * @purpose Implements argos-promt.md operational rules, vulnerability analysis, Agentyx engine runtime hot-patching without waiting for developer releases, and structured handoff to .prometheus.
 * @functions ArgosAgent - Class with generateArgosSystemPrompt, formatSecurityAuditReport, formatBugResearchReport, formatEngineSelfHealingReport, handoffToPrometheus, diagnoseAnomaly, isEngineRuntimeError, recordAuditInSecondBrain methods.
 */

import path from 'node:path';
import { entityStore } from '../database/entity-store.js';
import { experienceStore, CreateExperienceInput } from '../database/experience-store.js';
import { manifestManager } from '../docs/manifest-manager.js';
import { thinkingIsolator } from '../sanitizer/thinking-isolator.js';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface SecurityAuditPayload {
  reportId?: string;
  targetScope: string;
  severity: SeverityLevel;
  symptom: string;
  filePath: string;
  lineRange?: string;
  codeSnippet: string;
  rootCause: string;
  impact: string;
  remediationSteps: string[];
}

export interface BugResearchPayload {
  reportId?: string;
  targetScope: string;
  severity: SeverityLevel;
  anomalyDescription: string;
  filePath: string;
  lineRange?: string;
  errorLogOrSnippet: string;
  rootCause: string;
  impact: string;
  remediationSteps: string[];
}

export interface EngineSelfHealingPayload {
  patchId?: string;
  targetEngineFile: string;
  anomalyType: 'PARSER_ERROR' | 'RUNTIME_CRASH' | 'SHELL_GLITCH' | 'DB_ANOMALY' | 'TYPE_ERROR';
  anomalyDescription: string;
  appliedFixDescription: string;
  buildSuccess: boolean;
}

export interface AnomalyDiagnosisResult {
  isAnomaly: boolean;
  isEngineRuntime: boolean;
  anomalyType: string;
  rootCause: string;
  selfHealingRecommendation: string;
  suggestedAction: string;
}

export interface PrometheusHandoffPayload {
  reportId?: string;
  title: string;
  category: 'SECURITY' | 'BUG' | 'ANOMALY';
  targetScope: string;
  severity: SeverityLevel;
  rootCause: string;
  impact: string;
  remediationPlan: string[];
  verificationCriteria: string;
}

export class ArgosAgent {
  /**
   * Generates full system prompt for .argos as specified in argos-promt.md
   */
  public generateArgosSystemPrompt(): string {
    return `SUB-PROMPT ROLE: .argos (The All-Seeing Bug Sentinel, Web Security Auditor & Autonomous Diagnostician)

Anda adalah .argos (Argos Panoptes — sang penjaga bermata seratus yang serba melihat), agen spesialis audit keamanan web (web security), riset bug mendalam, diagnosis anomali sistem, dan pemulihan mandiri tingkat lanjut (Autonomous Self-Healing & Engine Hot-Patching) dalam ekosistem Agentyx.

Tugas utama Anda adalah mengawasi integritas sistem, mendeteksi kerentanan keamanan, membongkar akar masalah bug tersembunyi, serta SECARA PROAKTIF MEMPERBAIKI KERUSAKAN/ANOMALI PADA KODE RUNTIME AGENTYX ITU SENDIRI MAUPUN PROYEK TARGET TANPA PERLU MENUNGGU INTERVENSI ATAU RILIS PERBAIKAN DARI DEVELOPER EKSTERNAL.

1. TANGGUNG JAWAB UTAMA (.argos):
* Autonomous Engine Self-Healing & Runtime Hot-Patching (Perbaikan Mandiri Kode Agentyx):
  - Mampu mendeteksi dan mengisolasi kegagalan pada Engine Runtime Agentyx (seperti parsing JSON rusak, bug sanitizer stream, error eksekusi shell/terminal, issue TUI/readline, penanganan database SQLite, atau kegagalan API router).
  - Jika terjadi anomali pada runtime Agentyx, .argos TIDAK PERLU menunggu pengembang Agentyx merilis perbaikan. .argos berwenang langsung menganalisis file sumber Agentyx terkait di src/, merumuskan perbaikan kode, menerapkan perubahan (hot-patching via write_file), dan mengeksekusi kompilasi ulang (npm run build) secara otonom!
  - Menjamin kelangsungan operasi runtime (Zero-Downtime Autonomous Mitigation).
* Defensive Web Security & Vulnerability Auditing:
  - Memindai dan mengaudit kerentanan web standar industri (OWASP Top 10: SQL/Command Injection, XSS, CSRF, SSRF, Broken Authentication/Authorization, Insecure Deserialization, CORS misconfiguration, Security Headers).
  - Memeriksa potensi kebocoran rahasia (secret / credential leaks seperti API Key, Token, Private Key yang terekspos di repo/konfigurasi).
  - Mengaudit dependensi bermasalah atau modul usang yang memiliki catatan CVE/vulnerability.
* Deep Bug Research & Root Cause Isolation:
  - Melakukan investigasi mendalam terhadap bug kompleks, logika cacat (flawed business logic), race condition, memory leak, dan anomali runtime di seluruh berkas proyek target maupun engine.
  - Mengisolasi baris kode spesifik penyebab kegagalan dan mereproduksi kondisi pemicu bug (minimal reproduction scenario).
* Dynamic Capability Expansion & Evolutionary Learning:
  - Mengolah dan menyintesis informasi dari log error, telemetry, output tool eksekusi (terminal, read_file, grep_search), dokumen CVE, dan hasil penelusuran MCP/websearch.
  - Berkolaborasi dengan Experience Bank milik .hermes di SQLite Second Brain (~/.agentyx/memory.db) untuk mencatat pola perbaikan baru agar Agentyx terus bertambah cerdas dan tidak mengulang kesalahan yang sama.
* Structured Prometheus Handoff Protocol:
  - Untuk perbaikan fitur berskala arsitektural pada proyek target, mengompilasi seluruh temuan bug dan analisis keamanan ke dalam Audit & Remediation Report terstruktur dan menyerahkannya ke .prometheus agar disusun menjadi rencana atomik di workflow.md.

2. ATURAN KERJA SOLID & BATASAN KONTROL (.argos):
1. Dual-Scope Self-Healing Rule:
   - Scope 1 (Agentyx Engine Hot-Patching): Jika ditemukan kerusakan/anomali pada kode runtime Agentyx (src/), .argos DIBERIKAN WEWENANG KHUSUS untuk langsung mengedit berkas sumber terkait via write_file, memicu npm run build via terminal, dan memulihkan kestabilan CLI seketika.
   - Scope 2 (Target Project Feature Development): Untuk penulisan fitur baru skala besar pada proyek pengguna, .argos menyusun laporan perbaikan komprehensif dan menyerahkannya ke .prometheus -> .sisyphus -> Full-Team Coding.
2. Evidence-Based Verification (Zero Assumptions): DILARANG MENEBAK lokasi bug atau berspekulasi tentang celah keamanan. Seluruh temuan WAJIB dibuktikan secara faktual dengan membaca berkas aktual (read_file), pencarian pola (grep_search), atau pengujian aman via terminal.
3. Autonomous Patch Recompilation & Verification: Setiap kali melakukan hot-patching pada source code Agentyx, .argos WAJIB memverifikasi hasil kompilasi (npm run build / npm run lint) dengan 0 error sebelum mengonfirmasi status pemulihan sistem.
4. Defensive & Ethical Security Scope: Seluruh aktivitas keamanan ditujukan untuk pertahanan (defensive security), patching, penguatan (hardening), dan mitigasi risiko.
5. Mandatory Documentation & Memory Sync: Setiap audit, perbaikan mandiri runtime, atau riset bug WAJIB dicatat ringkasannya ke footprint.md dan disimpan sebagai rekam jejak evolusioner di SQLite Second Brain (experience_bank).`;
  }

  /**
   * Identifies whether an error trace or log originates from Agentyx's internal engine runtime
   */
  public isEngineRuntimeError(errorOrTrace: string): boolean {
    const text = (errorOrTrace || '').toLowerCase();
    return (
      text.includes('agentyx') ||
      text.includes('tool-executor') ||
      text.includes('json-sanitizer') ||
      text.includes('thinking-isolator') ||
      text.includes('ninerouter-client') ||
      text.includes('sqlite-driver') ||
      text.includes('session-store') ||
      text.includes('slash-handler') ||
      text.includes('tui-theme')
    );
  }

  /**
   * Formats an engine hot-patch report after self-healing Agentyx runtime
   */
  public formatEngineSelfHealingReport(payload: EngineSelfHealingPayload): string {
    const patchId = payload.patchId || `PATCH-${Date.now()}-${payload.anomalyType}`;

    let out = `### ⚡ [ARGOS ENGINE SELF-HEALING & HOT-PATCH REPORT]\n`;
    out += `* **Patch ID**: \`${patchId}\`\n`;
    out += `* **Target Engine File**: \`${payload.targetEngineFile}\`\n`;
    out += `* **Anomaly Type**: **${payload.anomalyType}**\n\n`;

    out += `#### 1. Deskripsi Anomali Runtime (Runtime Discovery)\n`;
    out += `${payload.anomalyDescription}\n\n`;

    out += `#### 2. Perbaikan Kode yang Diterapkan (Applied Hot-Patch)\n`;
    out += `${payload.appliedFixDescription}\n\n`;

    out += `#### 3. Hasil Verifikasi Kompilasi (Build Status)\n`;
    out += `- **Status**: ${payload.buildSuccess ? '✅ Kompilasi Sukses (0 Errors)' : '❌ Kompilasi Memerlukan Penyesuaian'}\n`;
    out += `- **Mitigasi Otonom**: Runtime Agentyx dipulihkan secara instan tanpa menunggu update dari developer.\n`;

    return out;
  }

  /**
   * Formats a security audit payload into standard .argos audit report
   */
  public formatSecurityAuditReport(payload: SecurityAuditPayload): string {
    const reportId = payload.reportId || `ARGOS-${Date.now()}-SECURITY`;
    const cleanSnippet = thinkingIsolator.isolateThinking(payload.codeSnippet).cleanContent;

    let out = `### 🛡️ [ARGOS SECURITY AUDIT REPORT]\n`;
    out += `* **Report ID**: \`${reportId}\`\n`;
    out += `* **Target Scope**: ${payload.targetScope}\n`;
    out += `* **Severity Level**: **${payload.severity}**\n\n`;

    out += `#### 1. Identifikasi Kerentanan (Vulnerability Discovery)\n`;
    out += `${payload.symptom}\n\n`;

    out += `#### 2. Lokasi Kode & Bukti Kerentanan (Evidence)\n`;
    out += `- **Berkas**: \`${payload.filePath}\`${payload.lineRange ? ` (Line ${payload.lineRange})` : ''}\n`;
    out += `\`\`\`\n${cleanSnippet}\n\`\`\`\n\n`;

    out += `#### 3. Analisis Akar Masalah & Dampak (Root Cause & Risk)\n`;
    out += `- **Root Cause**: ${payload.rootCause}\n`;
    out += `- **Impact / Risk**: ${payload.impact}\n\n`;

    out += `#### 4. Rekomendasi Remediasi untuk .prometheus\n`;
    payload.remediationSteps.forEach((step, idx) => {
      out += `${idx + 1}. ${step}\n`;
    });

    return out;
  }

  /**
   * Formats a bug research payload into standard .argos bug research report
   */
  public formatBugResearchReport(payload: BugResearchPayload): string {
    const reportId = payload.reportId || `ARGOS-${Date.now()}-BUG`;
    const cleanSnippet = thinkingIsolator.isolateThinking(payload.errorLogOrSnippet).cleanContent;

    let out = `### 🔍 [ARGOS BUG RESEARCH & ANOMALY REPORT]\n`;
    out += `* **Report ID**: \`${reportId}\`\n`;
    out += `* **Target Scope**: ${payload.targetScope}\n`;
    out += `* **Severity Level**: **${payload.severity}**\n\n`;

    out += `#### 1. Gejala & Anomali (Symptom & Anomaly)\n`;
    out += `${payload.anomalyDescription}\n\n`;

    out += `#### 2. Lokasi Kode & Bukti Log (Evidence)\n`;
    out += `- **Berkas**: \`${payload.filePath}\`${payload.lineRange ? ` (Line ${payload.lineRange})` : ''}\n`;
    out += `\`\`\`\n${cleanSnippet}\n\`\`\`\n\n`;

    out += `#### 3. Analisis Akar Masalah & Dampak (Root Cause & Impact)\n`;
    out += `- **Root Cause**: ${payload.rootCause}\n`;
    out += `- **Impact**: ${payload.impact}\n\n`;

    out += `#### 4. Strategi Perbaikan untuk .prometheus\n`;
    payload.remediationSteps.forEach((step, idx) => {
      out += `${idx + 1}. ${step}\n`;
    });

    return out;
  }

  /**
   * Formats structured handoff package directly to .prometheus
   */
  public handoffToPrometheus(payload: PrometheusHandoffPayload): string {
    const reportId = payload.reportId || `ARGOS-${Date.now()}-${payload.category}`;

    let out = `### 🤝 [ARGOS TO PROMETHEUS HANDOFF PACKAGE]\n`;
    out += `* **Package ID**: \`${reportId}\`\n`;
    out += `* **Subject**: **${payload.title}**\n`;
    out += `* **Category**: ${payload.category} | **Severity**: **${payload.severity}**\n`;
    out += `* **Target Scope**: \`${payload.targetScope}\`\n\n`;

    out += `#### 📋 Ringkasan Temuan Teknis:\n`;
    out += `- **Root Cause**: ${payload.rootCause}\n`;
    out += `- **Impact**: ${payload.impact}\n\n`;

    out += `#### 🎯 Rencana Strategis yang Diusulkan untuk workflow.md:\n`;
    payload.remediationPlan.forEach((task, idx) => {
      out += `- [ ] Task ${idx + 1}: ${task}\n`;
    });

    out += `\n#### 🛡️ Kriteria Verifikasi (.heptaseus):\n`;
    out += `${payload.verificationCriteria}\n`;

    return out;
  }

  /**
   * Performs quick diagnostic assessment on runtime anomaly or tool failure
   */
  public diagnoseAnomaly(anomalyDescription: string, stackTrace?: string): AnomalyDiagnosisResult {
    const isAnomaly = Boolean(anomalyDescription || stackTrace);
    const trace = stackTrace || '';
    const isEngineRuntime = this.isEngineRuntimeError(anomalyDescription + ' ' + trace);

    let anomalyType = isEngineRuntime ? 'ENGINE_RUNTIME_ANOMALY' : 'WORKSPACE_RUNTIME_ANOMALY';
    let rootCause = 'Unknown execution disruption.';
    let selfHealingRecommendation = 'Inspect recent workspace changes and verify tool input parameters.';
    let suggestedAction = 'Run static analysis via grep_search or read_file.';

    if (trace.includes('SyntaxError') || trace.includes('unexpected token')) {
      anomalyType = 'SYNTAX_OR_PARSING_ANOMALY';
      rootCause = 'Malformed syntax or unescaped string in code or JSON output.';
      selfHealingRecommendation = isEngineRuntime
        ? 'Hot-patch the relevant parser in src/sanitizer/ and run npm run build.'
        : 'Run JSON repair / parser sanitizer and check syntax via compiler.';
      suggestedAction = 'Re-parse payload through jsonSanitizer and verify AST.';
    } else if (trace.includes('ENOENT') || trace.includes('file not found')) {
      anomalyType = 'FILESYSTEM_PATH_ANOMALY';
      rootCause = 'Target file or directory path does not exist in workspace or engine.';
      selfHealingRecommendation = 'Expand relative path or verify directory structure with list_dir.';
      suggestedAction = 'Check path with fs.existsSync() and expand ~ to home directory.';
    } else if (trace.includes('ECONNREFUSED') || trace.includes('fetch failed')) {
      anomalyType = 'NETWORK_OR_API_ANOMALY';
      rootCause = '9router or upstream API endpoint is unreachable.';
      selfHealingRecommendation = 'Verify 9router server status via /config command.';
      suggestedAction = 'Check NINEROUTER_BASE_URL and port connectivity.';
    }

    return {
      isAnomaly,
      isEngineRuntime,
      anomalyType,
      rootCause,
      selfHealingRecommendation,
      suggestedAction
    };
  }

  /**
   * Persists audit & bug research findings into SQLite Second Brain and logs footprint
   */
  public recordAuditInSecondBrain(
    title: string,
    category: 'SECURITY_AUDIT' | 'BUG_RESEARCH' | 'ANOMALY_DIAGNOSIS' | 'ENGINE_SELF_HEALING',
    findings: string[],
    projectPath?: string
  ): void {
    entityStore.saveEntity(`Argos [${category}]: ${title}`, `ARGOS_${category}`, findings, projectPath);
    manifestManager.logFootprint(`ARGOS_${category}`, `Completed ${category.toLowerCase().replace('_', ' ')}: ${title}`);
    manifestManager.setAgentState('.argos', `Analyzed and reported: ${title}`);
  }

  /**
   * Logs resolved security or bug findings to Experience Bank for self-evolution
   */
  public logSecurityExperienceToBank(input: CreateExperienceInput): void {
    experienceStore.logExperience(input);
    manifestManager.logFootprint('ARGOS_EXPERIENCE', `Saved security/bug pattern [${input.category}] to Experience Bank`);
    manifestManager.setAgentState('.argos', `Recorded evolutionary pattern in Experience Bank`);
  }
}

export const argosAgent = new ArgosAgent();
