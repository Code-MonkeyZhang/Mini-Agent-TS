import { LLMClient } from "./llm/llm_wrapper.js";

export class Agent {
  public llmClient: LLMClient;
  public systemPrompt: string;
  public maxSteps: number;
  constructor(llmClient: LLMClient, systemPrompt: string, maxSteps: number) {
    this.llmClient = llmClient;
    this.systemPrompt = systemPrompt;
    this.maxSteps = maxSteps;
  }
}
