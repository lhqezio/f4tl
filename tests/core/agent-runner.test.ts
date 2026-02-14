import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { AgentRunner, type CreateMessageFn } from '../../src/core/agent-runner.js';
import { ToolExecutor } from '../../src/core/tool-executor.js';
import type Anthropic from '@anthropic-ai/sdk';

function buildToolExecutor(): ToolExecutor {
  const te = new ToolExecutor();
  te.register('browser_screenshot', 'Take screenshot', z.object({}), async () => ({
    content: [{ type: 'text' as const, text: 'Screenshot taken' }],
  }));
  te.register('browser_navigate', 'Navigate', z.object({ url: z.string() }), async () => ({
    content: [{ type: 'text' as const, text: 'Navigated' }],
  }));
  return te;
}

function mockCreateMessage(responses: Partial<Anthropic.Message>[]): CreateMessageFn {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return resp as Anthropic.Message;
  });
}

describe('AgentRunner', () => {
  it('runs a simple conversation and completes', async () => {
    const te = buildToolExecutor();
    const createMessage = mockCreateMessage([
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'text', text: 'Let me navigate to the page.' },
          {
            type: 'tool_use',
            id: 'tool1',
            name: 'browser_navigate',
            input: { url: 'https://example.com' },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      {
        id: 'msg_2',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Testing complete. All looks good!' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 200, output_tokens: 30 },
      },
    ]);

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 10 },
      te,
      createMessage,
    );

    const events: string[] = [];
    runner.on('agent:start', () => events.push('start'));
    runner.on('agent:turn', () => events.push('turn'));
    runner.on('agent:tool_call', () => events.push('tool_call'));
    runner.on('agent:tool_result', () => events.push('tool_result'));
    runner.on('agent:thinking', () => events.push('thinking'));
    runner.on('agent:complete', () => events.push('complete'));

    const result = await runner.run('Test https://example.com');

    expect(result.cancelled).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.totalTurns).toBe(2);
    expect(result.turns).toHaveLength(3); // assistant + tool result + assistant
    expect(events).toContain('start');
    expect(events).toContain('turn');
    expect(events).toContain('tool_call');
    expect(events).toContain('tool_result');
    expect(events).toContain('complete');
  });

  it('stops at max turns', async () => {
    const te = buildToolExecutor();
    const createMessage = mockCreateMessage([
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'text', text: 'Working...' },
          { type: 'tool_use', id: 'tool1', name: 'browser_screenshot', input: {} },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    ]);

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 2 },
      te,
      createMessage,
    );

    const result = await runner.run('Test forever');
    expect(result.totalTurns).toBe(2);
    expect(result.cancelled).toBe(false);
  });

  it('can be cancelled', async () => {
    const te = buildToolExecutor();
    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 50 },
      te,
      vi.fn(async () => {
        // Cancel after first API call
        runner.cancel();
        return {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          content: [{ type: 'tool_use', id: 'tool1', name: 'browser_screenshot', input: {} }],
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        } as Anthropic.Message;
      }),
    );

    const events: string[] = [];
    runner.on('agent:cancelled', () => events.push('cancelled'));

    const result = await runner.run('Long test');
    expect(result.cancelled).toBe(true);
    expect(events).toContain('cancelled');
  });

  it('handles API errors', async () => {
    const te = buildToolExecutor();
    const createMessage = vi.fn(async () => {
      throw new Error('API rate limit');
    });

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 10 },
      te,
      createMessage,
    );

    const events: string[] = [];
    runner.on('agent:error', () => events.push('error'));

    const result = await runner.run('Will fail');
    expect(result.error).toBe('API rate limit');
    expect(events).toContain('error');
  });

  it('emits events in correct order', async () => {
    const te = buildToolExecutor();
    const createMessage = mockCreateMessage([
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 10 },
      },
    ]);

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 10 },
      te,
      createMessage,
    );

    const events: string[] = [];
    runner.on('agent:start', () => events.push('start'));
    runner.on('agent:turn', () => events.push('turn'));
    runner.on('agent:thinking', () => events.push('thinking'));
    runner.on('agent:complete', () => events.push('complete'));

    await runner.run('Simple test');
    expect(events).toEqual(['start', 'turn', 'thinking', 'complete']);
  });

  it('reports running state correctly', async () => {
    const te = buildToolExecutor();
    const createMessage = mockCreateMessage([
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 10 },
      },
    ]);

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 10 },
      te,
      createMessage,
    );

    expect(runner.isRunning()).toBe(false);
    expect(runner.getCurrentGoal()).toBeNull();

    await runner.run('Test');

    expect(runner.isRunning()).toBe(false);
    expect(runner.getCurrentGoal()).toBeNull();
  });

  it('prevents concurrent runs', async () => {
    const te = buildToolExecutor();
    let resolveFirst: () => void;
    const createMessage = vi.fn(
      () =>
        new Promise<Anthropic.Message>((resolve) => {
          resolveFirst = () =>
            resolve({
              id: 'msg_1',
              type: 'message',
              role: 'assistant',
              model: 'claude-sonnet-4-20250514',
              content: [{ type: 'text', text: 'Done' }],
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: { input_tokens: 100, output_tokens: 10 },
            } as Anthropic.Message);
        }),
    );

    const runner = new AgentRunner(
      { model: 'claude-sonnet-4-20250514', maxTurns: 10 },
      te,
      createMessage,
    );

    const firstRun = runner.run('First');

    await expect(runner.run('Second')).rejects.toThrow('already running');

    resolveFirst!();
    await firstRun;
  });
});
