import {
  LLMProvider,
  type LLMStreamChunk,
  type Message,
} from "../schema/schema.js";
import { LLMClientBase } from "./base.js";
import { OpenAIClient } from "./openai_client.js";
// If you have an AnthropicClient implementation:
// import { AnthropicClient } from "./anthropic_client.js";
import { RetryConfig } from "../config.js";

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
    retryConfig: RetryConfig,
    retryCallback?: (error: unknown, attempt: number) => void
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
    this.retryConfig = retryConfig;

    let fullApiBase: string = "";

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        //TODO implement ANTHROPIC provider
        throw new Error(`Unsupported provider: ${provider}`);

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

    if (retryCallback) {
      this._client.retryCallback = retryCallback;
    }
  }

  /**
   * Set retry callback.
   */
  set retryCallback(value: (error: unknown, attempt: number) => void) {
    this._client.retryCallback = value;
  }

  async *generateStream(
    messages: Message[],
    tools?: any[] | null
  ): AsyncGenerator<LLMStreamChunk> {
    yield* this._client.generateStream(messages, tools);
  }
}
