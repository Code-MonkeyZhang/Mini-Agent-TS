import { describe, it, expect } from "vitest";
import type { Tool, ToolResult } from "../src/tools/base";
import { toAnthropicSchema, toOpenAISchema } from "../src/tools/base";

class MockWeatherTool implements Tool<{ location: string }> {
  name = "get_weather";
  description = "Get weather by city name";
  parameters = {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
      unit: { type: "string", enum: ["c", "f"], description: "Unit" },
    },
    required: ["location"],
  };

  async execute(_params: { location: string }): Promise<ToolResult> {
    return { success: true, content: "Weather data" };
  }
}

class MockSearchTool implements Tool<{ query: string }> {
  name = "search";
  description = "Search for information";
  parameters = {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      filters: {
        type: "object",
        properties: {
          domain: { type: "string" },
          type: { type: "string", enum: ["news", "blog", "paper"] },
        },
      },
    },
    required: ["query"],
  };

  async execute(_params: { query: string }): Promise<ToolResult> {
    return { success: true, content: "Search results" };
  }
}

class MockEnumTool implements Tool<{ status: "open" | "closed" }> {
  name = "set_status";
  description = "Set a status";
  parameters = {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["open", "closed"],
        description: "Status value",
      },
    },
    required: ["status"],
  };

  async execute(_params: { status: "open" | "closed" }): Promise<ToolResult> {
    return { success: true, content: "Status set" };
  }
}

describe("Tool schema helpers", () => {
  it("should convert tool to Anthropic schema", () => {
    const tool = new MockWeatherTool();
    const schema = toAnthropicSchema(tool);

    expect(schema.name).toBe("get_weather");
    expect(schema.description).toBe(tool.description);
    expect(schema.input_schema).toEqual(tool.parameters);
  });

  it("should convert tool to OpenAI schema", () => {
    const tool = new MockWeatherTool();
    const schema = toOpenAISchema(tool);

    expect(schema.type).toBe("function");
    expect(schema.function.name).toBe("get_weather");
    expect(schema.function.description).toBe(tool.description);
    expect(schema.function.parameters).toEqual(tool.parameters);
  });

  it("should handle complex schemas", () => {
    const tool = new MockSearchTool();
    const schema = toAnthropicSchema(tool);
    const inputSchema = schema.input_schema as Record<string, unknown>;
    const properties = inputSchema["properties"] as Record<string, unknown>;
    expect(properties["filters"]).toBeDefined();
  });

  it("should allow multiple tools", () => {
    const tool1 = new MockWeatherTool();
    const tool2 = new MockSearchTool();
    const tools = [tool1, tool2];

    expect(tools.length).toBe(2);
    expect(tools[0].name).toBe("get_weather");
    expect(tools[1].name).toBe("search");

    const openaiSchemas = tools.map((t) => toOpenAISchema(t));
    expect(openaiSchemas[0].function.name).toBe("get_weather");
    expect(openaiSchemas[1].function.name).toBe("search");
  });

  it("should preserve enum parameters", () => {
    const tool = new MockEnumTool();
    const schema = toOpenAISchema(tool);
    const params = schema.function.parameters as Record<string, unknown>;
    const properties = params["properties"] as Record<string, unknown>;
    const status = properties["status"] as { enum?: string[] };
    expect(status.enum).toEqual(["open", "closed"]);
  });

  it("should execute tool", async () => {
    const tool = new MockWeatherTool();
    const result = await tool.execute({ location: "Tokyo" });
    expect(result.success).toBe(true);
    expect(result.content).toBe("Weather data");
  });
});
