# Bug Log

## 2026-01-20: Thinking 内容未在流式响应中捕获

### 问题描述 (Issue)
调用 OpenAI API 时，thinking（推理）内容一直为 null，没有显示出来。

### 排查过程 (Diagnosis Process)

1. **现象观察**：
   - 使用 Mini-Agent 提问 "What is 15 + 27?"
   - 日志显示 `thinking: null`，没有 thinking 内容

2. **Python 验证**：
   - 创建 `test_python_script/test_thinking.py` 测试脚本
   - 测试结果：API 响应确实包含 `reasoning` 字段
   - `reasoning_tokens` 也正确统计

3. **对比分析**：
   - 检查 `src/llm-client/openai-client.ts:303` 行
   - 代码检查的字段名是 `reasoning_content`
   - 但 OpenAI API 实际返回的字段名是 `reasoning`

### 根本原因 (Root Cause)
在 `src/llm-client/openai-client.ts:303` 行，代码检查的字段名错误。

**错误代码：**
```typescript
thinking: (delta as any)?.reasoning_content || undefined,
```

**正确字段：**
```typescript
thinking: (delta as any)?.reasoning || undefined,
```

### 解决方案 (Solution)
修改 `src/llm-client/openai-client.ts` 第 303 行：
```typescript
// 修改前
thinking: (delta as any)?.reasoning_content || undefined,

// 修改后
thinking: (delta as any)?.reasoning || undefined,
```

### 相关文档 (References)
要参考 OpenAI 的文档：https://platform.openai.com/docs/api-reference/chat

### 测试验证 (Testing)
- 创建了 `test_python_script/test_thinking.py` 测试脚本
- 验证 API 确实返回 `reasoning` 字段
- 修复后 thinking 内容正常显示

### 状态 (Status)
✅ 已修复

---

## 2026-01-13: Streaming Tool Calls Not Working

### 问题描述 (Issue)
在使用 Mini-Agent-TS 集成 MCP 工具（如 TickTick 滴答清单）时，发现 LLM 无法成功调用 MCP 工具。
- **现象**：
  - 用户请求："看看我的日程"。
  - LLM 回复："我来检查TickTick的连接状态..."，明确表示要使用工具。
  - **关键错误**：API 返回的 `tool_calls` 字段始终为 `null` 或空。
  - **对比**：内置工具（如 `read_file`）在同一会话中可以正常调用。
  - **环境**：
    - 模型：`deepseek-ai/DeepSeek-V3.2` / `z-ai/glm-4.7`
    - API 提供商：SiliconFlow (api.siliconflow.cn)
    - 模式：Streaming (流式响应)

### 排查过程 (Diagnosis Process)

1.  **初步日志分析**：
    - 检查日志发现 `toolsCount: 19`，说明所有 MCP 工具（共13个）和内置工具（6个）都已成功传递给 LLM API。
    - 排除工具加载失败的可能性。

2.  **Schema 格式疑点（误判）**：
    - 对比发现 MCP 工具的 JSON Schema 比较复杂（包含 `anyOf`、`title` 等字段），而内置工具 Schema 简单标准。
    - **尝试修复 1**：在 `mcp_loader.ts` 中实现了 `normalizeToolSchema` 函数。
    - **结果**：日志显示 Schema 已被净化，但工具调用依然失败。**Schema 不是根因。**

3.  **隔离测试（Python 脚本）**：
    - 编写独立的 Python 脚本 `test_mcp_api.py`，脱离 TypeScript 代码库，直接调用 OpenAI SDK 测试 API。
    - **测试 A (非流式 DeepSeek)**：`stream=False`。结果：成功！
    - **测试 B (流式 DeepSeek)**：`stream=True`。结果：失败！
    - **初步结论（部分正确）**：DeepSeek-V3.2 在流式模式下不返回 `tool_calls`。

4.  **过度激进的修复（错误方向）**：
    - 直接将代码改为：**有工具时强制使用非流式**。
    - 问题：牺牲了流式用户体验，且后续测试发现 GLM-4.7 流式也能返回 tool_calls。

5.  **进一步测试揭示真相**：
    - 用 GLM-4.7 模型运行 Python 测试脚本，发现**流式也能正常返回 tool_calls**！
    - 对比 Python 测试脚本和 TypeScript 代码，发现 TypeScript 的流式处理逻辑有缺陷。

### 根本原因 (Root Cause)

**TypeScript 代码的流式 tool_calls 累积逻辑被删除/缺失。**

流式 API 返回的 `tool_calls` 是**分片传输**的：
```
Chunk 27: tool_calls=[{name='query_tasks'}]
Chunk 28: tool_calls=[{arguments='{"date_filter": '}]
Chunk 29: tool_calls=[{arguments='"today"'}]
Chunk 30: tool_calls=[{arguments='}'}]
```

**问题代码**（被错误修改后的版本）：
```typescript
for await (const chunk of stream) {
  yield {
    tool_calls: undefined,  // ❌ 始终是 undefined，不累积分片！
  };
}
```

代码没有累积这些分片，导致即使 API 返回了 `tool_calls`，也被丢弃了。

### 解决方案 (Solution)

恢复并正确实现**流式 tool_calls 累积逻辑**：

```typescript
// 累积器
const toolCallAcc = new Map<number, { id, type, name, argumentsText }>();

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  const finishReason = chunk.choices[0]?.finish_reason;

  // ✅ 累积每个 chunk 的 tool_calls 分片
  if (delta?.tool_calls) {
    for (const call of delta.tool_calls) {
      const index = call.index ?? 0;
      if (!toolCallAcc.has(index)) {
        toolCallAcc.set(index, { id: "", type: "function", name: "", argumentsText: "" });
      }
      const existing = toolCallAcc.get(index)!;
      if (call.id) existing.id = call.id;
      if (call.function?.name) existing.name += call.function.name;
      if (call.function?.arguments) existing.argumentsText += call.function.arguments;
    }
  }

  // ✅ 流结束时组装完整的 tool_calls
  let toolCalls;
  if (finishReason && toolCallAcc.size > 0) {
    toolCalls = Array.from(toolCallAcc.values()).map((call) => ({
      id: call.id,
      type: call.type,
      function: {
        name: call.name,
        arguments: JSON.parse(call.argumentsText || "{}"),
      },
    }));
  }

  yield { content, tool_calls: toolCalls, ... };
}
```

### 教训 (Lessons Learned)

1. **隔离测试很重要**：编写独立的测试脚本可以快速定位问题是在 API 层还是代码层。
2. **不要过度假设**：最初以为是 API 问题，实际上是代码问题。
3. **流式响应需要累积**：流式 tool_calls 是分片传输的，必须累积所有分片才能得到完整数据。
4. **对比验证**：Python 测试脚本正确累积了分片，TypeScript 没有，对比两者可以快速发现差异。

---

## 2026-01-08: MCP Tool Execution Parameter Error

### Issue
Calls to MCP tools (e.g., `query_tasks` in TickTick) were failing with JSONRPC validation errors. The error message indicated that the tool name string was being passed where an object was expected for parameters.

### Root Cause
In `src/tools/mcp_loader.ts`, the `MCPTool.execute` method was calling the MCP SDK's `callTool` method with incorrect arguments.
- **Incorrect:** `this.session.callTool(this.name, params)`
- **Expected:** `this.session.callTool({ name: this.name, arguments: params })`

The MCP SDK client expects a single object containing the tool name and arguments, but the code was passing them as two separate arguments. This caused the tool name string to be interpreted as the `params` object by the SDK/Server, triggering the validation error.

### Solution
Updated `src/tools/mcp_loader.ts`:
1.  Corrected the `McpClient` type definition for `callTool`.
2.  Updated `MCPTool.execute` to pass the arguments in the correct object structure:
    ```typescript
    this.session.callTool({
      name: this.name,
      arguments: params,
    })
    ```
