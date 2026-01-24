import type { Message, LLMStreamChunk } from "../schema/index.js";
import type { Tool } from "../tools/index.js";
import { Config, type RetryConfig } from "../config.js";

export abstract class LLMClientBase {
  public apiKey: string;
  public apiBase: string;
  public model: string;
  public retryConfig: RetryConfig;

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
    this.retryConfig = retryConfig ?? Config.createDefaultRetryConfig();
  }

  /**
   * Generate streaming response from LLM.
   *
   * @param messages List of conversation messages
   * @param tools Optional list of tool objects
   * @returns AsyncGenerator yielding LLMStreamChunk
   */
  public abstract generateStream(
    messages: Message[],
    tools?: Tool[] | null
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
    tools?: Tool[] | null
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
