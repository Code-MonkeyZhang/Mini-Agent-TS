import {
  LLMProvider,
  type LLMStreamChunk,
  type Message,
} from "../schema/schema.js";
import type { Tool } from "../tools/index.js";
import { LLMClientBase } from "./llm-client-base.js";
import { OpenAIClient } from "./openai-client.js";
import { AnthropicClient } from "./anthropic-client.js";

import type { RetryConfig } from "../config.js";

export class LLMClient {
  public apiKey: string;
  public apiBase: string;
  public provider: string;
  public model: string;
  public retryConfig: RetryConfig;

  // Internal client instance; kept private for encapsulation.
  private _client: LLMClientBase;

  constructor(
    apiKey: string,
    apiBase: string,
    provider: string,
    model: string,
    retryConfig: RetryConfig
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
    this.retryConfig = retryConfig;

    let fullApiBase: string = "";

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        fullApiBase = apiBase.replace(/\/+$/, "");
        this._client = new AnthropicClient(
          apiKey,
          fullApiBase,
          model,
          retryConfig
        );
        break;

      case LLMProvider.OPENAI:
        fullApiBase = apiBase.replace(/\/+$/, "");
        this._client = new OpenAIClient(
          apiKey,
          fullApiBase,
          model,
          retryConfig
        );
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    this.apiBase = fullApiBase;
  }

  async *generateStream(
    messages: Message[],
    tools?: Tool[] | null
  ): AsyncGenerator<LLMStreamChunk> {
    yield* this._client.generateStream(messages, tools);
  }

  async checkConnection(): Promise<boolean> {
    try {
      const msgs: Message[] = [{ role: "user", content: "ping" }];
      const generator = this._client.generateStream(msgs, null);
      await generator.next();
      return true;
    } catch (error) {
      return false;
    }
  }
}
