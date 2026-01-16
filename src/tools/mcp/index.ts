import * as fs from "node:fs";
import * as path from "node:path";
import { Logger } from "../../util/logger.js";
import { type Tool } from "../base.js";
import {
  type McpConfigFile,
  type McpServerConfig,
  type ConnectionType,
} from "./types.js";
import { isRecord } from "./utils.js";
import { MCPServerConnection } from "./connection.js";

// Re-export everything for external use
export * from "./types.js";
export * from "./utils.js";
export * from "./connection.js";

const mcpConnections: MCPServerConnection[] = [];

/**
 * Asynchronously loads MCPs from config file.
 *
 * This function reads the specified JSON configuration file to find defined MCP servers.
 * It attempts to connect to each enabled server (via stdio, SSE, or HTTP) and retrieves
 * the list of available tools. Successfully loaded tools from all connected servers
 * will be aggregated and returned.
 *
 * @param configPath - path to MCP config JSON file. Defaults to "mcp.json".
 * @returns A promise that resolves to an array of loaded `Tool` instances.
 */
export async function loadMcpToolsAsync(
  configPath: string = "mcp.json"
): Promise<Tool[]> {
  const resolvedPath = path.resolve(configPath);
  if (!fs.existsSync(resolvedPath)) {
    console.log(`MCP config not found: ${resolvedPath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(resolvedPath, "utf8");
    const config = JSON.parse(raw) as McpConfigFile;
    const servers = config.mcpServers ?? {};

    if (!isRecord(servers) || Object.keys(servers).length === 0) {
      console.log("No MCP servers configured");
      return [];
    }

    const allTools: Tool[] = [];

    for (const [serverName, serverConfigValue] of Object.entries(servers)) {
      if (!isRecord(serverConfigValue)) {
        console.log(`Skipping invalid server config: ${serverName}`);
        continue;
      }

      const serverConfig = serverConfigValue as McpServerConfig;
      if (serverConfig.disabled) {
        console.log(`Skipping disabled server: ${serverName}`);
        continue;
      }

      // Determine connection type
      let connectionType: ConnectionType = "stdio";
      const explicitType = serverConfig.type?.toLowerCase();

      switch (explicitType) {
        case "stdio":
        case "sse":
        case "http":
        case "streamable_http":
          connectionType = explicitType;
          break;
        default:
          if (serverConfig.url) {
            connectionType = "streamable_http";
          }
          break;
      }

      const connection = new MCPServerConnection({
        name: serverName,
        connectionType,
        command: serverConfig.command,
        args: serverConfig.args,
        cwd: serverConfig.cwd,
        env: serverConfig.env,
        url: serverConfig.url,
        headers: serverConfig.headers,
        connectTimeoutSec: serverConfig.connect_timeout,
        executeTimeoutSec: serverConfig.execute_timeout,
        sseReadTimeoutSec: serverConfig.sse_read_timeout,
      });

      const success = await connection.connect();
      if (success) {
        mcpConnections.push(connection);
        allTools.push(...connection.tools);
      }
    }

    const totalMsg = `
Total MCP tools loaded: ${allTools.length}`;
    Logger.log("MCP", totalMsg.trim());
    return allTools;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const msg = `Error loading MCP config: ${message}`;
    console.log(msg);
    Logger.debug("MCP", msg);
    return [];
  }
}

export async function cleanupMcpConnections(): Promise<void> {
  for (const connection of mcpConnections) {
    await connection.disconnect();
  }
  mcpConnections.length = 0;
}
