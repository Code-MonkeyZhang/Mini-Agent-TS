import * as path from "node:path";
import * as fs from "node:fs";
import { Logger } from "./util/logger.js";
import { LLMClient } from "./llm/llm_wrapper.js";
import type { Message, ToolCall } from "./schema/index.js";
import type { Tool, ToolResult } from "./tools/index.js";

// ============ Constants ============

const SEPARATOR_WIDTH = 60;

// ============ Helpers ============

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

// ============ Agent ============

export class Agent {
  public llmClient: LLMClient;
  public systemPrompt: string;
  public maxSteps: number;
  public messages: Message[];
  public tokenLimit: number;
  public workspaceDir: string;
  public tools: Map<string, Tool>; // Agent stores all tools in a Map

  constructor(
    llmClient: LLMClient,
    systemPrompt: string,
    tools: Tool[] = [],
    maxSteps: number = 50,
    workspaceDir: string = "./workspace",
    tokenLimit: number = 8000
  ) {
    this.llmClient = llmClient;
    this.maxSteps = maxSteps;
    this.tokenLimit = tokenLimit;
    this.tools = new Map();

    // Ensure workspace exists
    this.workspaceDir = path.resolve(workspaceDir);
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    // Inject workspace dir into system prompt
    this.systemPrompt = buildSystemPrompt(systemPrompt, workspaceDir);
    this.messages = [{ role: "system", content: this.systemPrompt }];

    // TODO: Add structured logging (levels, timestamps, optional file output).
    // TODO: Track token usage and enforce tokenLimit via summarization/truncation.

    // Register tools with the agent
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  addUserMessage(content: string): void {
    Logger.log("CHAT", "👤 User:", content);
    this.messages.push({ role: "user", content });
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  clearHistoryKeepSystem(): number {
    const removed = this.messages.length - 1;
    this.messages = [this.messages[0]];
    return removed;
  }

  async executeTool(
    name: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      return {
        success: false,
        content: "",
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      const err = error as Error;
      const details = err?.message ? err.message : String(error);
      const stack = err?.stack ? `\n\nStack:\n${err.stack}` : "";
      return {
        success: false,
        content: "",
        error: `Tool execution failed: ${details}${stack}`,
      };
    }
  }

  async run(): Promise<string> {
    for (let step = 0; step < this.maxSteps; step++) {
      // TODO: Summarize older messages when approaching tokenLimit.
      console.log();
      console.log("🤖 Assistant:");

      // Stream thinking first, then main content. Print a separator when switching.
      let fullContent = "";
      let fullThinking = "";
      let toolCalls: ToolCall[] | null = null;
      let isThinkingPrinted = false;

      const toolList = this.listTools();
      for await (const chunk of this.llmClient.generateStream(
        this.messages,
        toolList
      )) {
        if (chunk.thinking) {
          if (!isThinkingPrinted) {
            console.log("💭 Thinking:");
            console.log("─".repeat(SEPARATOR_WIDTH));
            isThinkingPrinted = true;
          }
          process.stdout.write(chunk.thinking);
          fullThinking += chunk.thinking;
        }

        if (chunk.content) {
          if (isThinkingPrinted && fullContent === "") {
            console.log();
            console.log("─".repeat(SEPARATOR_WIDTH));
            console.log();
          }
          process.stdout.write(chunk.content);
          fullContent += chunk.content;
        }

        if (chunk.tool_calls) {
          toolCalls = chunk.tool_calls;
        }
      }

      console.log();

      // [Debug] Log Assistant Response
      Logger.log("CHAT", "🤖 Assistant:", {
        content: fullContent,
        thinking: fullThinking || null,
        tool_calls: toolCalls
      });

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

      // Iterate & Execute tool calls
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id;
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments || {};

        console.log(`\n🔧 使用工具: ${functionName}`);

        const result = await this.executeTool(functionName, args);

        if (result.success) {
          console.log(`✅ Tool use success`);
        } else {
          console.log(`✗ Error: ${result.error ?? "Unknown error"}`);
        }

        // add Tool execute result to message queue
        this.messages.push({
          role: "tool",
          content: result.success
            ? result.content
            : `Error: ${result.error ?? "Unknown error"}`,
          tool_call_id: toolCallId,
          name: functionName,
        });
      }
    }

    return `Task couldn't be completed after ${this.maxSteps} steps.`;
  }
}
