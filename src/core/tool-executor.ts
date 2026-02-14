import type { ZodTypeAny } from 'zod';
import type { ToolResult } from '../types/index.js';
import { zodToJsonSchema } from './zod-to-json-schema.js';

interface ToolDefinition {
  name: string;
  description: string;
  schema: ZodTypeAny;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Unified tool executor that wraps tool instances for both MCP and agent use.
 * register(name, desc, schema, handler) → callTool(name, params) → ToolResult
 */
export class ToolExecutor {
  private tools = new Map<string, ToolDefinition>();

  register(
    name: string,
    description: string,
    schema: ZodTypeAny,
    handler: (params: Record<string, unknown>) => Promise<ToolResult>,
  ): void {
    this.tools.set(name, { name, description, schema, handler });
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      // Validate with Zod
      const validated = tool.schema.parse(params);
      return await tool.handler(validated);
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Tool error (${name}): ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  /**
   * Convert all registered tools to Anthropic API tool format.
   */
  toAnthropicTools(): AnthropicTool[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.schema),
    }));
  }

  getToolNames(): string[] {
    return [...this.tools.keys()];
  }

  getToolCount(): number {
    return this.tools.size;
  }
}
