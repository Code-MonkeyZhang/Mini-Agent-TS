/**
 * Configuration management module
 *
 * Provides unified configuration loading and management functionality
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "yaml";
import { fileURLToPath } from "node:url";

// ============ Configuration Types ============

/** Retry configuration defaults. */
export class RetryConfig {
  enabled: boolean = true;
  maxRetries: number = 3;
  initialDelay: number = 1.0;
  maxDelay: number = 60.0;
  exponentialBase: number = 2.0;

  constructor(data: Partial<RetryConfig> = {}) {
    // Manually check each field: if it's present (and not undefined), override the default.
    if (data.enabled !== undefined) this.enabled = data.enabled;
    if (data.maxRetries !== undefined) this.maxRetries = data.maxRetries;
    if (data.initialDelay !== undefined) this.initialDelay = data.initialDelay;
    if (data.maxDelay !== undefined) this.maxDelay = data.maxDelay;
    if (data.exponentialBase !== undefined)
      this.exponentialBase = data.exponentialBase;
  }
}

/** LLM configuration. */
export class LLMConfig {
  apiKey: string;
  apiBase: string = "https://api.minimax.io";
  model: string = "MiniMax-M2";
  provider: "anthropic" | "openai" = "anthropic";
  retry: RetryConfig = new RetryConfig();

  constructor(data: { apiKey: string } & Partial<Omit<LLMConfig, "apiKey">>) {
    this.apiKey = data.apiKey;
    if (data.apiBase !== undefined) this.apiBase = data.apiBase;
    if (data.model !== undefined) this.model = data.model;
    if (data.provider !== undefined) this.provider = data.provider;
    if (data.retry !== undefined) this.retry = data.retry;
  }
}

/** Agent configuration. */
export class AgentConfig {
  maxSteps: number = 50;
  systemPromptPath: string = "system_prompt.md";

  constructor(data: Partial<AgentConfig> = {}) {
    if (data.maxSteps !== undefined) this.maxSteps = data.maxSteps;
    if (data.systemPromptPath !== undefined)
      this.systemPromptPath = data.systemPromptPath;
  }
}

/** MCP (Model Context Protocol) timeout configuration. */
export class MCPConfig {
  connectTimeout: number = 10.0;
  executeTimeout: number = 60.0;
  sseReadTimeout: number = 120.0;

  constructor(data: Partial<MCPConfig> = {}) {
    if (data.connectTimeout !== undefined)
      this.connectTimeout = data.connectTimeout;
    if (data.executeTimeout !== undefined)
      this.executeTimeout = data.executeTimeout;
    if (data.sseReadTimeout !== undefined)
      this.sseReadTimeout = data.sseReadTimeout;
  }
}

/** Tools configuration. */
export class ToolsConfig {
  enableFileTools: boolean = true;
  enableBash: boolean = true;
  enableNote: boolean = true;
  enableSkills: boolean = true;
  skillsDir: string = "./skills";
  enableMcp: boolean = true;
  mcpConfigPath: string = "mcp.json";
  mcp: MCPConfig = new MCPConfig();

  constructor(data: Partial<ToolsConfig> = {}) {
    if (data.enableFileTools !== undefined)
      this.enableFileTools = data.enableFileTools;
    if (data.enableBash !== undefined) this.enableBash = data.enableBash;
    if (data.enableNote !== undefined) this.enableNote = data.enableNote;
    if (data.enableSkills !== undefined) this.enableSkills = data.enableSkills;
    if (data.skillsDir !== undefined) this.skillsDir = data.skillsDir;
    if (data.enableMcp !== undefined) this.enableMcp = data.enableMcp;
    if (data.mcpConfigPath !== undefined)
      this.mcpConfigPath = data.mcpConfigPath;
    if (data.mcp !== undefined) this.mcp = data.mcp;
  }
}

/** Main configuration class. */
export class Config {
  llm: LLMConfig;
  agent: AgentConfig;
  tools: ToolsConfig;

  constructor(llm: LLMConfig, agent: AgentConfig, tools: ToolsConfig) {
    this.llm = llm;
    this.agent = agent;
    this.tools = tools;
  }

  /**
   * Load configuration from the default search path.
   */
  static load(): Config {
    const configPath = Config.getDefaultConfigPath();
    if (!fs.existsSync(configPath)) {
      throw new Error(
        "Configuration file not found. Run scripts/setup-config.sh or place config.yaml in mini_agent/config/."
      );
    }
    return Config.fromYaml(configPath);
  }

  /**
   * Load configuration from YAML file
   *
   * @param configPath Configuration file path
   * @returns Config instance
   * @throws Error if configuration file does not exist or is invalid
   */
  static fromYaml(configPath: string): Config {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file does not exist: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, "utf8");
    const data = yaml.parse(content) as Record<string, unknown>;

    if (!data) {
      throw new Error("Configuration file is empty");
    }

    // Parse LLM configuration
    if (!data["api_key"]) {
      throw new Error("Configuration file missing required field: api_key");
    }

    if (!data["api_key"] || data["api_key"] === "YOUR_API_KEY_HERE") {
      throw new Error("Please configure a valid API Key");
    }

    // Parse retry configuration
    const retryData = (data["retry"] as Record<string, unknown>) || {};
    const retryConfig = new RetryConfig({
      enabled: retryData["enabled"] as boolean | undefined,
      maxRetries: retryData["max_retries"] as number | undefined,
      initialDelay: retryData["initial_delay"] as number | undefined,
      maxDelay: retryData["max_delay"] as number | undefined,
      exponentialBase: retryData["exponential_base"] as number | undefined,
    });

    const llmConfig = new LLMConfig({
      apiKey: data["api_key"] as string,
      apiBase: data["api_base"] as string | undefined,
      model: data["model"] as string | undefined,
      provider: data["provider"] as "anthropic" | "openai" | undefined,
      retry: retryConfig,
    });

    // Parse Agent configuration
    const agentConfig = new AgentConfig({
      maxSteps: data["max_steps"] as number | undefined,
      systemPromptPath: data["system_prompt_path"] as string | undefined,
    });

    // Parse tools configuration
    const toolsData = (data["tools"] as Record<string, unknown>) || {};
    const mcpData = (toolsData["mcp"] as Record<string, unknown>) || {};
    const mcpConfig = new MCPConfig({
      connectTimeout: mcpData["connect_timeout"] as number | undefined,
      executeTimeout: mcpData["execute_timeout"] as number | undefined,
      sseReadTimeout: mcpData["sse_read_timeout"] as number | undefined,
    });

    const toolsConfig = new ToolsConfig({
      enableFileTools: toolsData["enable_file_tools"] as boolean | undefined,
      enableBash: toolsData["enable_bash"] as boolean | undefined,
      enableNote: toolsData["enable_note"] as boolean | undefined,
      enableSkills: toolsData["enable_skills"] as boolean | undefined,
      skillsDir: toolsData["skills_dir"] as string | undefined,
      enableMcp: toolsData["enable_mcp"] as boolean | undefined,
      mcpConfigPath: toolsData["mcp_config_path"] as string | undefined,
      mcp: mcpConfig,
    });

    return new Config(llmConfig, agentConfig, toolsConfig);
  }

  /**
   * Get the package installation directory
   *
   * @returns Path to the mini_agent package directory
   */
  static getPackageDir(): string {
    // Get the directory where this config.ts file is located
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..");
  }

  /**
   * Find configuration file with priority order
   *
   * Search for config file in the following order of priority:
   * 1) ./config/{filename} in current directory (development mode)
   * 2) ~/.mini-agent-ts/config/{filename} in user home directory
   * 3) {package}/config/{filename} in package installation directory
   *
   * @param filename Configuration file name (e.g., "config.yaml", "mcp.json", "system_prompt.md")
   * @returns Path to found config file, or null if not found
   */
  static findConfigFile(filename: string): string | null {
    // Priority 1: Development mode - current directory's config/ subdirectory
    const devConfig = path.join(process.cwd(), "config", filename);
    if (fs.existsSync(devConfig)) {
      return devConfig;
    }

    // Priority 2: User config directory
    const homeDir = process.env["HOME"] || process.env["USERPROFILE"] || "";
    const userConfig = path.join(homeDir, ".mini-agent-ts", "config", filename);
    if (fs.existsSync(userConfig)) {
      return userConfig;
    }

    // Priority 3: Package installation directory's config/ subdirectory
    const packageConfig = path.join(Config.getPackageDir(), "config", filename);
    if (fs.existsSync(packageConfig)) {
      return packageConfig;
    }

    return null;
  }

  /**
   * Get the default config file path with priority search
   *
   * @returns Path to config.yaml (prioritizes: dev config/ > user config/ > package config/)
   */
  static getDefaultConfigPath(): string {
    const configPath = Config.findConfigFile("config.yaml");
    if (configPath) {
      return configPath;
    }
    // Fallback to package config directory for error message purposes
    return path.join(Config.getPackageDir(), "config", "config.yaml");
  }
}
