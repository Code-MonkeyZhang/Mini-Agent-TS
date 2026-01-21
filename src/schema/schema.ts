// ============ Enums ============

export enum LLMProvider {
  ANTHROPIC = "anthropic",
  OPENAI = "openai",
}

// ============ Function Calling ============

interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: string; // "function"
  function: FunctionCall;
}

// ============ Messages ============

export type Message =
  | {
      role: "system";
      content: string;
    }
  | {
      role: "user";
      content: string | ContentBlock[];
    }
  | {
      role: "assistant";
      content?: string;
      thinking?: string;
      tool_calls?: ToolCall[];
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name?: string;
    };

interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface LLMStreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  finish_reason?: string;
  done: boolean;
}
