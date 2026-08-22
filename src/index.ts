/**
 * @file index.ts
 * @description Main entry point for Agentyx AI Agentic CLI Platform (Version 3.0)
 * @purpose Bootstraps REPL shell, Commander CLI options, 9router integration, SQLite Second Brain, TUI Box aesthetics, and Interactive Slash Menu.
 * @functions startInteractiveRepl, main - Main CLI execution loop and slash command processor.
 */

import readline from 'node:readline';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { configManager } from './config/config-manager.js';
import { dbDriver } from './database/sqlite-driver.js';
import { sessionStore } from './database/session-store.js';
import { slashHandler } from './commands/slash-handler.js';
import { executeInitCommand } from './commands/init.js';
import { executeRemoveSlopCommand } from './commands/remove-slop.js';
import { executeSessionsCommand, executeNewSessionCommand } from './commands/sessions.js';
import { nineRouterClient } from './router/ninerouter-client.js';
import { agentManager } from './agents/agent-manager.js';
import { manifestManager } from './docs/manifest-manager.js';
import { mcpStatusManager } from './utils/mcp-status.js';
import { tuiTheme } from './ui/tui-theme.js';

const program = new Command();

program
  .name('agentyx')
  .description('Platform Agentic AI CLI Global with 9router integration, SQLite Second Brain, and Reasoning Mitigation')
  .version('3.0.0')
  .option('-i, --init', 'Initialize mandatory 4 manifest documentation bundle in current workspace')
  .option('-s, --remove-slop', 'Scan & clean AI slop from active workspace')
  .option('-l, --sessions', 'List saved sessions in SQLite Second Brain')
  .option('-a, --agent <role>', 'Switch active Swarm agent persona')
  .option('-m, --model <combo>', 'Switch active 9router combo model')
  .option('-p, --mcp', 'Display active MCPs and Swarm tools status');

program.parse(process.argv);
const options = program.opts();

async function runCliOptions(): Promise<boolean> {
  if (options.init) {
    console.log(executeInitCommand());
    return true;
  }

  if (options.removeSlop) {
    console.log(executeRemoveSlopCommand());
    return true;
  }

  if (options.sessions) {
    console.log(executeSessionsCommand());
    return true;
  }

  if (options.agent) {
    try {
      const role = agentManager.switchAgent(options.agent);
      console.log(chalk.bold.green(`✔ Active Swarm agent switched to: ${role.name}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`❌ ${msg}`));
    }
    return true;
  }

  if (options.model) {
    configManager.updateConfig('DEFAULT_COMBO', options.model);
    console.log(chalk.bold.green(`✔ 9router combo model set to: ${options.model}`));
    return true;
  }

  if (options.mcp) {
    console.log(mcpStatusManager.formatMcpStatusPanel());
    return true;
  }

  return false;
}

async function startInteractiveRepl(): Promise<void> {
  tuiTheme.renderHeaderBanner();

  let cfg = configManager.getConfig();
  let currentSessionId = cfg.ACTIVE_SESSION_ID;

  if (!currentSessionId || !sessionStore.getSessionById(currentSessionId)) {
    const { session } = executeNewSessionCommand('Default Agentyx Session');
    currentSessionId = session.id;
  }

  process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n❌ Uncaught Exception:'), err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('\n❌ Unhandled Rejection:'), reason);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: tuiTheme.getRichPromptBadge()
  });

  rl.prompt();

  rl.on('SIGINT', () => {
    console.log(chalk.bold.yellow('\n⚠️ Gunakan perintah /exit atau ketik "exit" untuk keluar dari Agentyx.'));
    process.stdin.resume();
    rl.prompt();
  });

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit' || input.toLowerCase() === '/exit') {
      console.log(chalk.bold.yellow('\nGoodbye! Session saved in SQLite Second Brain.'));
      dbDriver.close();
      rl.close();
      process.exit(0);
      return;
    }

    // Handle Slash Commands
    if (slashHandler.isSlashCommand(input)) {
      rl.pause();
      try {
        const output = await slashHandler.handleSlashCommand(input);
        if (output === '__EXIT__') {
          console.log(chalk.bold.yellow('\nGoodbye! Session saved in SQLite Second Brain.'));
          dbDriver.close();
          rl.close();
          process.exit(0);
          return;
        }
        if (output) {
          console.log(output);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`❌ Error executing slash command: ${msg}`));
      } finally {
        process.stdin.resume();
        rl.resume();
        rl.setPrompt(tuiTheme.getRichPromptBadge());
        rl.prompt();
      }
      return;
    }

    // Handle standard user prompt
    const activeAgent = agentManager.getActiveAgent();
    cfg = configManager.getConfig();

    // 1. Record user message in SQLite
    sessionStore.addMessage(currentSessionId!, 'user', input);
    manifestManager.logFootprint('USER_PROMPT', `Prompt submitted in session [${currentSessionId!.slice(0, 8)}]`);

    // 2. Build message context including 4 manifest files context
    const manifests = manifestManager.readAllManifests();
    const systemInstruction = `${activeAgent.systemInstruction}\n\nProject Context:\nWorkflow: ${manifests.workflow.slice(0, 500)}\nAgent State: ${manifests.agent.slice(0, 300)}`;

    const historyMessages = sessionStore.getSessionMessages(currentSessionId!);
    const apiMessages = [
      { role: 'system' as const, content: systemInstruction },
      ...historyMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
    ];

    const spinner = ora(chalk.bold.cyan(`Thinking as ${activeAgent.name}...`)).start();

    try {
      const response = await nineRouterClient.sendChatCompletion(
        apiMessages,
        cfg.DEFAULT_COMBO,
        (thoughtChunk) => {
          spinner.text = chalk.dim(`Thinking: ${thoughtChunk.slice(0, 50)}...`);
        }
      );

      spinner.stop();

      // Display Thinking in dimmed / collapsed format if present
      if (response.thought) {
        console.log(chalk.dim.italic(`\n💭 [Reasoning Thought]:\n${response.thought}\n`));
      }

      console.log(chalk.bold.green(`\n🤖 ${activeAgent.name}:\n`));
      console.log(response.content + '\n');

      // Record assistant message & thought in SQLite
      sessionStore.addMessage(currentSessionId!, 'assistant', response.content, response.thought);

      // Real-time manifest update
      manifestManager.logFootprint('AI_RESPONSE', `Response generated by ${activeAgent.id}`);
    } catch (err: unknown) {
      spinner.fail(chalk.red('Error generating response'));
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`❌ ${msg}\n`));
    }

    process.stdin.resume();
    rl.setPrompt(tuiTheme.getRichPromptBadge());
    rl.prompt();
  });

  rl.on('close', () => {
    dbDriver.close();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  const handled = await runCliOptions();
  if (!handled) {
    await startInteractiveRepl();
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal Agentyx Error:'), err);
  process.exit(1);
});
