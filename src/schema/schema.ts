// ============ 枚举 ============

export enum LLMProvider {
  ANTHROPIC = "anthropic",
  OPENAI = "openai",
}

// ============ 函数调用 ============

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: string; // "function"
  function: FunctionCall;
}

// ============ 消息 ============

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[]; // 可以是字符串或内容块数组
  thinking?: string | null; // assistant 消息的扩展思考内容
  tool_calls?: ToolCall[] | null;
  tool_call_id?: string | null;
  name?: string | null; // 用于 tool 角色
}

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

// ============ Token 使用统计 ============

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============ LLM 响应 ============

export interface LLMResponse {
  content: string;
  thinking?: string | null; // 扩展思考块
  tool_calls?: ToolCall[] | null;
  finish_reason: string;
  usage?: TokenUsage | null;
}

// ============ 流式响应 ============

export interface LLMStreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  finish_reason?: string;
  usage?: TokenUsage;
  done: boolean;
}
