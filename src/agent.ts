import * as path from "node:path";
import * as fs from "node:fs";
import { LLMClient } from "./llm/llm_wrapper.js";
import type { Message, ToolCall } from "./schema/index.js";

// ============ 常量 ============

const SEPARATOR_WIDTH = 60;

// ============ 辅助函数 ============

function buildSystemPrompt(basePrompt: string, workspaceDir: string): string {
  if (basePrompt.includes("Current Workspace")) {
    return basePrompt;
  }
  return (
    basePrompt +
    `

## Current Workspace
You are currently working in: \`${workspaceDir}\`
All relative paths will be resolved relative to this directory.`
  );
}

// ============ Agent 类 ============

export class Agent {
  public llmClient: LLMClient;
  public systemPrompt: string;
  public maxSteps: number;
  public messages: Message[];
  public tokenLimit: number;
  public workspaceDir: string;

  constructor(
    llmClient: LLMClient,
    systemPrompt: string,
    maxSteps: number = 50,
    workspaceDir: string = "./workspace",
    tokenLimit: number = 8000
  ) {
    this.llmClient = llmClient;
    this.maxSteps = maxSteps;
    this.tokenLimit = tokenLimit;

    // Ensure workspace exists
    this.workspaceDir = path.resolve(workspaceDir);
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    // 将 workspace dir 注入 system prompt
    this.systemPrompt = buildSystemPrompt(systemPrompt, workspaceDir);
    this.messages = [{ role: "system", content: this.systemPrompt }];

    // TODO: 初始化 Logger
    // TODO: 启动 TOKEN 计算
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
  }

  clearHistoryKeepSystem(): number {
    const removed = this.messages.length - 1;
    this.messages = [this.messages[0]];
    return removed;
  }

  async run(): Promise<string> {
    for (let step = 0; step < this.maxSteps; step++) {
      // TODO: Check and summarize message history to prevent context overflow

      // 打印 header
      console.log();
      console.log("🤖 Assistant:");

      // 流式输出
      let fullContent = "";
      let fullThinking = "";
      let toolCalls: ToolCall[] | null = null;
      let isThinkingPrinted = false;

      for await (const chunk of this.llmClient.generateStream(this.messages)) {
        // 打印思考内容
        if (chunk.thinking) {
          if (!isThinkingPrinted) {
            console.log("💭 Thinking:");
            console.log("─".repeat(SEPARATOR_WIDTH));
            isThinkingPrinted = true;
          }
          process.stdout.write(chunk.thinking);
          fullThinking += chunk.thinking;
        }

        // 打印主内容
        if (chunk.content) {
          if (isThinkingPrinted && fullContent === "") {
            // 思考结束，开始输出内容
            console.log();
            console.log("─".repeat(SEPARATOR_WIDTH));
            console.log();
          }
          process.stdout.write(chunk.content);
          fullContent += chunk.content;
        }

        // 收集 tool calls
        if (chunk.tool_calls) {
          toolCalls = chunk.tool_calls;
        }
      }

      // 换行
      console.log();

      // Add assistant message
      this.messages.push({
        role: "assistant",
        content: fullContent,
        thinking: fullThinking || null,
        tool_calls: toolCalls,
      });

      // Check if task is complete (no tool calls)
      if (!toolCalls || toolCalls.length === 0) {
        return fullContent;
      }

      // TODO: Execute tool calls
    }

    return `Task couldn't be completed after ${this.maxSteps} steps.`;
  }
}
