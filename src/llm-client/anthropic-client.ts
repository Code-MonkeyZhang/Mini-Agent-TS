import Anthropic from "@anthropic-ai/sdk";
import type { Message, LLMStreamChunk, ToolCall } from "../schema/schema.js";
import type { Tool } from "../tools/index.js";

import { LLMClientBase } from "./llm-client-base.js";
import type { RetryConfig } from "../config.js";
import { Logger, sdkLoggerAdapter } from "../util/logger.js";

/**
 * LLM client using Anthropic's protocol.
 *
 * This client uses the official Anthropic SDK and supports:
 * - Extended thinking content
 * - Tool calling
 * - Streaming responses
 */
export class AnthropicClient extends LLMClientBase {
  private client: Anthropic;

  constructor(
    apiKey: string,
    apiBase: string,
    model: string,
    retryConfig: RetryConfig
  ) {
    super(apiKey, apiBase, model, retryConfig);
    this.client = new Anthropic({
      apiKey: apiKey,
      baseURL: apiBase,
      maxRetries: retryConfig.enabled ? retryConfig.maxRetries : 0,
      logger: sdkLoggerAdapter,
    });
  }

  /**
   * Converts internal message format to Anthropic's message format.
   *
   * @param messages - Array of internal Message objects
   * @returns A tuple containing [systemPrompt, apiMessages]
   */
  protected override convertMessages(
    messages: Message[]
  ): [string | null, Anthropic.MessageParam[]] {
    let systemPrompt: string | null = null;
    const apiMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
        continue;
      }

      if (msg.role === "user") {
        // User messages can be string or content blocks
        if (typeof msg.content === "string") {
          apiMessages.push({
            role: "user",
            content: msg.content,
          });
        } else {
          // Content blocks (e.g., for images)
          apiMessages.push({
            role: "user",
            content: msg.content as Anthropic.ContentBlockParam[],
          });
        }
      } else if (msg.role === "assistant") {
        // Build content blocks for assistant message
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        // Add thinking block if present
        if (msg.thinking) {
          contentBlocks.push({
            type: "thinking",
            thinking: msg.thinking,
            // Anthropic requires a signature field for thinking blocks
            signature: "",
          } as Anthropic.ThinkingBlockParam);
        }

        // Add text content if present
        if (msg.content) {
          contentBlocks.push({
            type: "text",
            text: msg.content,
          });
        }

        // Add tool use blocks if present
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const toolCall of msg.tool_calls) {
            contentBlocks.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.function.name,
              input: toolCall.function.arguments || {},
            });
          }
        }

        // Only add message if there's content (Anthropic doesn't like empty messages)
        if (contentBlocks.length > 0) {
          apiMessages.push({
            role: "assistant",
            content: contentBlocks,
          });
        }
      } else if (msg.role === "tool") {
        // Anthropic requires tool results in a user message with tool_result blocks
        const toolResultBlock: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        };

        // Check if the last message is a user message with content blocks
        // If so, merge the tool result into it (to avoid User->User sequence)
        const lastMsg = apiMessages[apiMessages.length - 1];
        if (lastMsg && lastMsg.role === "user" && Array.isArray(lastMsg.content)) {
          (lastMsg.content as Anthropic.ContentBlockParam[]).push(toolResultBlock);
        } else {
          apiMessages.push({
            role: "user",
            content: [toolResultBlock],
          });
        }
      }
    }

    return [systemPrompt, apiMessages];
  }

  /**
   * Converts internal Tool format to Anthropic's schema format.
   *
   * Anthropic tool format:
   * {
   *   "name": "tool_name",
   *   "description": "Tool description",
   *   "input_schema": { "type": "object", "properties": {...}, "required": [...] }
   * }
   *
   * @param tools - List of internal Tool objects
   * @returns List of tools in Anthropic format
   */
  private convertTools(tools: Tool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  /**
   * Prepares the request parameters for Anthropic API.
   *
   * @param messages - Array of Message objects
   * @param tools - Optional list of available tools
   * @returns Dictionary containing request parameters
   */
  public override prepareRequest(
    messages: Message[],
    tools?: Tool[] | null
  ): Record<string, unknown> {
    const [systemPrompt, apiMessages] = this.convertMessages(messages);
    const convertedTools =
      tools && tools.length > 0 ? this.convertTools(tools) : undefined;

    return {
      system: systemPrompt,
      messages: apiMessages,
      tools: convertedTools,
    };
  }

  /**
     The core function for API communication. It performs three key tasks:
  
     1. Packages parameters and initiates the call to the Anthropic API.
     2. Processes incoming streaming chunks and yields them immediately 
        to the UI for a zero-latency response.
     3. Puts JSON fragments together and stores in array.
  
     @param messages - The conversation history.
     @param tools - Available tools for the LLM.
     @returns An async generator yielding content, thoughts, or tool calls.
     */

  public override async *generateStream(
    messages: Message[],
    tools?: Tool[] | null
  ): AsyncGenerator<LLMStreamChunk> {

    // ============================================================
    // STAGE 1: Package parameters and initiate API request
    // ============================================================
    const requestParams = this.prepareRequest(messages, tools);

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 16384,
      messages: requestParams["messages"] as Anthropic.MessageParam[],
    };

    if (requestParams["system"]) {
      params.system = requestParams["system"] as string;
    }

    if (requestParams["tools"]) {
      params.tools = requestParams["tools"] as Anthropic.Tool[];
    }

    Logger.logLLMRequest(params);
    const stream = this.client.messages.stream(params);

    // Track accumulated data for logging and final dispatch
    let fullContent = "";
    let fullThinking = "";
    let chunkCount = 0;
    let finishReason: string | undefined;
    const accumulatedToolCalls: ToolCall[] = [];

    // Temporary buffer to assemble tool JSON strings
    let currentToolCall: {
      id: string;
      name: string;
      inputJSON: string;
    } | null = null;

    // ============================================================
    // STAGE 2: Receive Streaming chunks and yield 
    // ============================================================
    for await (const event of stream) {
      chunkCount++;

      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullContent += text;
        yield { content: text, done: false };
      }

      else if (
        event.type === "content_block_delta" &&
        (event.delta as any).type === "thinking_delta"
      ) {
        const thinking = (event.delta as any).thinking;
        if (thinking) {
          fullThinking += thinking;
          yield { thinking: thinking, done: false };
        }
      }

      // ============================================================
      // STAGE 3: Concatenate Tool JSON and package upon completion
      // ============================================================

      // Detect a tool use block and initialize the buffer
      else if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use"
      ) {
        currentToolCall = {
          id: event.content_block.id,
          name: event.content_block.name,
          inputJSON: "",
        };
      }

      // Append JSON fragments as they arrive from the stream
      else if (
        event.type === "content_block_delta" &&
        event.delta.type === "input_json_delta"
      ) {
        if (currentToolCall) {
          currentToolCall.inputJSON += event.delta.partial_json;
        }
      }

      // Finalize instruction, parse JSON, and store in array
      else if (event.type === "content_block_stop") {
        if (currentToolCall) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(currentToolCall.inputJSON || "{}");
          } catch {
            Logger.log("LLM", "Failed to parse tool arguments JSON", currentToolCall.inputJSON);
          }

          const toolCall: ToolCall = {
            id: currentToolCall.id,
            type: "function",
            function: {
              name: currentToolCall.name,
              arguments: parsedArgs,
            },
          };
          accumulatedToolCalls.push(toolCall);
          currentToolCall = null; // Reset buffer for the next potential tool
        }
      }

      // Capture metadata updates
      else if (event.type === "message_delta") {
        if (event.delta.stop_reason) {
          finishReason = event.delta.stop_reason;
        }
      }

      // Dispatch all accumulated tool calls in the final chunk
      else if (event.type === "message_stop") {
        yield {
          content: undefined,
          thinking: undefined,
          tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
          done: true,
          finish_reason: finishReason || "end_turn",
        };
      }
    }

    // Logging the full response
    Logger.logLLMResponse({
      accumulatedContent: fullContent,
      accumulatedThinking: fullThinking,
      tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : null,
      finishReason: finishReason,
      chunkCount: chunkCount,
    });
  }
}
