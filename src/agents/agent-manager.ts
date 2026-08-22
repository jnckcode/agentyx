/**
 * @file agent-manager.ts
 * @description Swarm Agent Manager defining roles, boundaries, system instructions, and dynamic role switching
 * @purpose Enforces Swarm Role Boundaries (.prometheus, .sisyphus, .heptaseus, .hermes, Full-Team Coding) and Corrective Reasoning Alignment per prompt definitions.
 * @functions AgentManager - Class with getAvailableAgents, setAgentRole, getActiveAgent, switchAgent methods
 */

import { configManager } from '../config/config-manager.js';
import { manifestManager } from '../docs/manifest-manager.js';
import { prometheusAgent } from './prometheus.js';
import { sisyphusAgent } from './sisyphus.js';
import { heptaseusAgent } from './heptaseus.js';
import { hermesAgent } from './hermes.js';
import { fullTeamAgent } from './full-team.js';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  boundary: string;
  systemInstruction: string;
}

const REASONING_ALIGNMENT_PROMPT = `
SYSTEM ALIGNMENT & CORRECTIVE REASONING RULES:
1. Scope Separation: Engine Scope (Agentyx Node.js CLI) vs Target Workspace Scope (Universal Polyglot Project). NEVER restrict execution capabilities as if target workspace is only Node.js/JS.
2. Dynamic Discovery Protocol: Inspect workspace config files (Cargo.toml, pyproject.toml, go.mod, pom.xml, CMakeLists.txt, composer.json, package.json, Dockerfile) before making cognitive decisions. Read 4 manifest files (workflow.md, footprint.md, agent.md, prompt.md).
3. Thought Isolation & Parsing: Never mix thought stream (<thought>...</thought>) with code output or tool calls. Pass responses through Parser & Sanitizer.
4. User Override Priority: User instructions and Polyglot principles ALWAYS override default model assumptions.
`;

export function buildSystemPromptWithReasoning(basePrompt: string): string {
  return `${basePrompt}\n\n${REASONING_ALIGNMENT_PROMPT}`;
}

export const AGENT_ROLES: AgentRole[] = [
  {
    id: '.prometheus',
    name: 'Prometheus (Architect)',
    description: 'Strategic Architect & Planner',
    boundary: 'Designs architecture, breaks down atomic tasks, updates workflow.md & prompt.md. STRICTLY NON-CODING.',
    systemInstruction: buildSystemPromptWithReasoning(prometheusAgent.generatePrometheusSystemPrompt())
  },
  {
    id: '.sisyphus',
    name: 'Sisyphus (Executor)',
    description: 'Relentless Orchestrator & Task Runner',
    boundary: 'Orchestrates swarm task delegation to Full-Team Coding, handles 3-retry error recovery, updates footprint.md & agent.md.',
    systemInstruction: buildSystemPromptWithReasoning(sisyphusAgent.generateSisyphusSystemPrompt())
  },
  {
    id: '.heptaseus',
    name: 'Heptaseus (QA & Auditor)',
    description: 'QA, Security Gatekeeper & Slop Remover',
    boundary: 'Audits syntax/headers, runs security & slop cleansing, exercises absolute Veto Power over flawed code.',
    systemInstruction: buildSystemPromptWithReasoning(heptaseusAgent.generateHeptaseusSystemPrompt())
  },
  {
    id: '.hermes',
    name: 'Hermes (Memory & Research Specialist)',
    description: 'Researcher, MCP Specialist & Experience Memory Engine',
    boundary: 'Fetches technical docs, Context7 search, MCP execution, manages & retrieves Experience Bank memory in SQLite (~/.agentyx/memory.db), sanitizes data streams. DOES NOT write main production code.',
    systemInstruction: buildSystemPromptWithReasoning(hermesAgent.generateHermesSystemPrompt())
  },
  {
    id: 'Full-Team Coding',
    name: 'Full-Team Coding (Developer)',
    description: 'Executive Polyglot Developers',
    boundary: 'Writes idiomatic production code in any programming language (Python, Rust, Go, C/C++, Java, TS/JS, PHP, SQL, Docker) with adaptive comment headers.',
    systemInstruction: buildSystemPromptWithReasoning(fullTeamAgent.generateFullTeamSystemPrompt())
  }
];

export class AgentManager {
  private activeAgentId: string;

  constructor() {
    this.activeAgentId = configManager.getConfig().ACTIVE_AGENT || 'Full-Team Coding';
  }

  public getAvailableAgents(): AgentRole[] {
    return AGENT_ROLES;
  }

  public getActiveAgent(): AgentRole {
    const found = AGENT_ROLES.find(a => a.id === this.activeAgentId || a.name === this.activeAgentId);
    return found || AGENT_ROLES[4]; // Default to Full-Team Coding
  }

  public switchAgent(agentIdOrName: string): AgentRole {
    const target = AGENT_ROLES.find(
      a => a.id.toLowerCase() === agentIdOrName.toLowerCase() || a.name.toLowerCase() === agentIdOrName.toLowerCase()
    );

    if (!target) {
      throw new Error(`Agent '${agentIdOrName}' not found. Available: ${AGENT_ROLES.map(a => a.id).join(', ')}`);
    }

    this.activeAgentId = target.id;
    configManager.updateConfig('ACTIVE_AGENT', target.id);
    manifestManager.setAgentState(target.id, `Switched role to ${target.name}`);
    manifestManager.logFootprint('AGENT_SWITCH', `Switched active role to ${target.id}`);

    return target;
  }
}

export const agentManager = new AgentManager();
