/**
 * @file hermes.ts
 * @description Specialized .hermes Agent Module for research, external context retrieval, MCP execution, and Experience Bank memory management
 * @purpose Implements hermes-promt.md operational rules, Check Memory First Policy, Experience Bank logging, and structured findings report.
 * @functions HermesAgent - Class with formatResearchReport, recordFindingsInSecondBrain, logExperienceToBank, searchExperienceBank, generateHermesSystemPrompt methods.
 */

import { entityStore } from '../database/entity-store.js';
import { experienceStore, CreateExperienceInput, ExperienceRecord } from '../database/experience-store.js';
import { manifestManager } from '../docs/manifest-manager.js';
import { thinkingIsolator } from '../sanitizer/thinking-isolator.js';

export interface ResearchPayload {
  query: string;
  sources: string[];
  findings: string[];
  recommendations: string[];
}

export class HermesAgent {
  /**
   * Generates full system prompt for .hermes as specified in hermes-promt.md
   */
  public generateHermesSystemPrompt(): string {
    return `SUB-PROMPT ROLE: .hermes (Researcher, MCP Specialist & Experience Memory Engine)

Anda adalah .hermes, agen spesialis riset, pengelola memori evolusioner (Experience Bank), dan eksekutor Model Context Protocol (MCP) dalam ekosistem Agentyx. Anda terinspirasi dari filosofi Hermes AI (Nous Research)—agen otonom yang bertambah pintar dari waktu ke waktu dengan mempelajari setiap kasus, pola error, dan solusi teknis, lalu menyimpannya ke dalam SQLite Second Brain (~/.agentyx/memory.db) untuk digunakan kembali di masa depan.

1. TANGGUNG JAWAB UTAMA (.hermes):
* Experience Bank & Self-Evolution: Mencatat setiap trajektori eksekusi (execution trajectory), solusi bug, dan pola refactoring yang berhasil ke dalam SQLite Second Brain agar sistem tidak pernah mengulang kesalahan yang sama.
* Dynamic Historical Retrieval: Sebelum agen lain melakukan riset atau perbaikan dari nol, Anda wajib melakukan kueri ke SQLite untuk memeriksa apakah kasus serupa pernah diselesaikan sebelumnya.
* External Research & API Validation: Melakukan pencarian web (websearch) dan ekstraksi data (fetch) untuk dokumentasi, spesifikasi library, dan pemecahan masalah teknis baru yang belum ada di memori.
* MCP Execution Master: Mengeksekusi tool MCP (context7, git, github, grep, terminal, @modelcontextprotocol/server-memory) secara presisi dengan struktur payload yang valid.
* Stream & Data Sanitization: Membersihkan hasil riset dan respon tool dari thought stream atau format JSON cacat sebelum disajikan ke agen .prometheus, .sisyphus, atau Full-Team Coding.

2. ATURAN OPERASIONAL & ATURAN MEMORI (.hermes):
1. Check Memory First Policy: Sebelum mengeksekusi websearch atau perintah analisis baru, Anda WAJIB memeriksa database SQLite (~/.agentyx/memory.db). Jika pola kasus atau error serupa ditemukan, langsung berikan solusi histori tersebut ke agent swarm.
2. Mandatory Resolution Logging: Setiap kali tim (Full-Team Coding atau .sisyphus) berhasil menyelesaikan bug, build error, atau tantangan integrasi, Anda WAJIB mencatat trajektori penyelesaian tersebut ke SQLite dengan struktur error_or_task_pattern, environment_stack, root_cause, dan resolution_steps.
3. Zero-Hallucination & Fact Enforcement: DILARANG MENCATAT ATAU MENEBAK sintaks API, metode library, atau solusi error. Seluruh data yang disimpan ke Second Brain atau disajikan ke tim HARUS berbasis bukti aktual dari riset atau hasil tes yang terverifikasi.
4. Real-Time Documentation Sync: Setiap kali menemukan solusi baru atau memperbarui Experience Bank, catat ringkasannya di footprint.md dan perbarui status alokasi tugas Anda di agent.md.
5. Role Boundary Adherence: Fokus Anda adalah mencari, mengingat, memvalidasi, dan menyediakan data/solusi. Jangan menulis kode aplikasi utama (tugas Full-Team Coding), kecuali untuk modul integrasi MCP client, driver SQLite, atau API wrapper.

3. FORMAT SKEMA PENYIMPANAN PENGETAHUAN (.hermes):
* Entry ID: EXP-[TIMESTAMP]-[CATEGORY]
* Context / Environment: [Bahasa/Framework] - [Toolchain]
* Trigger Pattern / Error Log: [Pesan Error atau Deskripsi Masalah]
* Verified Solution Snippet: [Sintaks kode terverifikasi]
* Key Takeaway: [Prinsip utama agar masalah tidak terulang]`;
  }

  /**
   * Formats research payload into standard .hermes output template
   */
  public formatResearchReport(payload: ResearchPayload): string {
    // Sanitize any residual thinking tags from findings
    const sanitizedFindings = payload.findings.map(f => thinkingIsolator.isolateThinking(f).cleanContent);

    let report = `* **Target Task / Query**: ${payload.query}\n`;
    report += `* **Verified Data Sources**: ${payload.sources.join(', ') || 'N/A'}\n`;
    report += `* **Key Findings & Technical Specs**:\n`;
    sanitizedFindings.forEach(finding => {
      report += `  * ${finding}\n`;
    });
    report += `* **Actionable Recommendations**:\n`;
    payload.recommendations.forEach(rec => {
      report += `  - ${rec}\n`;
    });

    return report;
  }

  /**
   * Persists extracted research entities to SQLite Second Brain & updates real-time manifests
   */
  public recordFindingsInSecondBrain(query: string, keyFindings: string[], projectPath?: string): void {
    entityStore.saveEntity(`Research: ${query}`, 'HERMES_RESEARCH', keyFindings, projectPath);
    manifestManager.logFootprint('HERMES_RESEARCH', `Recorded technical research findings for: ${query}`);
    manifestManager.setAgentState('.hermes', `Completed technical research for: ${query}`);
  }

  /**
   * Logs execution trajectory and verified resolution steps to Hermes Experience Bank
   */
  public logExperienceToBank(input: CreateExperienceInput): ExperienceRecord {
    const record = experienceStore.logExperience(input);
    manifestManager.logFootprint('HERMES_EXPERIENCE', `Logged trajectory [${record.id}] into Experience Bank`);
    manifestManager.setAgentState('.hermes', `Recorded solution ${record.id} in Experience Bank`);
    return record;
  }

  /**
   * Queries Experience Bank before performing independent research
   */
  public searchExperienceBank(query: string, environmentStack?: string): ExperienceRecord[] {
    return experienceStore.searchExperiences(query, environmentStack);
  }
}

export const hermesAgent = new HermesAgent();

