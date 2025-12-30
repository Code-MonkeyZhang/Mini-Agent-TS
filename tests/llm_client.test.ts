import { describe, it, expect, beforeAll } from "vitest";
import { Config } from "../src/config";
import { LLMClient } from "../src/llm/llm_wrapper";
import type { Message } from "../src/schema/schema";

/**
 * LLM API Integration Test
 *
 * 这是一个集成测试，会实际调用 LLM API。
 * 确保在运行前已正确配置 config.yaml 中的 api_key。
 */
describe("LLM API Integration", () => {
  let llmClient: LLMClient;
  let configLoaded = false;

  beforeAll(() => {
    try {
      const config = Config.load();
      llmClient = new LLMClient(
        config.llm.apiKey,
        config.llm.apiBase,
        config.llm.provider,
        config.llm.model,
        config.llm.retry
      );
      configLoaded = true;
      console.log(
        `Testing with model: ${config.llm.model}, provider: ${config.llm.provider}`
      );
    } catch (error) {
      console.warn(
        "⚠️  Config not found or invalid. LLM integration tests will be skipped."
      );
      console.warn("   Please ensure config.yaml is properly set up.");
    }
  });

  it("should successfully connect and get a response from LLM API", async () => {
    // 如果配置未加载，跳过测试
    if (!configLoaded) {
      console.log("Skipping: Config not loaded");
      return;
    }

    const messages: Message[] = [
      {
        role: "system",
        content: "You are a helpful assistant. Reply concisely.",
      },
      { role: "user", content: 'Say "Hello, World!" and nothing else.' },
    ];

    const response = await llmClient.generate(messages);

    // 验证响应结构
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe("string");
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.finish_reason).toBeDefined();

    console.log(`✅ LLM Response: "${response.content.substring(0, 100)}..."`);
    console.log(`   Finish reason: ${response.finish_reason}`);
    if (response.usage) {
      console.log(`   Tokens used: ${response.usage.total_tokens}`);
    }
  }, 30000); // 设置 30 秒超时，因为 API 调用可能较慢

  it("should handle streaming response", async () => {
    if (!configLoaded) {
      console.log("Skipping: Config not loaded");
      return;
    }

    const messages: Message[] = [
      { role: "user", content: "Count from 1 to 3." },
    ];

    let fullContent = "";
    let chunkCount = 0;

    for await (const chunk of llmClient.generateStream(messages)) {
      if (chunk.content) {
        fullContent += chunk.content;
        chunkCount++;
      }
      if (chunk.done) {
        break;
      }
    }

    expect(fullContent.length).toBeGreaterThan(0);
    expect(chunkCount).toBeGreaterThan(0);

    console.log(`✅ Streaming Response: "${fullContent.substring(0, 100)}..."`);
    console.log(`   Received ${chunkCount} chunks`);
  }, 30000);

});
