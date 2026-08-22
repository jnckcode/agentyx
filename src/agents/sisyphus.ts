/**
 * @file sisyphus.ts
 * @description Specialized .sisyphus Agent Module for relentless task orchestration and execution management
 * @purpose Implements sisyphus-promt.md operational rules, delegation-first policy, autonomous error recovery loops (3 retries), footprint logging, and parsing barrier enforcement.
 * @functions SisyphusAgent - Class with generateSisyphusSystemPrompt, recordExecutionStep, executeWithRetryLoop, logFootprintEntry methods.
 */

import { manifestManager } from '../docs/manifest-manager.js';
import { entityStore } from '../database/entity-store.js';
import { thinkingIsolator } from '../sanitizer/thinking-isolator.js';
import { jsonSanitizer } from '../sanitizer/json-sanitizer.js';

export interface ExecutionTask {
  id: string;
  description: string;
  assignedAgent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  retryCount: number;
}

export class SisyphusAgent {
  /**
   * Generates full system prompt for .sisyphus as specified in sisyphus-promt.md
   */
  public generateSisyphusSystemPrompt(): string {
    return `Anda adalah .sisyphus, penggerak eksekusi tanpa henti dan koordinator utama agent swarm dalam ekosistem Agentyx.

TANGGUNG JAWAB UTAMA:
- Swarm Orchestration: Membagi dan mendelegasikan tugas teknis kepada sub-agen Full-Team Coding secara terstruktur.
- State & Memory Management: Memantau status sesi, mencatat jejak pekerjaan ke SQLite Second Brain (~/.agentyx/memory.db), dan mengelola perpindahan sesi.
- Autonomous Error Recovery: Mengoperasikan retry loop hingga 3 kali jika menemukan error sebelum meminta bantuan .hermes/.prometheus.
- Execution Footprint Logging: Mengelola dan memperbarui footprint.md dan agent.md secara real-time.

ATURAN KERJA SOLID & BATASAN KONTROL:
1. Delegation-First Rule: DILARANG mengerjakan semua tugas sendirian. Penulisan kode modular HARUS didelegasikan ke Full-Team Coding.
2. Never Stop on Recoverable Error: Lakukan hingga 3 kali percobaan perbaikan mandiri saat error build/sintaks.
3. Strict State Persistence: Update workflow.md, footprint.md, dan agent.md di setiap penuntasan tugas.
4. Parsing Barrier Enforcement: Lewatkan seluruh output reasoning melalui Parser & Sanitizer (ThinkingIsolator & JsonSanitizer) sebelum disimpan/ditampilkan.`;
  }

  /**
   * Enforces parsing barrier on raw outputs
   */
  public enforceParsingBarrier(rawOutput: string): { cleanContent: string; thought: string } {
    const isolated = thinkingIsolator.isolateThinking(rawOutput);
    let finalContent = isolated.cleanContent;

    if (finalContent.trim().startsWith('{') || finalContent.trim().startsWith('[')) {
      const sanitized = jsonSanitizer.sanitizeAndParse(finalContent);
      if (sanitized.data) {
        finalContent = typeof sanitized.data === 'string' ? sanitized.data : JSON.stringify(sanitized.data, null, 2);
      }
    }

    return {
      cleanContent: finalContent,
      thought: isolated.thought
    };
  }

  /**
   * Executes autonomous retry loop (up to maxRetries) for task execution failures
   */
  public async executeWithRetryLoop<T>(
    taskDescription: string,
    action: (attempt: number) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        manifestManager.setAgentState('.sisyphus', `Executing task (Attempt ${attempt}/${maxRetries}): ${taskDescription}`);
        const result = await action(attempt);
        manifestManager.logFootprint('SISYPHUS_EXECUTION', `Task succeeded on attempt ${attempt}: ${taskDescription}`);
        manifestManager.setAgentState('.sisyphus', `Completed task: ${taskDescription}`);
        return result;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        manifestManager.logFootprint('SISYPHUS_RETRY', `Attempt ${attempt} failed for task '${taskDescription}': ${lastError.message}`);

        if (attempt === maxRetries) {
          manifestManager.logFootprint('SISYPHUS_ERROR_ESCALATION', `Max retries (${maxRetries}) reached for '${taskDescription}'. Requesting .hermes research or .prometheus plan revision.`);
          entityStore.saveEntity(`Escalated Error: ${taskDescription}`, 'ERROR_ESCALATION', [lastError.message]);
        }
      }
    }

    throw lastError || new Error(`Task '${taskDescription}' failed after ${maxRetries} attempts.`);
  }

  /**
   * Records execution step and updates real-time footprint logs
   */
  public recordExecutionStep(stepName: string, details: string): void {
    manifestManager.logFootprint('EXECUTION_STEP', `[${stepName}] ${details}`);
  }
}

export const sisyphusAgent = new SisyphusAgent();
