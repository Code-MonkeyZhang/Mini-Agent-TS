// ============ Enums ============

export enum LLMProvider {
  ANTHROPIC = "anthropic",
  OPENAI = "openai",
}

// ============ Function Calling ============

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: string; // "function"
  function: FunctionCall;
}

// ============ Messages ============

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[]; // Either a plain string or an array of content blocks
  thinking?: string | null; // Extra reasoning/thinking content for assistant messages
  tool_calls?: ToolCall[] | null;
  tool_call_id?: string | null;
  name?: string | null; // Used for tool role messages
}

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

// ============ Token Usage ============

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============ LLM Response ============

export interface LLMResponse {
  content: string;
  thinking?: string | null; // Optional thinking content
  tool_calls?: ToolCall[] | null;
  finish_reason: string;
  usage?: TokenUsage | null;
}

// ============ Streaming ============

export interface LLMStreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  finish_reason?: string;
  usage?: TokenUsage;
  done: boolean;
}
