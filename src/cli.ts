import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { CompleterResult } from "node:readline";
import { createInterface } from "node:readline/promises";
import { Config } from "./config.js";
import { LLMClient } from "./llm/llm_wrapper.js";
import { Agent } from "./agent.js";
// ============ 工具函数 ============

function getProjectVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(here, "..", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      version?: unknown;
    };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printBanner(): void {
  const BOX_WIDTH = 58;
  const bannerText = "🤖 Mini Agent - Multi-turn Interactive Session";

  const bannerWidth = bannerText.length;
  const totalPadding = BOX_WIDTH - bannerWidth;
  const leftPaddingCount = Math.floor(totalPadding / 2);
  const rightPaddingCount = totalPadding - leftPaddingCount;

  const leftPadding = " ".repeat(Math.max(0, leftPaddingCount));
  const rightPadding = " ".repeat(Math.max(0, rightPaddingCount));
  const horizontalLine = "═".repeat(BOX_WIDTH);

  console.log();
  console.log(`╔${horizontalLine}╗`);
  console.log(`║${leftPadding}${bannerText}${rightPadding}║`);
  console.log(`╚${horizontalLine}╝`);
  console.log();
}

function parseArgs(): { workspace: string | undefined } {
  const program = new Command();

  program
    .description("Mini Agent - AI assistant with file tools and MCP support")
    .version(getProjectVersion(), "-v, --version")
    .addHelpText(
      "after",
      `
Examples:
  mini-agent-ts                              # Use current directory as workspace
  mini-agent-ts --workspace /path/to/dir     # Use specific workspace directory
      `
    );

  program.option(
    "-w, --workspace <dir>",
    "Workspace directory (default: current directory)"
  );

  program.parse(process.argv);
  const options = program.opts();

  return {
    workspace: options["workspace"] as string | undefined,
  };
}

function printHelp(): void {
  console.log(`
Available Commands:
  /help      - Show this help message
  /clear     - Clear session history (keep system prompt)
  /history   - Show current session message count
  /stats     - Show session statistics
  /exit      - Exit program (also: exit, quit, q)
`);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function printStats(agent: Agent, sessionStartMs: number): void {
  const duration = formatDuration(Date.now() - sessionStartMs);
  const total = agent.messages.length;
  const userMsgs = agent.messages.filter((m) => m.role === "user").length;
  const assistantMsgs = agent.messages.filter(
    (m) => m.role === "assistant"
  ).length;
  const toolMsgs = agent.messages.filter((m) => m.role === "tool").length;

  console.log("\nSession Statistics:");
  console.log("─".repeat(40));
  console.log(`  Session Duration: ${duration}`);
  console.log(`  Total Messages: ${total}`);
  console.log(`    - User Messages: ${userMsgs}`);
  console.log(`    - Assistant Replies: ${assistantMsgs}`);
  console.log(`    - Tool Calls: ${toolMsgs}`);
  console.log("─".repeat(40) + "\n");
}

// ============ 核心启动逻辑 ============

async function runAgent(workspaceDir: string): Promise<void> {
  console.log(`Agent starting in: ${workspaceDir}`);
  const sessionStartMs = Date.now();

  // 加载配置文件
  const configPath = Config.getDefaultConfigPath();
  const config = Config.fromYaml(configPath);
  console.log(`Config loaded from: ${configPath}`);
  console.log(`Model: ${config.llm.model}, Provider: ${config.llm.provider},`);

  // 初始化 LLM Client
  const llmClient = new LLMClient(
    config.llm.apiKey,
    config.llm.apiBase,
    config.llm.provider,
    config.llm.model
  );

  // 加载 system prompt
  let systemPrompt: string;
  let systemPromptPath = Config.findConfigFile(config.agent.systemPromptPath);
  if (systemPromptPath && fs.existsSync(systemPromptPath)) {
    systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");
    console.log(`✅ Loaded system prompt (from: ${systemPromptPath})`);
  } else {
    systemPrompt =
      "You are Mini-Agent, an intelligent assistant powered by MiniMax M2 that can help users complete various tasks.";
    console.log("⚠️  System prompt not found, using default");
  }

  // 创建 Agent 类
  let agent = new Agent(llmClient, systemPrompt, config.agent.maxSteps);

  printBanner();
  console.log(`Model: ${config.llm.model}`);
  console.log(`Workspace: ${workspaceDir}`);
  console.log(`Type /help for help, /exit to quit\n`);

  const commands: string[] = [
    "/help",
    "/clear",
    "/history",
    "/stats",
    "/exit",
    "/quit",
    "/q",
  ];
  const commandSet = new Set(commands);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1000,
    removeHistoryDuplicates: true,
    completer: (line: string) => {
      if (!line.startsWith("/")) return [[], line] as CompleterResult;
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits.length ? hits : commands, line] as CompleterResult;
    },
  });
  let interrupted = false;
  const onSigint = (): void => {
    interrupted = true;
    try {
      rl.close();
    } catch {
      // ignore
    }
  };
  process.once("SIGINT", onSigint);

  // 开启Agent主循环
  try {
    while (true) {
      let raw: string;
      try {
        raw = await rl.question("You > ");
      } catch (error) {
        if (interrupted) break;
        throw error;
      }

      const userInput = raw.trim();
      if (!userInput) continue;

      if (userInput.startsWith("/")) {
        const cmd = userInput.toLowerCase();
        if (cmd === "/help") {
          printHelp();
          continue;
        }
        if (cmd === "/clear") {
          const removed = agent.clearHistoryKeepSystem();
          console.log(`✅ Cleared ${removed} messages, starting new session\n`);
          continue;
        }
        if (cmd === "/history") {
          console.log(
            `\nCurrent session message count: ${agent.messages.length}\n`
          );
          continue;
        }
        if (cmd === "/stats") {
          printStats(agent, sessionStartMs);
          continue;
        }
        if (cmd === "/exit" || cmd === "/quit" || cmd === "/q") break;

        if (commandSet.has(cmd)) break;
        console.log(`❌ Unknown command: ${userInput}`);
        console.log(`Type /help to see available commands\n`);
        continue;
      }

      if (userInput === "exit" || userInput === "quit" || userInput === "q")
        break;
      agent.addUserMessage(userInput);
      await agent.run();
      console.log("\n" + "─".repeat(60) + "\n");
    }
  } finally {
    process.removeListener("SIGINT", onSigint);
    rl.close();
    if (!interrupted) printStats(agent, sessionStartMs);
  }
  // TODO: 清理 MCP 连接
}

function resolveWorkspace(args: { workspace: string | undefined }): string {
  let workspaceDir: string;

  if (args.workspace) {
    workspaceDir = path.resolve(args.workspace);
  } else {
    workspaceDir = process.cwd();
  }

  // 确保 workspace 目录存在
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  return workspaceDir;
}

export async function run(): Promise<void> {
  const args = parseArgs();

  let workspaceDir: string;
  try {
    workspaceDir = resolveWorkspace(args);
    console.log(`\nWorkspace initialized at: ${workspaceDir}`);
  } catch (error) {
    console.error(`❌ Error creating workspace directory: ${error}`);
    process.exit(1);
  }

  await runAgent(workspaceDir);
}
