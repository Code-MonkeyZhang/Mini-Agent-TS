import {
  LLMProvider,
  type LLMStreamChunk,
  type Message,
} from "../schema/schema.js";
import { LLMClientBase } from "./base.js";
import { OpenAIClient } from "./openai_client.js";
import { RetryConfig } from "../config.js";

/**
 * Provider-agnostic wrapper that delegates to a concrete `LLMClientBase`.
 *
 * @remarks
 * Today, both `anthropic` and `openai` providers use `OpenAIClient` because the
 * upstream endpoints speak an OpenAI-compatible protocol.
 */
export class LLMClient {
  public apiKey: string;
  public apiBase: string;
  public provider: string;
  public model: string;
  public retryConfig: RetryConfig;

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
        // Treat `api_base` as a fully-qualified base URL (do not auto-append suffixes).
        fullApiBase = apiBase.replace(/\/+$/, "");
        this._client = new OpenAIClient(
          apiKey,
          fullApiBase,
          model,
          retryConfig
        );
        break;

      case LLMProvider.OPENAI:
        // Treat `api_base` as a fully-qualified base URL (do not auto-append suffixes).
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
