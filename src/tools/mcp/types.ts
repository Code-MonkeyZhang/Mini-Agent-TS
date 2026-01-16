import { type JsonSchema } from "../base.js";

export type ConnectionType = "stdio" | "sse" | "http" | "streamable_http";

export interface MCPTimeoutConfig {
  connectTimeout: number;
  executeTimeout: number;
  sseReadTimeout: number;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
  input_schema?: JsonSchema;
}

export interface McpListToolsResult {
  tools: McpToolDefinition[];
}

export interface McpCallToolResult {
  content?: unknown;
  isError?: boolean;
  is_error?: boolean;
}

export type McpClient = {
  connect: (transport: unknown) => Promise<void>;
  listTools: () => Promise<McpListToolsResult>;
  callTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<McpCallToolResult>;
  close?: () => Promise<void>;
};

export type Closable = {
  close?: () => Promise<void> | void;
};

export type ClientConstructor = new (options: {
  name: string;
  version: string;
}) => McpClient;

export type TransportConstructor = new (options: Record<string, unknown>) => Closable;

export interface McpServerConfig {
  description?: string;
  type?: ConnectionType;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
  connect_timeout?: number;
  execute_timeout?: number;
  sse_read_timeout?: number;
}

export interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>;
}
