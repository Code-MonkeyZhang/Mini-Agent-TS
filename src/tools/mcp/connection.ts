import { Logger } from "../../util/logger.js";
import {
  type Tool,
  type ToolInput,
  type ToolResult,
  type JsonSchema,
} from "../base.js";
import { type Closable, type ConnectionType, type McpClient } from "./types.js";
import {
  getMcpTimeoutConfig,
  loadClientConstructor,
  loadSseTransportConstructor,
  loadStdioTransportConstructor,
  loadStreamableHttpTransportConstructor,
  normalizeContent,
  normalizeToolDescription,
  normalizeToolSchema,
  toSecondsLabel,
  withTimeout,
} from "./utils.js";

export class MCPTool implements Tool {
  public name: string;
  public description: string;
  public parameters: JsonSchema;

  private session: McpClient;
  private executeTimeoutSec: number;

  constructor(options: {
    name: string;
    description: string;
    parameters: JsonSchema;
    session: McpClient;
    executeTimeoutSec: number;
  }) {
    this.name = options.name;
    this.description = options.description;
    this.parameters = options.parameters;
    this.session = options.session;
    this.executeTimeoutSec = options.executeTimeoutSec;
  }

  async execute(params: ToolInput): Promise<ToolResult> {
    const timeoutMs = this.executeTimeoutSec * 1000;

    // [Debug] Log Request
    Logger.debug("MCP DEBUG", `Calling '${this.name}' with args:`, params);

    try {
      const result = await withTimeout(
        this.session.callTool({
          name: this.name,
          arguments: params,
        }),
        timeoutMs,
        `MCP tool execution timed out after ${toSecondsLabel(
          this.executeTimeoutSec
        )}. The remote server may be slow or unresponsive.`
      );

      // [Debug] Log Response
      Logger.debug("MCP DEBUG", `Result from '${this.name}':`, result);

      const content = normalizeContent(result.content);
      const isError = Boolean(result.isError ?? result.is_error ?? false);

      return {
        success: !isError,
        content,
        error: isError ? "Tool returned error" : null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const timedOut = message.includes("timed out");
      return {
        success: false,
        content: "",
        error: timedOut ? message : `MCP tool execution failed: ${message}`,
      };
    }
  }
}

export class MCPServerConnection {
  public name: string;
  public connectionType: ConnectionType;
  public command?: string;
  public args: string[];
  public cwd?: string;
  public env: Record<string, string>;
  public url?: string;
  public headers: Record<string, string>;
  public connectTimeoutSec?: number;
  public executeTimeoutSec?: number;
  public sseReadTimeoutSec?: number;

  public tools: MCPTool[] = [];

  private session: McpClient | null = null;
  private transport: Closable | null = null;

  constructor(options: {
    name: string;
    connectionType: ConnectionType;
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    connectTimeoutSec?: number;
    executeTimeoutSec?: number;
    sseReadTimeoutSec?: number;
  }) {
    this.name = options.name;
    this.connectionType = options.connectionType;
    this.command = options.command;
    this.args = options.args ?? [];
    this.cwd = options.cwd;
    this.env = options.env ?? {};
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.connectTimeoutSec = options.connectTimeoutSec;
    this.executeTimeoutSec = options.executeTimeoutSec;
    this.sseReadTimeoutSec = options.sseReadTimeoutSec;
  }

  private getConnectTimeoutSec(): number {
    return this.connectTimeoutSec ?? getMcpTimeoutConfig().connectTimeout;
  }

  private getExecuteTimeoutSec(): number {
    return this.executeTimeoutSec ?? getMcpTimeoutConfig().executeTimeout;
  }

  private getSseReadTimeoutSec(): number {
    return this.sseReadTimeoutSec ?? getMcpTimeoutConfig().sseReadTimeout;
  }

  private async createTransport(): Promise<Closable> {
    if (this.connectionType === "stdio") {
      if (!this.command) {
        throw new Error("Missing command for stdio transport");
      }
      const transportCtor = await loadStdioTransportConstructor();
      return new transportCtor({
        command: this.command,
        args: this.args,
        cwd: this.cwd,
        env: Object.keys(this.env).length > 0 ? this.env : undefined,
      });
    }

    if (!this.url) {
      throw new Error("Missing url for remote transport");
    }

    if (this.connectionType === "sse") {
      const sseCtor = await loadSseTransportConstructor();
      return new sseCtor({
        url: this.url,
        headers:
          Object.keys(this.headers).length > 0 ? this.headers : undefined,
        sseReadTimeout: this.getSseReadTimeoutSec() * 1000,
      });
    }

    const httpCtor = await loadStreamableHttpTransportConstructor();
    return new httpCtor({
      url: this.url,
      headers: Object.keys(this.headers).length > 0 ? this.headers : undefined,
    });
  }

  async connect(): Promise<boolean> {
    const connectTimeoutMs = this.getConnectTimeoutSec() * 1000;
    try {
      const transport = await this.createTransport();
      const ClientCtor = await loadClientConstructor();
      const client = new ClientCtor({
        name: "mini-agent-ts",
        version: "0.0.1",
      }) as unknown as McpClient;

      Logger.debug(
        "MCP DEBUG",
        `🔌 Connecting to MCP server '${this.name}'...`
      );

      const toolsList = await withTimeout(
        (async () => {
          await client.connect(transport);
          return await client.listTools();
        })(),
        connectTimeoutMs,
        `Connection to MCP server '${
          this.name
        }' timed out after ${toSecondsLabel(this.getConnectTimeoutSec())}.`
      );

      Logger.debug(
        "MCP DEBUG",
        `🔌 Connected to '${this.name}', discovered tools:`,
        toolsList
      );

      this.session = client;
      this.transport = transport;

      const executeTimeout = this.getExecuteTimeoutSec();
      for (const tool of toolsList.tools ?? []) {
        const rawParameters = tool.inputSchema ?? tool.input_schema ?? {};
        const normalizedParameters = normalizeToolSchema(rawParameters);
        const normalizedDescription = normalizeToolDescription(
          tool.description ?? ""
        );

        this.tools.push(
          new MCPTool({
            name: tool.name,
            description: normalizedDescription,
            parameters: normalizedParameters,
            session: client,
            executeTimeoutSec: executeTimeout,
          })
        );
      }

      const connectedMsg = `✅ Connected to MCP server '${this.name}' (${this.connectionType}) - loaded ${this.tools.length} tools`;
      console.log(connectedMsg);
      Logger.log("MCP", connectedMsg);

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const msg = `✗ Failed to connect to MCP server '${this.name}': ${message}`;
      console.log(msg);
      Logger.debug("MCP", msg);
      await this.disconnect();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    const session = this.session;
    const transport = this.transport;
    this.session = null;
    this.transport = null;

    if (session?.close) {
      await session.close();
    }
    if (transport?.close) {
      await transport.close();
    }
  }
}
