import { describe, it, expect } from "vitest";
import { Config } from "../src/config.js";
import { LLMClient } from "../src/llm/llm_wrapper.js";
import type { Message } from "../src/schema/schema.js";

/**
 * LLM API Integration Test
 *
 * This is an integration test that will make real calls to the LLM API.
 * Before running, ensure `Mini-Agent-TS/config/config.yaml` is configured correctly
 * (when running from `Mini-Agent-TS/`, the path is `./config/config.yaml`) and that
 * your environment allows network access.
 */
describe("LLM API Integration (stream)", () => {
  it("should stream a response from the configured LLM API", async () => {
    let config: Config;
    try {
      config = Config.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        [
          "LLM integration test is enabled, but config could not be loaded.",
          message,
          "Expected: ./config/config.yaml (api_key + provider + model).",
        ].join("\n")
      );
    }

    const llmClient = new LLMClient(
      config.llm.apiKey,
      config.llm.apiBase,
      config.llm.provider,
      config.llm.model,
      config.llm.retry
    );

    const messages: Message[] = [
      { role: "user", content: "Reply with exactly: pong" },
    ];

    let fullContent = "";
    let sawDone = false;
    let chunks = 0;

    for await (const chunk of llmClient.generateStream(messages)) {
      if (chunk.content) fullContent += chunk.content;
      if (chunk.done) {
        sawDone = true;
        break;
      }
      chunks++;
      if (chunks > 200) break;
    }

    expect(sawDone).toBe(true);
    expect(fullContent.trim().length).toBeGreaterThan(0);
    expect(fullContent).toMatch(/pong/i);
  }, 30000);
});
