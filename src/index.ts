/**
 * @file index.ts
 * @description Main entry point for Agentyx AI Agentic CLI Platform (Version 3.5.0)
 * @purpose Bootstraps Full-Screen TUI Engine with Pinned Header, Scrollable Middle Viewport (Mouse Wheel & PgUp/PgDn), Persistent Bottom Input HUD, Multi-Turn Agent Loop, and SQLite Second Brain.
 * @functions startInteractiveRepl, processInput, main - Main CLI execution loop.
 */

import { Command } from 'commander';
import chalk from 'chalk';
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
import { toolExecutor } from './tools/tool-executor.js';
import { getAgentyxTools, parseToolCallsFromText, inferToolCallFromObject, ParsedToolCall } from './tools/tool-definitions.js';
import { jsonSanitizer } from './sanitizer/json-sanitizer.js';
import { getAppVersion } from './utils/version.js';
import { tuiEngine } from './ui/tui-engine.js';

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

  const currentSession = sessionStore.getSessionById(currentSessionId!);
  if (currentSession) {
    tuiEngine.setSessionTitle(currentSession.title);
  }

  // Load recent session messages into TUI viewport
  const recentMsgs = sessionStore.getRecentMessages(currentSessionId!, 15);
  for (const m of recentMsgs) {
    tuiEngine.addMessage({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      thought: m.thought,
      sender: m.role === 'user' ? 'Anda' : agentManager.getActiveAgent().name
    });
  }

  const cleanupAndExit = (code: number = 0, message?: string) => {
    tuiEngine.stop();
    if (message) {
      console.log(message);
    }
    dbDriver.close();
    process.exit(code);
  };

  process.on('SIGTERM', () => cleanupAndExit(0));
  process.on('exit', () => tuiEngine.stop());

  process.on('uncaughtException', (err) => {
    tuiEngine.stop();
    console.error(chalk.red('\n❌ Uncaught Exception:'), err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    tuiEngine.stop();
    console.error(chalk.red('\n❌ Unhandled Rejection:'), reason);
    process.exit(1);
  });

  const processInput = async (input: string) => {
    const sanitizedInput = (input || '').trim();
    if (!sanitizedInput) return;

    if (sanitizedInput.toLowerCase() === 'exit' || sanitizedInput.toLowerCase() === 'quit' || sanitizedInput.toLowerCase() === '/exit') {
      cleanupAndExit(0, chalk.bold.hex('#EB7D00')('\nSampai jumpa! Sesi tersimpan aman di SQLite Second Brain.'));
      return;
    }

    // Handle Slash Commands
    if (slashHandler.isSlashCommand(sanitizedInput)) {
      if (sanitizedInput === '/clear' || sanitizedInput === '/cls') {
        tuiEngine.clearMessages();
        tuiEngine.setStatus('Layar TUI dibersihkan.', false);
        return;
      }

      // Check if command is interactive menu or sessions (requires temporary screen pause for inquirer)
      if (sanitizedInput === '/' || sanitizedInput === '/menu' || sanitizedInput === '/sessions' || sanitizedInput === '/session') {
        tuiEngine.stop();
        try {
          const output = await slashHandler.handleSlashCommand(sanitizedInput);
          if (output === '__EXIT__') {
            cleanupAndExit(0);
            return;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(chalk.red(`❌ Error: ${msg}`));
        } finally {
          cfg = configManager.getConfig();
          currentSessionId = cfg.ACTIVE_SESSION_ID || currentSessionId;
          const sess = sessionStore.getSessionById(currentSessionId!);
          if (sess) tuiEngine.setSessionTitle(sess.title);
          tuiEngine.start(processInput);
        }
        return;
      }

      try {
        const output = await slashHandler.handleSlashCommand(sanitizedInput);
        if (output === '__EXIT__') {
          cleanupAndExit(0);
          return;
        }
        if (output) {
          tuiEngine.addMessage({
            role: 'assistant',
            sender: 'Sistem Agentyx',
            content: output
          });
        }
        cfg = configManager.getConfig();
        currentSessionId = cfg.ACTIVE_SESSION_ID || currentSessionId;
        const sess = sessionStore.getSessionById(currentSessionId!);
        if (sess) tuiEngine.setSessionTitle(sess.title);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        tuiEngine.addMessage({
          role: 'assistant',
          sender: 'Sistem Error',
          content: `❌ Error: ${msg}`
        });
      }
      return;
    }

    // Standard User Message
    const activeAgent = agentManager.getActiveAgent();
    cfg = configManager.getConfig();
    currentSessionId = cfg.ACTIVE_SESSION_ID || currentSessionId;

    // Auto-name session on first prompt
    const sess = sessionStore.getSessionById(currentSessionId!);
    if (sess && (sess.title === 'Default Agentyx Session' || sess.title.startsWith('New Agentyx Session'))) {
      const autoTitle = sanitizedInput.slice(0, 45).replace(/[\r\n\t]+/g, ' ').trim();
      if (autoTitle.length > 2) {
        sessionStore.updateSessionTitle(currentSessionId!, autoTitle);
        tuiEngine.setSessionTitle(autoTitle);
      }
    }

    // 1. Record user message in SQLite & TUI Viewport
    sessionStore.addMessage(currentSessionId!, 'user', sanitizedInput);
    tuiEngine.addMessage({
      role: 'user',
      content: sanitizedInput
    });
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
      tuiEngine.setStatus(`Berpikir sebagai ${activeAgent.name} (Step ${turnCount}/${maxTurns})...`, true);

      try {
        let currentThought = '';
        const response = await nineRouterClient.sendChatCompletion(
          apiMessages,
          cfg.DEFAULT_COMBO,
          (thoughtChunk) => {
            currentThought += thoughtChunk;
            tuiEngine.setStatus(`Berpikir: ${thoughtChunk.slice(0, 45)}...`, true);
          },
          undefined,
          tools
        );

        // Check for tool calls
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
            tuiEngine.addMessage({
              role: 'assistant',
              sender: activeAgent.name,
              content: response.content,
              thought: response.thought
            });
            apiMessages.push({ role: 'assistant', content: response.content });
          }

          for (const call of callsToExecute) {
            tuiEngine.setStatus(`Mengeksekusi tool [${call.name}]...`, true);
            const result = await toolExecutor.executeTool(call.name, call.arguments);

            tuiEngine.addMessage({
              role: 'tool',
              toolName: call.name,
              toolArgs: call.arguments,
              toolSuccess: result.success,
              content: result.output
            });

            let toolResultText = `[Tool Execution Result for ${call.name}]:\nStatus: ${result.success ? 'Success' : 'Error'}\nOutput:\n${result.output}`;

            if (!result.success || /(?:log|error|written to|see|file)\s+[:=]?\s*([^\s\n]+\.(?:log|txt|out|err))/i.test(result.output)) {
              toolResultText += `\n\n[SYSTEM DIRECTIVE]: An error or log file reference was detected. If the output mentions a log file path, call \`read_file\` on that path now to inspect the root cause before finalizing your response.`;
            }

            apiMessages.push({
              role: 'user',
              content: toolResultText
            });
          }

          // Continue multi-turn loop
          continue;
        }

        // Final Response from Model
        tuiEngine.addMessage({
          role: 'assistant',
          sender: activeAgent.name,
          content: response.content,
          thought: response.thought
        });

        sessionStore.addMessage(currentSessionId!, 'assistant', response.content, response.thought);
        manifestManager.logFootprint('AI_RESPONSE', `Response generated by ${activeAgent.id}`);
        break;

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        tuiEngine.addMessage({
          role: 'assistant',
          sender: 'Error',
          content: `❌ Gagal menghasilkan respon: ${msg}`
        });
        break;
      }
    }

    tuiEngine.setStatus('Ketik / untuk Menu Perintah • PgUp/PgDn/Mouse Wheel untuk Scroll', false);
  };

  tuiEngine.start(processInput);
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
