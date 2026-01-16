import OpenAI from "openai";
import type { Message, LLMStreamChunk, ToolCall } from "../schema/index.js";
import type { Tool } from "../tools/index.js";
import { toOpenAISchema } from "../tools/index.js";
import { LLMClientBase } from "./base.js";
import { RetryConfig } from "../config.js";
import { asyncRetry } from "../retry.js";
import { Logger } from "../util/logger.js";

/**
 * LLM client using OpenAI's protocol.
 *
 * This client uses the official OpenAI SDK and supports:
 * - Provider-specific reasoning/thinking fields (mapped into `LLMStreamChunk.thinking` when present)
 * - Tool calling
 */
export class OpenAIClient extends LLMClientBase {
  private client: OpenAI;
  constructor(
    apiKey: string,
    apiBase: string = "https://api.minimaxi.com/v1",
    model: string = "MiniMax-M2",
    retryConfig: RetryConfig
  ) {
    super(apiKey, apiBase, model, retryConfig);
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiBase,
    });
  }

  protected override convertMessages(
    messages: Message[]
  ): [string | null, Record<string, any>[]] {
    let apiMessages = [];

    for (const msg of messages) {
      // `msg` is a single message object
      if (msg.role === "system") {
        apiMessages.push({ role: "system", content: msg.content });
        continue;
      } else if (msg.role === "user") {
        apiMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        const assistantMsg: Record<string, unknown> = {
          role: "assistant",
        };

        if (msg.content) {
          assistantMsg["content"] = msg.content;
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          assistantMsg["tool_calls"] = msg.tool_calls.map((toolCall) => ({
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function.name,
              arguments: JSON.stringify(toolCall.function.arguments ?? {}),
            },
          }));
        }

        if (msg.thinking) {
          assistantMsg["reasoning_details"] = [{ text: msg.thinking }];
        }

        apiMessages.push(assistantMsg);
      } else if (msg.role === "tool") {
        const toolMsg: Record<string, unknown> = {
          role: "tool",
          content: msg.content,
        };

        if (msg.tool_call_id) {
          toolMsg["tool_call_id"] = msg.tool_call_id;
        }
        if (msg.name) {
          toolMsg["name"] = msg.name;
        }
        apiMessages.push(toolMsg);
      }
    }

    return [null, apiMessages];
  }

  /**
   * Converts various tool formats to OpenAI's schema.
   *
   * @param tools List of tools in mixed formats
   * @returns List of tools formatted for OpenAI API
   * @throws {TypeError} If a tool format is unrecognized
   */
  private convertTools(tools: unknown[]): Record<string, any>[] {
    const converted: Record<string, any>[] = [];

    for (const tool of tools) {
      if (tool && typeof tool === "object") {
        const toolObj = tool as Record<string, any>;

        const toolType = toolObj["type"];
        if (toolType === "function" && toolObj["function"]) {
          converted.push(toolObj);
          continue;
        }

        if (
          toolObj["input_schema"] &&
          toolObj["name"] &&
          toolObj["description"]
        ) {
          converted.push({
            type: "function",
            function: {
              name: toolObj["name"],
              description: toolObj["description"],
              parameters: toolObj["input_schema"],
            },
          });
          continue;
        }

        if (
          toolObj["name"] &&
          toolObj["description"] &&
          toolObj["parameters"]
        ) {
          converted.push(toOpenAISchema(toolObj as Tool));
          continue;
        }
      }

      throw new TypeError(`Unsupported tool type: ${typeof tool}`);
    }

    return converted;
  }

  /**
   * Prepare the request for OpenAI API.
   *
   * @param messages Array of Message objects
   * @param tools Optional list of available tools
   * @returns Dictionary containing request parameters
   */
  public override prepareRequest(
    messages: Message[],
    tools?: unknown[] | null
  ): Record<string, any> {
    const [, apiMessages] = this.convertMessages(messages);
    return {
      apiMessages,
      tools: tools ?? null,
    };
  }

  public override async *generateStream(
    messages: Message[],
    tools?: any[] | null
  ): AsyncGenerator<LLMStreamChunk> {
    const requestParams = this.prepareRequest(messages, tools);
    const apiMessages = requestParams[
      "apiMessages"
    ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    const toolSchemas =
      requestParams["tools"] && requestParams["tools"].length > 0
        ? this.convertTools(requestParams["tools"])
        : undefined;

    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    // Build request params
    const buildParams =
      (): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming => {
        const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
          {
            model: this.model,
            messages: apiMessages,
            stream: true,
          };
        if (toolSchemas && toolSchemas.length > 0) {
          (params as any).tools = toolSchemas;
          (params as any).tool_choice = "auto";
        }
        return params;
      };

    // Use retry depending on `enabled`
    if (this.retryConfig.enabled) {
      stream = await asyncRetry(
        async () => {
          const params = buildParams();
          Logger.debug(
            "LLM DEBUG",
            `➡️ Sending Streaming Request to ${this.model}:`,
            {
              messagesCount: params.messages.length,
              toolsCount: (params as any).tools?.length ?? 0,
              lastMessage: params.messages[params.messages.length - 1],
            }
          );
          return await this.client.chat.completions.create(params);
        },
        this.retryConfig,
        this.retryCallback
      );
    } else {
      const params = buildParams();
      Logger.debug(
        "LLM DEBUG",
        `➡️ Sending Streaming Request to ${this.model}:`,
        {
          messagesCount: params.messages.length,
          toolsCount: (params as any).tools?.length ?? 0,
          lastMessage: params.messages[params.messages.length - 1],
        }
      );
      stream = await this.client.chat.completions.create(params);
    }

    // Accumulate tool_calls from streaming chunks (like Python does)
    const toolCallAcc = new Map<
      number,
      {
        id: string;
        type: string;
        name: string;
        argumentsText: string;
      }
    >();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      // Accumulate tool_calls from delta
      if (delta && (delta as any).tool_calls) {
        const incoming = (delta as any).tool_calls as any[];
        for (const call of incoming) {
          const index = typeof call.index === "number" ? call.index : 0;

          if (!toolCallAcc.has(index)) {
            toolCallAcc.set(index, {
              id: "",
              type: "function",
              name: "",
              argumentsText: "",
            });
          }

          const existing = toolCallAcc.get(index)!;
          if (call.id) existing.id = call.id;
          if (call.type) existing.type = call.type;
          if (call.function?.name) existing.name += call.function.name;
          if (call.function?.arguments) {
            existing.argumentsText += call.function.arguments;
          }
        }
      }

      // Build final tool_calls when stream is done
      let toolCalls: ToolCall[] | undefined;
      if (finishReason && toolCallAcc.size > 0) {
        toolCalls = Array.from(toolCallAcc.values()).map((call) => {
          let parsedArgs: Record<string, unknown> = {};
          if (call.argumentsText) {
            try {
              parsedArgs = JSON.parse(call.argumentsText);
            } catch {
              parsedArgs = {};
            }
          }
          return {
            id: call.id || "",
            type: call.type || "function",
            function: {
              name: call.name || "",
              arguments: parsedArgs,
            },
          };
        });
        Logger.debug(
          "LLM DEBUG",
          `⬅️ Received Tool Calls (Streaming):`,
          toolCalls
        );
      }

      yield {
        content: delta?.content || undefined,
        thinking: (delta as any)?.reasoning_content || undefined,
        tool_calls: toolCalls,
        done: finishReason !== null && finishReason !== undefined,
        finish_reason: finishReason || undefined,
      };
    }
  }
}
