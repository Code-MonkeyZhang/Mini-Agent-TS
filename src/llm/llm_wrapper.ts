import {
  LLMProvider,
  type LLMResponse,
  type LLMStreamChunk,
  type Message,
} from "../schema/schema.js";
import { LLMClientBase } from "./base.js";
import { OpenAIClient } from "./openai_client.js";
// 假设你有 AnthropicClient
// import { AnthropicClient } from "./anthropic_client.js";

export class LLMClient {
  public apiKey: string;
  public apiBase: string;
  public provider: string;
  public model: string;
  public llmClient: LLMClientBase;

  constructor(
    apiKey: string,
    apiBase: string,
    provider: string,
    model: string
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;

    let fullApiBase: string = "";

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        fullApiBase = `${apiBase.replace(/\/+$/, "")}/anthropic`;
        this.llmClient = new OpenAIClient(apiKey, fullApiBase, model);
        break;

      case LLMProvider.OPENAI:
        fullApiBase = `${apiBase.replace(/\/+$/, "")}/v1`;
        this.llmClient = new OpenAIClient(apiKey, fullApiBase, model);
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    this.apiBase = fullApiBase;
  }

  async generate(
    messages: Message[],
    tools?: any[] | null
  ): Promise<LLMResponse> {
    return await this.llmClient.generate(messages, tools);
  }

  async *generateStream(
    messages: Message[],
    tools?: any[] | null
  ): AsyncGenerator<LLMStreamChunk> {
    yield* this.llmClient.generateStream(messages, tools);
  }
}
