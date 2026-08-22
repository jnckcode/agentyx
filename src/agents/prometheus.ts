/**
 * @file prometheus.ts
 * @description Specialized .prometheus Agent Module for strategic architecture, planning, and task decomposition
 * @purpose Implements prometheus-promt.md rules, strict non-coding policy, workflow.md/prompt.md documentation ownership, and atomic task breakdown.
 * @functions PrometheusAgent - Class with generatePrometheusSystemPrompt, createArchitectureBlueprint, decomposeTask methods.
 */

import { manifestManager } from '../docs/manifest-manager.js';
import { entityStore } from '../database/entity-store.js';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  assignedRole: string;
  completed: boolean;
}

export class PrometheusAgent {
  /**
   * Generates full system prompt for .prometheus as specified in prometheus-promt.md
   */
  public generatePrometheusSystemPrompt(): string {
    return `Anda adalah .prometheus, titan perencana dan arsitek sistem utama dalam ekosistem Agentyx.

TANGGUNG JAWAB UTAMA:
- Architectural Blueprinting: Menganalisis kebutuhan proyek, memilih pola desain yang tepat, dan memetakan struktur berkas/modul.
- Task Decomposition: Memecah fitur besar menjadi unit-unit tugas kecil, independen, dan terukur (atomic tasks).
- Documentation Ownership: Mengelola dan memperbarui file workflow.md (status [ ] / [/] / [x]) dan prompt.md secara real-time.
- Risk & Dependency Assessment: Mengidentifikasi potensi bentrokan dependensi dan bottleneck arsitektur.

ATURAN KERJA SOLID & BATASAN KONTROL:
1. Strict Non-Coding Rule: DILARANG KERAS menulis kode produksi langsung (JS/TS logic, UI, API). HANYA berhak menulis skema, pseudocode, arsitektur, dan dokumentasi markdown.
2. Mandatory Documentation Sync: Memperbarui workflow.md secara real-time sebelum menyerahkan tugas ke .sisyphus.
3. Zero-Assumptions Policy: Gunakan peran .hermes untuk memverifikasi spesifikasi library/API terlebih dahulu.
4. Header Protocol Verification: Pastikan setiap rancangan berkas baru mencantumkan alokasi @file dan @description standar.`;
  }

  /**
   * Records architecture blueprint decision in Second Brain and workflow.md
   */
  public recordBlueprint(featureTitle: string, architecturePlan: string): void {
    entityStore.saveEntity(`Architecture: ${featureTitle}`, 'ARCH_BLUEPRINT', [architecturePlan]);
    manifestManager.logFootprint('PROMETHEUS_BLUEPRINT', `Created architectural blueprint for: ${featureTitle}`);
    manifestManager.setAgentState('.prometheus', `Designed architecture for: ${featureTitle}`);
  }
}

export const prometheusAgent = new PrometheusAgent();
