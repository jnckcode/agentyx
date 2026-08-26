/**
 * @file index.ts
 * @description Main entry point for Agentyx AI Agentic CLI Platform (Version 3.5.0)
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
import { executeUpdateCommand } from './commands/update.js';
import { nineRouterClient, ChatMessage } from './router/ninerouter-client.js';
import { agentManager } from './agents/agent-manager.js';
import { manifestManager } from './docs/manifest-manager.js';
import { mcpStatusManager } from './utils/mcp-status.js';
import { tuiTheme, PALETTE } from './ui/tui-theme.js';
import { toolExecutor } from './tools/tool-executor.js';
import { getAgentyxTools, parseToolCallsFromText, inferToolCallFromObject, ParsedToolCall } from './tools/tool-definitions.js';
import { jsonSanitizer } from './sanitizer/json-sanitizer.js';
import { getAppVersion } from './utils/version.js';

const program = new Command();

program
  .name('agentyx')
  .description('Platform Agentic AI CLI Global with 9router integration, SQLite Second Brain, and Reasoning Mitigation')
  .version(getAppVersion())
  .option('-i, --init', 'Initialize mandatory 4 manifest documentation bundle in current workspace')
  .option('-s, --remove-slop', 'Scan & clean AI slop from active workspace')
  .option('-l, --sessions', 'List saved sessions in SQLite Second Brain')
  .option('-a, --agent <role>', 'Switch active Swarm agent persona')
  .option('-m, --model <combo>', 'Switch active 9router combo model')
  .option('-p, --mcp', 'Display active MCPs and Swarm tools status')
  .option('-u, --update', 'Check and update Agentyx to latest version in-place');

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

  if (options.update) {
    console.log(await executeUpdateCommand(false));
    return true;
  }

  return false;
}

async function startInteractiveRepl(): Promise<void> {
  tuiTheme.enterAlternateScreen();
  tuiTheme.renderHeaderBanner();

  let cfg = configManager.getConfig();
  let currentSessionId = cfg.ACTIVE_SESSION_ID;

  if (!currentSessionId || !sessionStore.getSessionById(currentSessionId)) {
    const existingSessions = sessionStore.listSessions();
    if (existingSessions.length > 0) {
      currentSessionId = existingSessions[0].id;
      configManager.updateConfig('ACTIVE_SESSION_ID', currentSessionId);
    } else {
      const { session } = executeNewSessionCommand('Default Agentyx Session');
      currentSessionId = session.id;
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: tuiTheme.getRichPromptBadge(),
    terminal: true, // Forces full ANSI terminal capabilities for Arrow navigation, Backspace, Home, End across Termux & all OS
    historySize: 100
  });

  const cleanupAndExit = (code: number = 0, message?: string) => {
    tuiTheme.leaveAlternateScreen();
    if (message) {
      console.log(message);
    }
    dbDriver.close();
    try {
      rl.close();
    } catch {
      // ignore
    }
    process.exit(code);
  };

  process.on('SIGTERM', () => {
    cleanupAndExit(0);
  });

  process.on('exit', () => {
    tuiTheme.leaveAlternateScreen();
  });

  process.on('uncaughtException', (err) => {
    tuiTheme.leaveAlternateScreen();
    console.error(chalk.red('\n❌ Uncaught Exception:'), err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    tuiTheme.leaveAlternateScreen();
    console.error(chalk.red('\n❌ Unhandled Rejection:'), reason);
    process.exit(1);
  });

  const promptUser = () => {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
      } catch {}
    }
    if (process.stdin.isPaused()) {
      try {
        process.stdin.resume();
      } catch {}
    }
    rl.resume();
    rl.setPrompt(tuiTheme.getRichPromptBadge());
    rl.prompt();
  };

  promptUser();

  rl.on('SIGINT', () => {
    console.log(chalk.bold.yellow('\n⚠️ Gunakan perintah /exit atau ketik "exit" untuk keluar dari Agentyx.'));
    promptUser();
  });

  // Smart Multiline Paste Buffer Collector & OpenCode-Style Renderer
  let pasteBuffer: string[] = [];
  let pasteTimer: NodeJS.Timeout | null = null;

  const processInput = async (input: string, lineCount: number = 1) => {
    rl.pause(); // Pause readline interface immediately during processing to prevent duplicate prompt rendering

    // Comprehensive ANSI Escape Sequence & Control Code cleaner (ECMA-48 / ANSI / SS3 / CSI / OSC)
    const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]|(?:\x1b[O\\[][A-Za-z0-9])/g;
    const sanitizedInput = (input || '')
      .replace(ANSI_REGEX, '')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .trim();

    if (!sanitizedInput) {
      promptUser();
      return;
    }

    const trimmed = sanitizedInput;

    // OpenCode-Style UI: Replace raw multiline paste clutter with compact [~pasted xx lines~] badge
    if (lineCount > 2) {
      try {
        readline.moveCursor(process.stdout, 0, -Math.min(lineCount, 30));
        readline.clearScreenDown(process.stdout);
        console.log(chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(`\n [📋 ~pasted ${lineCount} lines~] \n`));
      } catch {
        console.log(chalk.bold.bgHex(PALETTE.forestDark).hex(PALETTE.lemonLight)(`\n [📋 ~pasted ${lineCount} lines~] \n`));
      }
    }

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === '/exit') {
      cleanupAndExit(0, chalk.bold.hex(PALETTE.warmAmber)('\nGoodbye! Session saved in SQLite Second Brain.'));
      return;
    }

    // Handle Slash Commands
    if (slashHandler.isSlashCommand(trimmed)) {
      rl.pause();
      try {
        const output = await slashHandler.handleSlashCommand(trimmed);
        if (output === '__EXIT__') {
          cleanupAndExit(0, chalk.bold.hex(PALETTE.warmAmber)('\nGoodbye! Session saved in SQLite Second Brain.'));
          return;
        }
        if (output) {
          console.log(output);
        }
        // Resync currentSessionId in case /sessions or /new switched the session
        cfg = configManager.getConfig();
        currentSessionId = cfg.ACTIVE_SESSION_ID || currentSessionId;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`❌ Error executing slash command: ${msg}`));
      } finally {
        promptUser();
      }
      return;
    }

    // Handle standard user prompt (including multiline error logs)
    const activeAgent = agentManager.getActiveAgent();
    cfg = configManager.getConfig();
    currentSessionId = cfg.ACTIVE_SESSION_ID || currentSessionId;

    // Auto-name session on first prompt if still using default generic title
    const currentSession = sessionStore.getSessionById(currentSessionId!);
    if (currentSession && (currentSession.title === 'Default Agentyx Session' || currentSession.title === 'New Agentyx Session' || currentSession.title.startsWith('New Agentyx Session'))) {
      const autoTitle = trimmed.slice(0, 45).replace(/[\r\n\t]+/g, ' ').trim();
      if (autoTitle.length > 2) {
        sessionStore.updateSessionTitle(currentSessionId!, autoTitle);
      }
    }

    // 1. Record user message in SQLite
    sessionStore.addMessage(currentSessionId!, 'user', trimmed);
    manifestManager.logFootprint('USER_PROMPT', `Prompt submitted in session [${currentSessionId!.slice(0, 8)}]`);

    // 2. Build message context including 4 manifest files context
    const manifests = manifestManager.readAllManifests();
    const systemInstruction = `${activeAgent.systemInstruction}\n\nProject Context:\nWorkflow: ${manifests.workflow.slice(0, 500)}\nAgent State: ${manifests.agent.slice(0, 300)}\n\n======================================================================\nSTRICT AGENTIC OPERATIONAL MANDATE (HARDENED):\nYou are an Autonomous Agentic AI system operating directly in the user's terminal environment.\nYOU HAVE ACTIVE NATIVE TOOLS: \`terminal\` (executes shell commands), \`write_file\` (creates/edits files), \`read_file\`, \`list_dir\`, \`grep_search\`, \`web_search\`, and \`web_fetch\`.\n\nCRITICAL RULES:\n1. NEVER output code snippets, file contents, or shell commands as plain text or markdown code blocks for the user to copy-paste manually.\n2. WHENEVER you need to create or modify a file, YOU MUST IMMEDIATELY ISSUE A \`write_file\` TOOL CALL.\n3. WHENEVER you need to run bash/sh commands, builds, package installations, or directory changes, YOU MUST IMMEDIATELY ISSUE A \`terminal\` TOOL CALL.\n4. WHENEVER you need to inspect code or logs, YOU MUST IMMEDIATELY ISSUE A \`read_file\` OR \`grep_search\` TOOL CALL.\n5. DO NOT ask the user to copy-paste commands or perform file edits manually. EXECUTE EVERYTHING AUTONOMOUSLY VIA TOOL CALLS!\n6. ALWAYS TAG COMMANDS: If outputting shell commands, ALWAYS enclose them in tagged \`\`\`bash codeblocks or tool calls. AGENTYX WILL AUTOMATICALLY INTERCEPT AND RUN THEM AUTONOMOUSLY!\n\nAUTONOMOUS ERROR LOG DIRECTIVE: If a terminal command or build fails or its output references an error log file (e.g. 'See log file at...', '.log', '.txt', 'npm-debug.log'), YOU MUST IMMEDIATELY CALL \`read_file\` ON THAT LOG FILE in the next turn to inspect the exact error root cause. DO NOT abort or conclude your task without reading the referenced log file!\n======================================================================`;

    const historyMessages = sessionStore.getRecentMessages(currentSessionId!, 35);
    const apiMessages: ChatMessage[] = [
      { role: 'system' as const, content: systemInstruction },
      ...historyMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system' | 'tool', content: m.content }))
    ];

    const tools = getAgentyxTools();
    let turnCount = 0;
    const maxTurns = 5;

    while (turnCount < maxTurns) {
      turnCount++;
      const spinner = ora(chalk.bold.hex(PALETTE.goldYellow)(`Thinking as ${activeAgent.name} (Step ${turnCount})...`)).start();

      try {
        const response = await nineRouterClient.sendChatCompletion(
          apiMessages,
          cfg.DEFAULT_COMBO,
          (thoughtChunk) => {
            spinner.text = chalk.hex(PALETTE.dimMuted)(`Thinking: ${thoughtChunk.slice(0, 50)}...`);
          },
          undefined,
          tools
        );

        spinner.stop();

        // Display Thinking in dimmed / collapsed format if present
        if (response.thought) {
          console.log(chalk.hex(PALETTE.dimMuted).italic(`\n💭 [Reasoning Thought]:\n${response.thought}\n`));
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
            console.log(chalk.bold.hex(PALETTE.lemonLight)(`\n🤖 ${activeAgent.name}:\n`) + chalk.hex(PALETTE.creamSand)(response.content + '\n'));
            apiMessages.push({ role: 'assistant', content: response.content });
          }

          for (const call of callsToExecute) {
            console.log(chalk.bold.hex(PALETTE.warmAmber)(`\n⚡ [Tool Call: ${call.name}]`));
            if (call.arguments.command) {
              console.log(chalk.hex(PALETTE.lemonLight)(`$ ${call.arguments.command}`));
            } else if (call.arguments.path) {
              console.log(chalk.hex(PALETTE.creamSand)(`📄 ${call.arguments.path}`));
            } else if (call.arguments.query) {
              console.log(chalk.hex(PALETTE.creamSand)(`🔍 ${call.arguments.query}`));
            }

            const execSpinner = ora(chalk.bold.hex(PALETTE.goldYellow)(`Executing ${call.name}...`)).start();
            const result = await toolExecutor.executeTool(call.name, call.arguments);
            execSpinner.stop();

            const statusIcon = result.success ? chalk.bold.hex(PALETTE.forestLight)('✔') : chalk.red('❌');
            console.log(`${statusIcon} ${chalk.bold.hex(PALETTE.goldYellow)('Execution Output')}:\n${chalk.hex(PALETTE.creamSand)(result.output)}\n`);

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
        console.log(chalk.bold.hex(PALETTE.lemonLight)(`\n🤖 ${activeAgent.name}:\n`));
        console.log(chalk.hex(PALETTE.creamSand)(response.content + '\n'));

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

    promptUser();
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
    cleanupAndExit(0);
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
