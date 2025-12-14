#!/usr/bin/env node

import { Command } from "commander";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

function getProjectVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(here, "..", "package.json"); // src/.. 或 dist/.. 都是根目录
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      version?: unknown;
    };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function print_banner(): void {
  const BOX_WIDTH = 58;
  const bannerText = "🤖 Mini Agent - Multi-turn Interactive Session";

  // 计算字符串视觉宽度。
  // 注意：JS中一个Emoji通常占2个字符长度，视觉上也占2格，所以直接用 .length 通常是够用的。
  const bannerWidth = bannerText.length;

  // 计算填充
  const totalPadding = BOX_WIDTH - bannerWidth;
  const leftPaddingCount = Math.floor(totalPadding / 2);
  const rightPaddingCount = totalPadding - leftPaddingCount;

  // 生成填充字符串
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
    .configureHelp({
      // 确保帮助信息中包含 epilog 的内容
      // commander 默认将 epilog 作为 description 的一部分或在 help 底部
      // 在 Node.js 中通常通过 .usage() 或直接在 .option() 中提供详细描述
    })
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
    "Workspace directory (default: current directory )"
  );

  program.parse(process.argv);
  const options = program.opts();

  return {
    workspace: options["workspace"] as string | undefined,
  };
}

function main(): void {
  const args = parseArgs();

  print_banner();

  let workspaceDir: string;

  if (args.workspace) {
    workspaceDir = path.resolve(args.workspace);
  } else {
    workspaceDir = process.cwd();
  }

  try {
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    console.log(`\n$Workspace initialized at: ${workspaceDir}`);
  } catch (error) {
    console.error(`❌ Error creating workspace directory: ${error}`);
    // 捕获到错误时，应该退出进程
    process.exit(1);
  }
}

main();
