/**
 * @file index.ts
 * @description Main entry point for Agentyx AI Agentic CLI Platform (Version 3.2.3)
 * @purpose Bootstraps REPL shell, Commander CLI options, 9router integration, SQLite Second Brain, TUI Box aesthetics, Multi-Turn Agent Loop, and OpenCode-Style [~pasted xx lines~] UI.
 * @functions startInteractiveRepl, processInput, main - Main CLI execution loop, paste debouncer, and slash command processor.
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
import { nineRouterClient, ChatMessage } from './router/ninerouter-client.js';
import { agentManager } from './agents/agent-manager.js';
import { manifestManager } from './docs/manifest-manager.js';
import { mcpStatusManager } from './utils/mcp-status.js';
import { tuiTheme } from './ui/tui-theme.js';
import { toolExecutor } from './tools/tool-executor.js';
import { getAgentyxTools, parseToolCallsFromText, inferToolCallFromObject, ParsedToolCall } from './tools/tool-definitions.js';
import { jsonSanitizer } from './sanitizer/json-sanitizer.js';

const program = new Command();

program
  .name('agentyx')
  .description('Platform Agentic AI CLI Global with 9router integration, SQLite Second Brain, and Reasoning Mitigation')
  .version('3.2.3')
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
    prompt: tuiTheme.getRichPromptBadge(),
    terminal: true, // Forces full ANSI terminal capabilities for Arrow navigation, Backspace, Home, End across Termux & all OS
    historySize: 100
  });

  rl.prompt();

  rl.on('SIGINT', () => {
    console.log(chalk.bold.yellow('\n⚠️ Gunakan perintah /exit atau ketik "exit" untuk keluar dari Agentyx.'));
    process.stdin.resume();
    rl.prompt();
  });

  // Smart Multiline Paste Buffer Collector & OpenCode-Style Renderer
  let pasteBuffer: string[] = [];
  let pasteTimer: NodeJS.Timeout | null = null;

  const processInput = async (input: string, lineCount: number = 1) => {
    // Strip any orphaned ANSI escape control codes (like \x1b[D, \x1b[C from raw arrow keys)
    const sanitizedInput = (input || '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();

    if (!sanitizedInput) {
      rl.prompt();
      return;
    }

    const trimmed = sanitizedInput;

    // OpenCode-Style UI: Replace raw multiline paste clutter with compact [~pasted xx lines~] badge
    if (lineCount > 2) {
      try {
        readline.moveCursor(process.stdout, 0, -Math.min(lineCount, 30));
        readline.clearScreenDown(process.stdout);
        console.log(chalk.cyan.bold(`\n[📋 ~pasted ${lineCount} lines~]\n`));
      } catch {
        console.log(chalk.cyan.bold(`\n[📋 ~pasted ${lineCount} lines~]\n`));
      }
    }

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === '/exit') {
      console.log(chalk.bold.yellow('\nGoodbye! Session saved in SQLite Second Brain.'));
      dbDriver.close();
      rl.close();
      process.exit(0);
      return;
    }

    // Handle Slash Commands
    if (slashHandler.isSlashCommand(trimmed)) {
      rl.pause();
      try {
        const output = await slashHandler.handleSlashCommand(trimmed);
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

    // Handle standard user prompt (including multiline error logs)
    const activeAgent = agentManager.getActiveAgent();
    cfg = configManager.getConfig();

    // 1. Record user message in SQLite
    sessionStore.addMessage(currentSessionId!, 'user', trimmed);
    manifestManager.logFootprint('USER_PROMPT', `Prompt submitted in session [${currentSessionId!.slice(0, 8)}]`);

    // 2. Build message context including 4 manifest files context
    const manifests = manifestManager.readAllManifests();
    const systemInstruction = `${activeAgent.systemInstruction}\n\nProject Context:\nWorkflow: ${manifests.workflow.slice(0, 500)}\nAgent State: ${manifests.agent.slice(0, 300)}\n\nIMPORTANT SYSTEM RULE: You have active native tools: \`terminal\` (executes shell commands), \`read_file\`, \`write_file\`, \`list_dir\`, \`grep_search\`, \`web_search\`, and \`web_fetch\`. Whenever the user asks you to run terminal/shell commands, read files, edit code, or analyze pasted error logs, DO NOT output plain text explanations or unexecuted code blocks. CALL THE RELEVANT TOOL DIRECTLY via function calls or JSON format (\`\`\`json { "tool": "terminal", "command": "..." } \`\`\`).\n\nAUTONOMOUS ERROR LOG DIRECTIVE: If a terminal command or build fails or its output references an error log file (e.g. 'See log file at...', '.log', '.txt', 'npm-debug.log'), YOU MUST IMMEDIATELY CALL \`read_file\` ON THAT LOG FILE in the next turn to inspect the exact error root cause. DO NOT abort or conclude your task without reading the referenced log file!`;

    const historyMessages = sessionStore.getSessionMessages(currentSessionId!);
    const apiMessages: ChatMessage[] = [
      { role: 'system' as const, content: systemInstruction },
      ...historyMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system' | 'tool', content: m.content }))
    ];

    const tools = getAgentyxTools();
    let turnCount = 0;
    const maxTurns = 5;

    while (turnCount < maxTurns) {
      turnCount++;
      const spinner = ora(chalk.bold.cyan(`Thinking as ${activeAgent.name} (Step ${turnCount})...`)).start();

      try {
        const response = await nineRouterClient.sendChatCompletion(
          apiMessages,
          cfg.DEFAULT_COMBO,
          (thoughtChunk) => {
            spinner.text = chalk.dim(`Thinking: ${thoughtChunk.slice(0, 50)}...`);
          },
          undefined,
          tools
        );

        spinner.stop();

        // Display Thinking in dimmed / collapsed format if present
        if (response.thought) {
          console.log(chalk.dim.italic(`\n💭 [Reasoning Thought]:\n${response.thought}\n`));
        }

        // Check for tool calls (OpenAI function calling or fallback JSON text parsing)
        let callsToExecute: ParsedToolCall[] = [];

        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const tc of response.tool_calls) {
            let argsObj: Record<string, unknown> = {};
            if (typeof tc.function?.arguments === 'string') {
              const parsedArgs = jsonSanitizer.sanitizeAndParse<Record<string, unknown>>(tc.function.arguments);
              argsObj = parsedArgs.data || {};
            } else if (typeof tc.function?.arguments === 'object') {
              argsObj = tc.function.arguments;
            }
            const inferred = inferToolCallFromObject({ name: tc.function?.name, arguments: argsObj });
            if (inferred) {
              callsToExecute.push({
                ...inferred,
                id: tc.id || inferred.id
              });
            }
          }
        } else {
          callsToExecute = parseToolCallsFromText(response.content);
        }

        if (callsToExecute.length > 0) {
          if (response.content) {
            console.log(chalk.bold.green(`\n🤖 ${activeAgent.name}:\n${response.content}\n`));
            apiMessages.push({ role: 'assistant', content: response.content });
          }

          for (const call of callsToExecute) {
            console.log(chalk.bold.yellow(`\n⚡ [Tool Call: ${call.name}]`));
            if (call.arguments.command) {
              console.log(chalk.cyan(`$ ${call.arguments.command}`));
            } else if (call.arguments.path) {
              console.log(chalk.cyan(`📄 ${call.arguments.path}`));
            } else if (call.arguments.query) {
              console.log(chalk.cyan(`🔍 ${call.arguments.query}`));
            }

            const execSpinner = ora(chalk.bold.yellow(`Executing ${call.name}...`)).start();
            const result = await toolExecutor.executeTool(call.name, call.arguments);
            execSpinner.stop();

            const statusIcon = result.success ? chalk.green('✔') : chalk.red('❌');
            console.log(`${statusIcon} ${chalk.bold('Execution Output')}:\n${chalk.dim(result.output)}\n`);

            let toolResultText = `[Tool Execution Result for ${call.name}]:\nStatus: ${result.success ? 'Success' : 'Error'}\nOutput:\n${result.output}`;

            // If execution failed or output references a log file, append autonomous directive to guide LLM
            if (!result.success || /(?:log|error|written to|see|file)\s+[:=]?\s*([^\s\n]+\.(?:log|txt|out|err))/i.test(result.output)) {
              toolResultText += `\n\n[SYSTEM DIRECTIVE]: An error or log file reference was detected. If the output mentions a log file path, call \`read_file\` on that path now to inspect the root cause before finalizing your response.`;
            }

            apiMessages.push({
              role: 'user',
              content: toolResultText
            });
          }

          // Loop back to let the LLM see the tool output
          continue;
        }

        // Final answer from model without further tool calls
        console.log(chalk.bold.green(`\n🤖 ${activeAgent.name}:\n`));
        console.log(response.content + '\n');

        // Record assistant message & thought in SQLite
        sessionStore.addMessage(currentSessionId!, 'assistant', response.content, response.thought);
        manifestManager.logFootprint('AI_RESPONSE', `Response generated by ${activeAgent.id}`);
        break;

      } catch (err: unknown) {
        spinner.fail(chalk.red('Error generating response'));
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`❌ ${msg}\n`));
        break;
      }
    }

    process.stdin.resume();
    rl.setPrompt(tuiTheme.getRichPromptBadge());
    rl.prompt();
  };

  rl.on('line', (line: string) => {
    pasteBuffer.push(line);

    if (pasteTimer) {
      clearTimeout(pasteTimer);
    }

    pasteTimer = setTimeout(async () => {
      const lineCount = pasteBuffer.length;
      const accumulatedInput = pasteBuffer.join('\n');
      pasteBuffer = [];
      pasteTimer = null;

      await processInput(accumulatedInput, lineCount);
    }, 60); // 60ms debounce window collects pasted multiline logs together
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
