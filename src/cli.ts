import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
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

// ============ 核心启动逻辑 ============

async function runAgent(workspaceDir: string): Promise<void> {
  console.log(`Agent starting in: ${workspaceDir}`);

  // TODO: 加载配置文件
  const configPath = Config.getDefaultConfigPath();
  const config = Config.fromYaml(configPath);
  console.log(`Config loaded from: ${configPath}`);
  console.log(`Model: ${config.llm.model}, Provider: ${config.llm.provider},`);

  // TODO: 初始化 LLM Client

  const llmClient = new LLMClient(
    config.llm.apiKey,
    config.llm.apiBase,
    config.llm.provider,
    config.llm.model
  );

  // TODO: 初始化工具
  // TODO: 加载 system prompt, skill
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
  // TODO: 创建 Agent 类
  let agent = new Agent(llmClient, systemPrompt, config.agent.maxSteps);
  console.log(agent.systemPrompt);
  // TODO: 打印欢迎信息
  printBanner();
  // TODO: 配置 readline 的输入
  // TODO: 正式开启 agent 交互主循环
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
