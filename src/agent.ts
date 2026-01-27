import * as path from "node:path";
import * as fs from "node:fs";
import { Logger } from "./util/logger.js";
import { Colors, drawStepHeader } from "./util/terminal.js";
import { LLMClient } from "./llm-client/llm-client.js";
import type { Message, ToolCall } from "./schema/index.js";
import type { Tool, ToolResult } from "./tools/index.js";

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

export class Agent {
  public llmClient: LLMClient;
  public systemPrompt: string;
  public maxSteps: number;
  public messages: Message[];
  public workspaceDir: string;
  public tools: Map<string, Tool>; // Agent stores all tools in a Map

  constructor(
    llmClient: LLMClient,
    systemPrompt: string,
    tools: Tool[],
    maxSteps: number,
    workspaceDir: string,
  ) {
    this.llmClient = llmClient;
    this.maxSteps = maxSteps;
    this.tools = new Map();

    // Ensure workspace exists
    this.workspaceDir = path.resolve(workspaceDir);
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    // Inject workspace dir into system prompt
    this.systemPrompt = buildSystemPrompt(systemPrompt, workspaceDir);
    this.messages = [{ role: "system", content: this.systemPrompt }];

    // Register tools with the agent
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  addUserMessage(content: string): void {
    Logger.log("CHAT", "User:", content);
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

  async executeTool(
    name: string,
    params: Record<string, unknown>,
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
      // Step Header
      console.log();
      console.log(drawStepHeader(step + 1, this.maxSteps));

      let fullContent = "";
      let fullThinking = "";
      let toolCalls: ToolCall[] | null = null;
      let isThinkingPrinted = false;

      const toolList = this.listTools();
      for await (const chunk of this.llmClient.generateStream(
        this.messages,
        toolList,
      )) {
        if (chunk.thinking) {
          if (!isThinkingPrinted) {
            console.log();
            console.log(`${Colors.DIM}─${"─".repeat(60)}${Colors.RESET}`);
            console.log();
            console.log(
              `${Colors.BOLD}${Colors.BRIGHT_MAGENTA}🧠 Thinking:${Colors.RESET}`,
            );
            isThinkingPrinted = true;
          }
          process.stdout.write(chunk.thinking);
          fullThinking += chunk.thinking;
        }

        if (chunk.content) {
          if (isThinkingPrinted && fullContent === "") {
            console.log();
            console.log();
            console.log(`${Colors.DIM}─${"─".repeat(60)}${Colors.RESET}`);
            console.log();
            console.log(
              `${Colors.BOLD}${Colors.BRIGHT_BLUE}📝 Response:${Colors.RESET}`,
            );
          } else if (!isThinkingPrinted && fullContent === "") {
            // 只有 Response，无 Thinking：1 个空行 + Response 标题
            console.log();
            console.log(
              `${Colors.BOLD}${Colors.BRIGHT_BLUE}📝 Response:${Colors.RESET}`,
            );
          }
          process.stdout.write(chunk.content);
          fullContent += chunk.content;
        }

        if (chunk.tool_calls) {
          toolCalls = chunk.tool_calls;
        }
      }

      if (!toolCalls || toolCalls.length === 0) {
        console.log();
      }

      this.messages.push({
        role: "assistant",
        content: fullContent,
        thinking: fullThinking || undefined,
        tool_calls: toolCalls || undefined,
      });

      if (!toolCalls || toolCalls.length === 0) {
        return fullContent;
      }

      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id;
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments || {};

        // Tool 标题
        console.log(
          `\n${Colors.BOLD}${Colors.BRIGHT_YELLOW}🔧 Tool: ${functionName}${Colors.RESET}`,
        );

        // Arguments
        console.log(`${Colors.DIM}   Arguments:${Colors.RESET}`);
        const truncatedArgs: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(args)) {
          const valueStr = String(value);
          if (valueStr.length > 200) {
            truncatedArgs[key] = valueStr.slice(0, 200) + "...";
          } else {
            truncatedArgs[key] = value;
          }
        }
        const argsJson = JSON.stringify(truncatedArgs, null, 2);
        for (const line of argsJson.split("\n")) {
          console.log(`   ${Colors.DIM}${line}${Colors.RESET}`);
        }

        const result = await this.executeTool(functionName, args);

        if (result.success) {
          let resultText = result.content;
          const MAX_LENGTH = 300;
          if (resultText.length > MAX_LENGTH) {
            resultText =
              resultText.slice(0, MAX_LENGTH) +
              `${Colors.DIM}...${Colors.RESET}`;
          }
          console.log(
            `${Colors.BRIGHT_GREEN}✓${Colors.RESET} ${Colors.BOLD}${Colors.BRIGHT_GREEN}Success:${Colors.RESET} ${resultText}\n`,
          );
        } else {
          console.log(
            `${Colors.BRIGHT_RED}✗${Colors.RESET} ${Colors.BOLD}${Colors.BRIGHT_RED}Error:${Colors.RESET} ${Colors.RED}${result.error ?? "Unknown error"}${Colors.RESET}\n`,
          );
        }

        this.messages.push({
          role: "tool",
          content: result.success
            ? result.content
            : `Error: ${result.error ?? "Unknown error"}`,
          tool_call_id: toolCallId,
          tool_name: functionName,
        });
      }
    }

    return `Task couldn't be completed after ${this.maxSteps} steps.`;
  }
}
