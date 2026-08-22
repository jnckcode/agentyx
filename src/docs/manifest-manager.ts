/**
 * @file manifest-manager.ts
 * @description Real-time Manifest Documentation Manager for the 4 Mandatory Manifest Files
 * @purpose Initializes and synchronizes workflow.md, footprint.md, agent.md, and prompt.md across active workspace.
 * @functions ManifestManager - Class with initBundle, updateWorkflow, logFootprint, setAgentState, getManifests methods
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ManifestFiles {
  workflow: string;
  footprint: string;
  agent: string;
  prompt: string;
}

export class ManifestManager {
  private targetDir: string;

  constructor(targetDir: string = process.cwd()) {
    this.targetDir = targetDir;
  }

  public getPaths(): Record<keyof ManifestFiles, string> {
    return {
      workflow: path.join(this.targetDir, 'workflow.md'),
      footprint: path.join(this.targetDir, 'footprint.md'),
      agent: path.join(this.targetDir, 'agent.md'),
      prompt: path.join(this.targetDir, 'prompt.md')
    };
  }

  /**
   * Initializes mandatory 4 manifest files if they do not already exist
   */
  public initBundle(): { created: string[]; existing: string[] } {
    const paths = this.getPaths();
    const created: string[] = [];
    const existing: string[] = [];

    const templates: ManifestFiles = {
      workflow: `# Agentyx Project Workflow & Roadmap\n\n- [ ] Task 1: Initialize workspace documentation\n- [ ] Task 2: Implement features`,
      footprint: `# Agentyx Footprint & Historical Log\n\n## ${new Date().toISOString().slice(0, 10)}\n- [INITIALIZED] Project Manifests`,
      agent: `# Agentyx Agent Allocation & Swarm State\n\n- **Active Agent**: Full-Team Coding\n- **Status**: Ready`,
      prompt: `# Master Prompt Instructions\n\nFollow Zero-Assumptions Policy and Real-time Documentation Protocol.`
    };

    for (const [key, filePath] of Object.entries(paths) as [keyof ManifestFiles, string][]) {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, templates[key], 'utf-8');
        created.push(path.basename(filePath));
      } else {
        existing.push(path.basename(filePath));
      }
    }

    return { created, existing };
  }

  /**
   * Logs entry into footprint.md in real-time
   */
  public logFootprint(actionType: string, description: string): void {
    const footprintPath = this.getPaths().footprint;
    const timestamp = new Date().toISOString();
    const logEntry = `\n- \`[${actionType}]\` ${description} (${timestamp})`;

    if (fs.existsSync(footprintPath)) {
      fs.appendFileSync(footprintPath, logEntry, 'utf-8');
    } else {
      fs.writeFileSync(footprintPath, `# Agentyx Footprint & Historical Log\n${logEntry}`, 'utf-8');
    }
  }

  /**
   * Updates agent state in agent.md
   */
  public setAgentState(activeRole: string, currentTask: string): void {
    const agentPath = this.getPaths().agent;
    const content = `# Agentyx Agent Allocation & Swarm State\n\n/**\n * @file agent.md\n * @description Synchronized swarm state\n */\n\n- **Active Agent**: ${activeRole}\n- **Current Task**: ${currentTask}\n- **Last Updated**: ${new Date().toISOString()}\n`;
    fs.writeFileSync(agentPath, content, 'utf-8');
  }

  /**
   * Reads all 4 manifest files to cross-check context
   */
  public readAllManifests(): ManifestFiles {
    const paths = this.getPaths();
    const readSafe = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '');
    return {
      workflow: readSafe(paths.workflow),
      footprint: readSafe(paths.footprint),
      agent: readSafe(paths.agent),
      prompt: readSafe(paths.prompt)
    };
  }
}

export const manifestManager = new ManifestManager();
