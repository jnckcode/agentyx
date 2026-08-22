# Agentyx Project Workflow & Roadmap

/**
 * @file workflow.md
 * @description Master roadmap, task list, technical decisions, and project dependencies.
 * @purpose Maintained by .prometheus and updated in real-time during execution.
 */

## Technical Architecture & Decisions
- **Language Stack**: Node.js v22+ with TypeScript / ES Modules.
- **Database Engine**: SQLite database stored at `~/.agentyx/memory.db` (`better-sqlite3`) for session history, entity memory, and file indexing.
- **CLI Framework**: Interactive REPL with slash command routing (`commander`, `inquirer`, `chalk`, `ora`).
- **9router Integration**: REST/OpenAI-compatible client with credential storage in `~/.agentyx/config.json`.
- **Sanitizer & Parser Engine**: Asynchronous streaming Thinking Isolator (`<thought>...</thought>`) & robust JSON repair system.
- **Manifest Protocol**: Real-time synchronization of `workflow.md`, `footprint.md`, `agent.md`, `prompt.md`.

## Task Progress

- [x] Initializing 4 Mandatory Manifest Files (`workflow.md`, `footprint.md`, `agent.md`, `prompt.md`)
- [x] Setting up `package.json` & TypeScript CLI structure with entrypoint `bin/agentyx.js`
- [x] Implementing Config Manager (`~/.agentyx/config.json`)
- [x] Implementing SQLite Second Brain & Session Storage (`~/.agentyx/memory.db`)
- [x] Implementing Thinking Isolator & JSON Repair Sanitizer
- [x] Implementing 9router API Client & Combo Switcher
- [x] Implementing Slash Commands (`/new`, `/init`, `/sessions`, `/remove-slop`, `/agents`, `/models`)
- [x] Implementing Agent Swarm System (`.prometheus`, `.sisyphus`, `.heptaseus`, `.hermes`, `Full-Team Coding`)
- [x] Implementing Real-Time Manifest Documentation Sync Protocol
- [x] Code Header Standardization Audit & Code Cleanup (`/remove-slop` verification)
- [x] End-to-End QA Testing & Global Link (`npm link` / execution test)
