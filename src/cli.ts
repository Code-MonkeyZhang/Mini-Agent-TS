import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { Config } from "./config.js";
import { LLMClient } from "./llm-client/llm-client.js";
import { calculateDelay, RetryExhaustedError } from "./retry.js";
import {
  BashKillTool,
  BashOutputTool,
  BashTool,
  EditTool,
  ReadTool,
  WriteTool,
  cleanupMcpConnections,
  loadMcpToolsAsync,
  setMcpTimeoutConfig,
  type Tool,
} from "./tools/index.js";
import { Logger } from "./util/logger.js";

import { Agent } from "./agent.js";
// ============ Utilities ============

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

function resolveWorkspace(args: { workspace: string | undefined }): string {
  let workspaceDir: string;

  if (args.workspace) {
    workspaceDir = path.resolve(args.workspace);
  } else {
    workspaceDir = process.cwd();
  }

  // Ensure the workspace directory exists
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  return workspaceDir;
}

// ============ Main Startup Logic ============

async function runAgent(workspaceDir: string): Promise<void> {
  // Load Workspace dir
  const configPath = Config.getDefaultConfigPath();
  const config = Config.fromYaml(configPath);
  console.log(`Config loaded from: ${configPath}`);
  console.log(`Workspace: ${workspaceDir}`);

  printBanner();
  console.log(`Model: ${config.llm.model}`)
  console.log(`Provider: ${config.llm.provider}`)  
  console.log(`Base URL: ${config.llm.apiBase}`);
  console.log(`Type 'exit' to quit\n`);

  const onRetry = (error: unknown, attempt: number) => {
    console.log(`\n⚠️  LLM call failed (attempt ${attempt}): ${String(error)}`);
    const nextDelay = calculateDelay(attempt, config.llm.retry);
    console.log(
      `   Retrying in ${(nextDelay / 1000).toFixed(1)}s (attempt ${
        attempt + 1
      })...`
    );
  };

  // Create LLM Client
  const llmClient = new LLMClient(
    config.llm.apiKey,
    config.llm.apiBase,
    config.llm.provider,
    config.llm.model,
    config.llm.retry,
    onRetry
  );

  // Check connection
  process.stdout.write("Checking API connection... ");
  const isConnected = await llmClient.checkConnection();
  if (isConnected) {
    console.log("✅ OK");
  } else {
    console.log("❌ Failed (Check API Key/Network)");
  }

  // Load system prompt
  let systemPrompt: string;
  let systemPromptPath = Config.findConfigFile(config.agent.systemPromptPath);
  if (systemPromptPath && fs.existsSync(systemPromptPath)) {
    systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");
    console.log(`✅ Loaded system prompt`);
  } else {
    systemPrompt =
      "You are Mini-Agent, an intelligent assistant powered by MiniMax M2 that can help users complete various tasks.";
    console.log("⚠️  System prompt not found, using default");
  }
  Logger.log("startup", "System Prompt Content:", systemPrompt);

  // Load Tools & MCPs
  const tools: Tool[] = [];
  if (config.tools.enableFileTools) {
    tools.push(new ReadTool(workspaceDir));
    tools.push(new WriteTool(workspaceDir));
    tools.push(new EditTool(workspaceDir));
  }
  if (config.tools.enableBash) {
    tools.push(new BashTool());
    tools.push(new BashOutputTool());
    tools.push(new BashKillTool());
  }
  if (config.tools.enableMcp) {
    console.log("Loading MCP tools...");
    const mcpConfig = config.tools.mcp;
    setMcpTimeoutConfig({
      connectTimeout: mcpConfig.connectTimeout,
      executeTimeout: mcpConfig.executeTimeout,
      sseReadTimeout: mcpConfig.sseReadTimeout,
    });

    const mcpConfigPath = Config.findConfigFile(config.tools.mcpConfigPath);
    if (mcpConfigPath) {
      const mcpTools = await loadMcpToolsAsync(mcpConfigPath);
      if (mcpTools.length > 0) {
        tools.push(...mcpTools);
        const msg = `✅ Loaded ${mcpTools.length} MCP tools (from: ${mcpConfigPath})`;
        Logger.log("startup", msg);
      } else {
        const msg = "⚠️  No available MCP tools found";
        console.log(msg);
        Logger.log("startup", msg);
      }
    } else {
      const msg = `⚠️  MCP config file not found: ${config.tools.mcpConfigPath}`;
      console.log(msg);
      Logger.log("startup", msg);
    }
  }

  // Init Agent
  let agent = new Agent(
    llmClient,
    systemPrompt,
    tools,
    config.agent.maxSteps,
    workspaceDir
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 1000,
    removeHistoryDuplicates: true,
  });
  let interrupted = false;
  const onSigint = (): void => {
    interrupted = true;
    rl.close();
  };
  process.once("SIGINT", onSigint);

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

      if (userInput === "exit" || userInput === "quit" || userInput === "q")
        break;
      agent.addUserMessage(userInput);

      try {
        await agent.run();
      } catch (error) {
        if (error instanceof RetryExhaustedError) {
          console.log(
            `\n❌ LLM request failed after ${error.attempts} attempts.`
          );
          console.log(`   Last error: ${String(error.lastError)}`);
          console.log("   Please check your API key and configuration.\n");
        } else if (error instanceof Error) {
          console.log(`\n❌ Unexpected error: ${error.message}`);
          console.log("   Please try again or report this issue.\n");
        }

        // Remove unfinished user message
        agent.messages.pop();
        continue;
      }

      console.log("\n" + "─".repeat(60) + "\n");
    }
  } finally {
    // Graceful Shutdown
    process.removeListener("SIGINT", onSigint);
    rl.close();
    await cleanupMcpConnections();
  }
}

export async function run(): Promise<void> {
  Logger.initialize("logs");
  const args = parseArgs();

  let workspaceDir: string;
  try {
    workspaceDir = resolveWorkspace(args);
  } catch (error) {
    console.error(`❌ Error creating workspace directory: ${error}`);
    process.exit(1);
  }

  await runAgent(workspaceDir);
}
