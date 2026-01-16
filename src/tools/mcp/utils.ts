import { type JsonSchema } from "../base.js";
import {
  type ClientConstructor,
  type TransportConstructor,
  type MCPTimeoutConfig,
} from "./types.js";

const DEFAULT_TIMEOUTS: MCPTimeoutConfig = {
  connectTimeout: 10.0,
  executeTimeout: 60.0,
  sseReadTimeout: 120.0,
};

let globalTimeoutConfig: MCPTimeoutConfig = { ...DEFAULT_TIMEOUTS };

export function setMcpTimeoutConfig(
  overrides: Partial<MCPTimeoutConfig>
): void {
  globalTimeoutConfig = {
    connectTimeout:
      overrides.connectTimeout ?? globalTimeoutConfig.connectTimeout,
    executeTimeout:
      overrides.executeTimeout ?? globalTimeoutConfig.executeTimeout,
    sseReadTimeout:
      overrides.sseReadTimeout ?? globalTimeoutConfig.sseReadTimeout,
  };
}

export function getMcpTimeoutConfig(): MCPTimeoutConfig {
  return { ...globalTimeoutConfig };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

export async function loadNamedExport(
  modulePaths: string[],
  exportNames: string[]
): Promise<unknown> {
  let lastError: unknown = null;
  for (const modulePath of modulePaths) {
    try {
      const mod = (await import(modulePath)) as Record<string, unknown>;
      for (const exportName of exportNames) {
        if (exportName in mod && isFunction(mod[exportName])) {
          return mod[exportName];
        }
      }
    } catch (error: unknown) {
      lastError = error;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Failed to load MCP SDK export (${exportNames.join(", ")}): ${message}`
  );
}

export async function loadClientConstructor(): Promise<ClientConstructor> {
  const ctor = await loadNamedExport(
    [
      "@modelcontextprotocol/sdk/client/index.js",
      "@modelcontextprotocol/sdk/client/index.mjs",
      "@modelcontextprotocol/sdk/client",
    ],
    ["Client"]
  );
  return ctor as ClientConstructor;
}

export async function loadStdioTransportConstructor(): Promise<TransportConstructor> {
  const ctor = await loadNamedExport(
    [
      "@modelcontextprotocol/sdk/client/stdio.js",
      "@modelcontextprotocol/sdk/client/stdio.mjs",
      "@modelcontextprotocol/sdk/client/stdio",
    ],
    ["StdioClientTransport"]
  );
  return ctor as TransportConstructor;
}

export async function loadSseTransportConstructor(): Promise<TransportConstructor> {
  const ctor = await loadNamedExport(
    [
      "@modelcontextprotocol/sdk/client/sse.js",
      "@modelcontextprotocol/sdk/client/sse.mjs",
      "@modelcontextprotocol/sdk/client/sse",
    ],
    ["SSEClientTransport"]
  );
  return ctor as TransportConstructor;
}

export async function loadStreamableHttpTransportConstructor(): Promise<TransportConstructor> {
  const ctor = await loadNamedExport(
    [
      "@modelcontextprotocol/sdk/client/streamableHttp.js",
      "@modelcontextprotocol/sdk/client/streamable_http.js",
      "@modelcontextprotocol/sdk/client/streamableHttp.mjs",
      "@modelcontextprotocol/sdk/client/streamable_http.mjs",
      "@modelcontextprotocol/sdk/client/streamableHttp",
      "@modelcontextprotocol/sdk/client/streamable_http",
    ],
    ["StreamableHTTPClientTransport", "StreamableHttpClientTransport"]
  );
  return ctor as TransportConstructor;
}

export function toSecondsLabel(seconds: number): string {
  return Number.isFinite(seconds) ? `${seconds}s` : "unknown";
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function normalizeContent(content: unknown): string {
  if (content === undefined || content === null) {
    return "";
  }
  const items = Array.isArray(content) ? content : [content];
  const parts: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    if (isRecord(item) && typeof item["text"] === "string") {
      parts.push(item["text"] as string);
      continue;
    }
    try {
      parts.push(JSON.stringify(item));
    } catch {
      parts.push(String(item));
    }
  }
  return parts.join("\n");
}

export function normalizeToolSchema(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }

  const normalized: JsonSchema = {
    type: (schema["type"] as string) || "object",
  };

  // Process properties
  if (schema["properties"] && isRecord(schema["properties"])) {
    const normalizedProps: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema["properties"])) {
      if (!isRecord(value)) continue;

      const prop = value;
      const normalizedProp: Record<string, unknown> = {};

      // Handle anyOf - extract the first non-null type
      if (prop["anyOf"] && Array.isArray(prop["anyOf"])) {
        const nonNullType = prop["anyOf"].find(
          (t: unknown) =>
            isRecord(t) && (t as Record<string, unknown>)["type"] !== "null"
        );
        if (nonNullType && isRecord(nonNullType)) {
          const typeObj = nonNullType as Record<string, unknown>;
          normalizedProp["type"] = typeObj["type"];
          // Copy items for array types
          if (typeObj["items"]) {
            normalizedProp["items"] = typeObj["items"];
          }
        }
      } else if (prop["type"]) {
        normalizedProp["type"] = prop["type"];
        if (prop["items"]) {
          normalizedProp["items"] = prop["items"];
        }
      }

      // Use description if available, otherwise convert title to description
      if (prop["description"]) {
        normalizedProp["description"] = prop["description"];
      } else if (prop["title"] && typeof prop["title"] === "string") {
        // Convert snake_case/camelCase title to readable description
        normalizedProp["description"] = (prop["title"] as string)
          .replace(/_/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .toLowerCase();
      }

      // Copy default value if present
      if (prop["default"] !== undefined) {
        normalizedProp["default"] = prop["default"];
      }

      // Copy enum if present
      if (prop["enum"]) {
        normalizedProp["enum"] = prop["enum"];
      }

      normalizedProps[key] = normalizedProp;
    }

    normalized["properties"] = normalizedProps;
  }

  // Copy required array
  if (schema["required"] && Array.isArray(schema["required"])) {
    normalized["required"] = schema["required"];
  }

  return normalized;
}

export function normalizeToolDescription(description: string): string {
  if (!description) return "";

  return description
    .replace(/\n\s+/g, "\n") // Remove leading whitespace from lines
    .replace(/^\s+|\s+$/g, "") // Trim start and end
    .replace(/\n{3,}/g, "\n\n"); // Collapse multiple newlines
}
