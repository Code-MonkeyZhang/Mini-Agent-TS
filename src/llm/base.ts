import type { Message, LLMResponse, LLMStreamChunk } from "../schema/index.js";
import { RetryConfig } from "../config.js";

export abstract class LLMClientBase {
  public apiKey: string;
  public apiBase: string;
  public model: string;
  public retryConfig: RetryConfig;
  public retryCallback: ((error: unknown, attempt: number) => void) | null;

  /**
   * Initialize the LLM client.
   *
   * @param apiKey API key for authentication
   * @param apiBase Base URL for the API
   * @param model Model name to use
   * @param retryConfig Optional retry configuration
   */
  constructor(
    apiKey: string,
    apiBase: string,
    model: string,
    retryConfig?: RetryConfig
  ) {
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.model = model;
    this.retryConfig = retryConfig ?? new RetryConfig();
    this.retryCallback = null;
  }

  /**
   * Generate response from LLM.
   *
   * @param messages List of conversation messages
   * @param tools Optional list of tool objects
   * @returns Promise resolving to LLMResponse
   */
  public abstract generate(
    messages: Message[],
    tools?: unknown[] | null
  ): Promise<LLMResponse>;

  /**
   * Generate streaming response from LLM.
   *
   * @param messages List of conversation messages
   * @param tools Optional list of tool objects
   * @returns AsyncGenerator yielding LLMStreamChunk
   */
  public abstract generateStream(
    messages: Message[],
    tools?: unknown[] | null
  ): AsyncGenerator<LLMStreamChunk>;

  /**
   * Prepare the request payload for the API.
   *
   * @param messages List of conversation messages
   * @param tools Optional list of available tools
   * @returns Dictionary containing the request payload
   */
  public abstract prepareRequest(
    messages: Message[],
    tools?: unknown[] | null
  ): Record<string, any>;

  /**
   * Convert internal message format to API-specific format.
   *
   * @param messages List of internal Message objects
   * @returns Tuple of [system_message, api_messages]
   */
  protected abstract convertMessages(
    messages: Message[]
  ): [string | null, Record<string, any>[]];
}
