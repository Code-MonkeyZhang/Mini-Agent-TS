import OpenAI from "openai";
import type {
  Message,
  LLMResponse,
  TokenUsage,
  FunctionCall,
  ToolCall,
} from "../schema/index.js";
import { LLMClientBase } from "./base.js";

/**
 * LLM client using OpenAI's protocol.
 *
 * This client uses the official OpenAI SDK and supports:
 * - Reasoning content (via reasoning_split=True)
 * - Tool calling
 */
export class OpenAIClient extends LLMClientBase {
  protected override convertMessages(
    messages: Message[]
  ): [string | null, Record<string, any>[]] {
    throw new Error("Method not implemented.");
  }
  private client: OpenAI;
  constructor(
    apiKey: string,
    apiBase: string = "https://api.minimaxi.com/v1",
    model: string = "MiniMax-M2"
  ) {
    super(apiKey, apiBase, model);
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiBase,
    });
  }

  /**
   * Execute API request.
   *
   * @param apiMessages List of messages in OpenAI format
   * @param tools Optional list of tools
   * @returns OpenAI ChatCompletion response
   */
  private async makeApiRequest(
    apiMessages: Record<string, any>[],
    tools?: any[] | null
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model: this.model,
        messages:
          apiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      };

    // Enable reasoning_split to separate thinking content (for MiniMax)
    (params as any).reasoning_split = true;

    const response = await this.client.chat.completions.create(params);
    return response;
  }

  /**
   * Prepare the request for OpenAI API.
   *
   /**
    * Prepare the request for OpenAI API.
    *
    * @param messages Array of Message objects
    * @returns Dictionary containing request parameters
    */
  public override prepareRequest(messages: Message[]): Record<string, any> {
    return {
      model: this.model,
      messages: messages,
    };
  }

  private parseResponse(
    response: OpenAI.Chat.Completions.ChatCompletion
  ): LLMResponse {
    const message = response.choices[0].message;
    // Extract text content
    const textContent = message.content || "";

    // Extract thinking content from reasoning_details
    let thinkingContent: string | null = null;
    const msgAny = message as any;
    if (msgAny.reasoning_details && Array.isArray(msgAny.reasoning_details)) {
      thinkingContent = msgAny.reasoning_details
        .map((detail: any) => detail.text || "")
        .join("");
    }

    // Extract tool calls (if any)
    let toolCalls: ToolCall[] | null = null;
    if (message.tool_calls && message.tool_calls.length > 0) {
      toolCalls = (message.tool_calls as any[])
        .filter((tc) => tc.type === "function" && tc.function)
        .map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          } as FunctionCall,
        }));
    }

    // Extract token usage
    let usage: TokenUsage | null = null;
    if (response.usage) {
      usage = {
        prompt_tokens: response.usage.prompt_tokens || 0,
        completion_tokens: response.usage.completion_tokens || 0,
        total_tokens: response.usage.total_tokens || 0,
      };
    }

    return {
      content: textContent,
      thinking: thinkingContent,
      tool_calls: toolCalls,
      finish_reason: response.choices[0].finish_reason || "stop",
      usage: usage,
    };
  }

  public override async generate(
    messages: Message[],
    tool?: any[] | null
  ): Promise<LLMResponse> {
    let requestParams = this.prepareRequest(messages);

    let response = await this.makeApiRequest(
      requestParams["apiMessages"],
      requestParams["tools"]
    );

    return this.parseResponse(response);
  }
}
