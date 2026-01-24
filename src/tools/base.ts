/**
 * JSON Schema type.
 * Used to describe a Tool's parameter structure following the JSON Schema spec.
 * Example: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Base type for Tool input parameters.
 * All Tool `execute()` methods should accept parameters compatible with this type.
 */
export type ToolInput = Record<string, unknown>;


/**
 * Unified structure for Tool execution results.
 * All Tool `execute()` methods must return an object that matches this shape.
 *
 * @property success - Whether the execution succeeded
 * @property content - Result content (output text when successful)
 * @property error   - Error message (optional, when failed)
 */
export interface ToolResult {
  success: boolean;
  content: string;
  error?: string | null;
}

/**
 * Tool result with extra metadata (extended).
 * Useful for tools that need to return additional fields (e.g. BashTool returning stdout/stderr/exitCode).
 *
 * @template TMeta - Type of extra metadata, must extend Record<string, unknown>
 *
 * @example
 * // Define the return type for a Bash tool
 * type BashResult = ToolResultWithMeta<{
 *   stdout: string;
 *   stderr: string;
 *   exitCode: number;
 *   bashId?: string;
 * }>;
 */
export type ToolResultWithMeta<
  TMeta extends Record<string, unknown> = Record<string, never>
> = ToolResult & TMeta;


/**
 * Tool interface - the core interface all tools must implement.
 *
 * @template Input  - Input parameter type accepted by the tool
 * @template Output - Result type returned by the tool
 *
 * @property name        - Tool name (used by the LLM when calling the tool)
 * @property description - Tool description (tells the LLM what it does and how to use it)
 * @property parameters  - JSON Schema parameter definition (used by the LLM to construct valid args)
 * @method execute       - Async execution method that takes params and returns a result
 *
 */
export interface Tool<
  Input extends ToolInput = ToolInput,
  Output extends ToolResult = ToolResult
> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(params: Input): Promise<Output>;
}

