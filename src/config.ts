/**
 * Configuration management module
 *
 * Provides unified configuration loading and management functionality using Zod for validation and type safety.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "yaml";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// ============ Defaults ============

const DEFAULTS = {
  RETRY: {
    enabled: true,
    maxRetries: 3,
  },
  LLM: {
    apiBase: "https://api.minimax.io",
    model: "MiniMax-M2",
    provider: "anthropic" as const,
  },
  AGENT: {
    maxSteps: 50,
    systemPromptPath: "system_prompt.md",
  },
  LOGGING: {
    enableLogging: false,
  },
  MCP: {
    connectTimeout: 10.0,
    executeTimeout: 60.0,
    sseReadTimeout: 120.0,
  },
  TOOLS: {
    skillsDir: "./skills",
    mcpConfigPath: "mcp.json",
  },
};

// ============ Schemas ============

const RetrySchema = z.object({
  enabled: z.boolean().default(DEFAULTS.RETRY.enabled),
  maxRetries: z.number().default(DEFAULTS.RETRY.maxRetries),
});

const MCPSchema = z.object({
  connectTimeout: z.number().default(DEFAULTS.MCP.connectTimeout),
  executeTimeout: z.number().default(DEFAULTS.MCP.executeTimeout),
  sseReadTimeout: z.number().default(DEFAULTS.MCP.sseReadTimeout),
});

const ToolsSchema = z.object({
  skillsDir: z.string().default(DEFAULTS.TOOLS.skillsDir),
  mcpConfigPath: z.string().default(DEFAULTS.TOOLS.mcpConfigPath),
  mcp: MCPSchema,
});

const ConfigSchema = z
  .object({
    apiKey: z.string().min(1, "Please configure a valid API Key"),
    apiBase: z.string().default(DEFAULTS.LLM.apiBase),
    model: z.string().default(DEFAULTS.LLM.model),
    provider: z.enum(["anthropic", "openai"]).default(DEFAULTS.LLM.provider),

    enableLogging: z.boolean().default(DEFAULTS.LOGGING.enableLogging),

    retry: RetrySchema,

    maxSteps: z.number().default(DEFAULTS.AGENT.maxSteps),
    systemPromptPath: z.string().default(DEFAULTS.AGENT.systemPromptPath),

    tools: ToolsSchema,
  })
  .transform((data) => ({
    llm: {
      apiKey: data.apiKey,
      apiBase: data.apiBase,
      model: data.model,
      provider: data.provider,
      retry: data.retry,
    },
    logging: {
      enableLogging: data.enableLogging,
    },
    agent: {
      maxSteps: data.maxSteps,
      systemPromptPath: data.systemPromptPath,
    },
    tools: data.tools,
  }));

// ============ Types ============

export type RetryConfig = z.infer<typeof RetrySchema>; // 创建一个名为 RetryConfig 的类型，它包含了 RetrySchema 中定义的所有字段
export type LoggingConfig = z.infer<typeof ConfigSchema>["logging"];
export type ToolsConfig = z.infer<typeof ToolsSchema>;
export type LLMConfig = z.infer<typeof ConfigSchema>["llm"];
export type AgentConfig = z.infer<typeof ConfigSchema>["agent"];

// ============ Config Class ============

export class Config {
  llm: LLMConfig;
  logging: LoggingConfig;
  agent: AgentConfig;
  tools: ToolsConfig;

  constructor(data: z.infer<typeof ConfigSchema>) {
    this.llm = data.llm;
    this.logging = data.logging;
    this.agent = data.agent;
    this.tools = data.tools;
  }

  static createDefaultRetryConfig(): RetryConfig {
    return RetrySchema.parse({});
  }

  /**
   * Load and parse config from YAML file.
   *
   * @param configPath - The absolute path to the YAML configuration file
   * @returns A validated Config instance
   * @throws Error if file doesn't exist, is empty, or has invalid schema
   */
  static fromYaml(configPath: string): Config {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file does not exist: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, "utf8");
    if (!content || !content.trim()) {
      throw new Error("Configuration file is empty");
    }

    const rawData = yaml.parse(content);
    const parsedData = ConfigSchema.parse(rawData);

    return new Config(parsedData);
  }

  /**
   * priority search for config file .
   *
   * Search order:
   * 1. Current working directory: `./config/{filename}`
   * 2. User home directory: `~/.mini-agent-ts/config/{filename}`
   * 3. Package directory: `{package_root}/config/{filename}`
   *
   * @param filename - The name of the file to find (e.g., "config.yaml")
   * @returns The absolute path to the file if found, otherwise null
   */
  static findConfigFile(filename: string): string | null {
    const devConfig = path.join(process.cwd(), "config", filename);
    if (fs.existsSync(devConfig)) {
      return devConfig;
    }

    const homeDir = process.env["HOME"] || process.env["USERPROFILE"] || "";
    const userConfig = path.join(homeDir, ".mini-agent-ts", "config", filename);
    if (fs.existsSync(userConfig)) {
      return userConfig;
    }

    const packageRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const packageConfig = path.join(packageRoot, "config", filename);
    if (fs.existsSync(packageConfig)) {
      return packageConfig;
    }

    return null;
  }
}
