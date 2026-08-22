/**
 * @file workspace-discovery.ts
 * @description Dynamic Polyglot Workspace Inspection & Stack Discovery Engine
 * @purpose Implements reasoning-promt.md Section 2 Dynamic Discovery rules to detect workspace language stacks and toolchains without assumptions.
 * @functions WorkspaceDiscoveryEngine - Class with inspectWorkspace, getDetectedStacks, formatDiscoverySummary methods.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DiscoveredStack {
  language: string;
  configFile: string;
  toolchain: string;
}

export class WorkspaceDiscoveryEngine {
  /**
   * Inspects target workspace directory for project manifests across all programming ecosystems
   */
  public inspectWorkspace(targetDir: string = process.cwd()): DiscoveredStack[] {
    const stacks: DiscoveredStack[] = [];
    if (!fs.existsSync(targetDir)) return stacks;

    const indicators: Array<{ file: string; lang: string; toolchain: string }> = [
      { file: 'Cargo.toml', lang: 'Rust', toolchain: 'cargo / rustc' },
      { file: 'pyproject.toml', lang: 'Python', toolchain: 'pytest / uv / poetry' },
      { file: 'requirements.txt', lang: 'Python', toolchain: 'pip / pytest' },
      { file: 'go.mod', lang: 'Go', toolchain: 'go test / go build' },
      { file: 'pom.xml', lang: 'Java', toolchain: 'mvn / java' },
      { file: 'build.gradle', lang: 'Java / Kotlin', toolchain: 'gradle' },
      { file: 'build.gradle.kts', lang: 'Kotlin', toolchain: 'gradle' },
      { file: 'CMakeLists.txt', lang: 'C / C++', toolchain: 'cmake / make / gcc' },
      { file: 'composer.json', lang: 'PHP', toolchain: 'composer / phpunit' },
      { file: 'package.json', lang: 'TypeScript / JavaScript', toolchain: 'npm / bun / pnpm' },
      { file: 'Dockerfile', lang: 'Docker / DevOps', toolchain: 'docker / docker-compose' },
      { file: 'Makefile', lang: 'Build Automation', toolchain: 'make' }
    ];

    for (const ind of indicators) {
      if (fs.existsSync(path.join(targetDir, ind.file))) {
        stacks.push({
          language: ind.lang,
          configFile: ind.file,
          toolchain: ind.toolchain
        });
      }
    }

    if (stacks.length === 0) {
      stacks.push({
        language: 'Universal / Polyglot Scripting',
        configFile: 'N/A',
        toolchain: 'System shell'
      });
    }

    return stacks;
  }

  /**
   * Formats workspace discovery report for AI context prompt injection
   */
  public formatDiscoverySummary(targetDir: string = process.cwd()): string {
    const stacks = this.inspectWorkspace(targetDir);
    let summary = `Detected Workspace Stacks & Toolchains:\n`;
    stacks.forEach(s => {
      summary += `- [${s.language}] Manifest: ${s.configFile} | Toolchain: ${s.toolchain}\n`;
    });
    return summary;
  }
}

export const workspaceDiscoveryEngine = new WorkspaceDiscoveryEngine();
