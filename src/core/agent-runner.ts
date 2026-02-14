import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'node:events';
import type { ToolExecutor } from './tool-executor.js';
import type { ToolContent } from '../types/index.js';

export interface AgentConfig {
  apiKey?: string;
  model: string;
  maxTurns: number;
  systemPrompt?: string;
}

export type AgentEventType =
  | 'agent:start'
  | 'agent:turn'
  | 'agent:tool_call'
  | 'agent:tool_result'
  | 'agent:thinking'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:cancelled';

export interface AgentTurn {
  turnNumber: number;
  role: 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; id: string; input: Record<string, unknown> }[];
  toolResults?: { toolUseId: string; name: string; isError: boolean }[];
  timestamp: number;
}

export interface AgentRunResult {
  turns: AgentTurn[];
  totalTurns: number;
  duration: number;
  cancelled: boolean;
  error?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are an autonomous QA testing agent powered by f4tl. You have browser automation tools, code exploration tools, network inspection tools, and reporting tools.

Your job:
1. Understand the testing goal
2. Navigate the application methodically
3. Test functionality, look for bugs, accessibility issues, and UX problems
4. Report any bugs you find using report_create_bug
5. Record findings using report_add_finding
6. Generate a report at the end using report_generate

Be thorough and systematic. Take screenshots frequently. Check console errors and network responses.`;

export type CreateMessageFn = (params: {
  model: string;
  max_tokens: number;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
}) => Promise<Anthropic.Message>;

export class AgentRunner extends EventEmitter {
  private abortController: AbortController | null = null;
  private running = false;
  private currentGoal: string | null = null;
  private turnNumber = 0;
  private createMessageFn: CreateMessageFn | null;

  constructor(
    private config: AgentConfig,
    private toolExecutor: ToolExecutor,
    createMessageFn?: CreateMessageFn,
  ) {
    super();
    this.createMessageFn = createMessageFn ?? null;
  }

  isRunning(): boolean {
    return this.running;
  }

  getCurrentGoal(): string | null {
    return this.currentGoal;
  }

  getTurnNumber(): number {
    return this.turnNumber;
  }

  getMaxTurns(): number {
    return this.config.maxTurns;
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async run(goal: string): Promise<AgentRunResult> {
    if (this.running) {
      throw new Error('Agent is already running');
    }

    this.running = true;
    this.currentGoal = goal;
    this.turnNumber = 0;
    this.abortController = new AbortController();
    const startTime = Date.now();
    const turns: AgentTurn[] = [];

    this.emit('agent:start', { goal, maxTurns: this.config.maxTurns });

    const createMessage: CreateMessageFn =
      this.createMessageFn ??
      (async (params) => {
        const client = new Anthropic({
          apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
        });
        return client.messages.create(params);
      });

    const tools = this.toolExecutor.toAnthropicTools();
    const systemPrompt = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: goal }];

    try {
      while (this.turnNumber < this.config.maxTurns) {
        if (this.abortController.signal.aborted) {
          this.emit('agent:cancelled', { turnNumber: this.turnNumber });
          return this.buildResult(turns, startTime, true);
        }

        this.turnNumber++;
        this.emit('agent:turn', { turnNumber: this.turnNumber, maxTurns: this.config.maxTurns });

        const response = await createMessage({
          model: this.config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: tools as Anthropic.Tool[],
        });

        // Extract text and tool_use blocks
        const textParts: string[] = [];
        const toolCalls: { name: string; id: string; input: Record<string, unknown> }[] = [];

        for (const block of response.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
            this.emit('agent:thinking', { text: block.text, turnNumber: this.turnNumber });
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              name: block.name,
              id: block.id,
              input: block.input as Record<string, unknown>,
            });
          }
        }

        // Record assistant turn
        const assistantTurn: AgentTurn = {
          turnNumber: this.turnNumber,
          role: 'assistant',
          content: textParts.join('\n'),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          timestamp: Date.now(),
        };
        turns.push(assistantTurn);

        // Add assistant message to conversation
        messages.push({ role: 'assistant', content: response.content });

        // If stop_reason is "end_turn" (no tool calls), we're done
        if (response.stop_reason === 'end_turn' || toolCalls.length === 0) {
          this.emit('agent:complete', {
            turns: this.turnNumber,
            duration: Date.now() - startTime,
          });
          return this.buildResult(turns, startTime, false);
        }

        // Execute tool calls
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
        const toolResultMeta: { toolUseId: string; name: string; isError: boolean }[] = [];

        for (const call of toolCalls) {
          if (this.abortController.signal.aborted) {
            this.emit('agent:cancelled', { turnNumber: this.turnNumber });
            return this.buildResult(turns, startTime, true);
          }

          this.emit('agent:tool_call', {
            name: call.name,
            id: call.id,
            input: call.input,
            turnNumber: this.turnNumber,
          });

          const result = await this.toolExecutor.callTool(call.name, call.input);

          this.emit('agent:tool_result', {
            name: call.name,
            id: call.id,
            isError: result.isError ?? false,
            turnNumber: this.turnNumber,
          });

          // Map f4tl ToolResult → Anthropic tool_result content
          const anthropicContent = result.content.map((c: ToolContent) => {
            if (c.type === 'image') {
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: c.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                  data: c.data,
                },
              };
            }
            return { type: 'text' as const, text: c.text };
          });

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: anthropicContent,
            is_error: result.isError ?? false,
          });

          toolResultMeta.push({
            toolUseId: call.id,
            name: call.name,
            isError: result.isError ?? false,
          });
        }

        // Record tool result turn
        turns.push({
          turnNumber: this.turnNumber,
          role: 'tool',
          content: `Executed ${toolResultMeta.length} tool(s)`,
          toolResults: toolResultMeta,
          timestamp: Date.now(),
        });

        // Add tool results to conversation
        messages.push({ role: 'user', content: toolResultBlocks });
      }

      // Max turns reached
      this.emit('agent:complete', {
        turns: this.turnNumber,
        duration: Date.now() - startTime,
        maxTurnsReached: true,
      });
      return this.buildResult(turns, startTime, false);
    } catch (err) {
      const error = (err as Error).message;
      this.emit('agent:error', { error, turnNumber: this.turnNumber });
      return {
        turns,
        totalTurns: this.turnNumber,
        duration: Date.now() - startTime,
        cancelled: false,
        error,
      };
    } finally {
      this.running = false;
      this.currentGoal = null;
      this.abortController = null;
    }
  }

  private buildResult(turns: AgentTurn[], startTime: number, cancelled: boolean): AgentRunResult {
    return {
      turns,
      totalTurns: this.turnNumber,
      duration: Date.now() - startTime,
      cancelled,
    };
  }
}
