import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ToolExecutor } from '../../src/core/tool-executor.js';

describe('ToolExecutor', () => {
  it('registers and calls a tool', async () => {
    const executor = new ToolExecutor();
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });

    executor.register('test_tool', 'A test tool', z.object({ name: z.string() }), handler);
    const result = await executor.callTool('test_tool', { name: 'hello' });

    expect(handler).toHaveBeenCalledWith({ name: 'hello' });
    expect(result.content[0]).toEqual({ type: 'text', text: 'ok' });
    expect(result.isError).toBeUndefined();
  });

  it('returns error for unknown tool', async () => {
    const executor = new ToolExecutor();
    const result = await executor.callTool('nonexistent', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as { text: string }).text).toContain('Unknown tool');
  });

  it('validates params with Zod', async () => {
    const executor = new ToolExecutor();
    executor.register(
      'typed_tool',
      'Typed',
      z.object({ count: z.number().int().min(1) }),
      vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    );

    // Invalid param
    const result = await executor.callTool('typed_tool', { count: -1 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Tool error');
  });

  it('handles handler errors gracefully', async () => {
    const executor = new ToolExecutor();
    executor.register(
      'error_tool',
      'Errors',
      z.object({}),
      vi.fn().mockRejectedValue(new Error('boom')),
    );

    const result = await executor.callTool('error_tool', {});
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('boom');
  });

  it('returns tool names', () => {
    const executor = new ToolExecutor();
    executor.register('tool_a', 'A', z.object({}), vi.fn());
    executor.register('tool_b', 'B', z.object({}), vi.fn());

    expect(executor.getToolNames()).toEqual(['tool_a', 'tool_b']);
    expect(executor.getToolCount()).toBe(2);
  });

  it('converts to Anthropic tools format', () => {
    const executor = new ToolExecutor();
    executor.register(
      'my_tool',
      'My description',
      z.object({
        url: z.string().url().describe('Target URL'),
        timeout: z.number().optional(),
      }),
      vi.fn(),
    );

    const tools = executor.toAnthropicTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('my_tool');
    expect(tools[0].description).toBe('My description');
    expect(tools[0].input_schema.type).toBe('object');
    expect(tools[0].input_schema.required).toEqual(['url']);
  });
});
