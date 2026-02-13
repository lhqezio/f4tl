import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import type { LogSourceConfig, LogEntry, LogLevel } from '../types/index.js';
import { createParser, type LogParser } from './log-parsers/index.js';

const MAX_BUFFER_SIZE = 10_000;

interface SourceState {
  config: LogSourceConfig;
  parser: LogParser;
  buffer: LogEntry[];
  process?: ChildProcess;
  readline?: Interface;
}

export class LogCollector {
  private sources = new Map<string, SourceState>();

  constructor(private configs: Record<string, LogSourceConfig>) {}

  start(): void {
    for (const [name, config] of Object.entries(this.configs)) {
      const state: SourceState = {
        config,
        parser: createParser(config.parser),
        buffer: [],
      };

      this.sources.set(name, state);

      if (config.type === 'process' && config.command) {
        this.startProcess(name, state);
      } else if (config.type === 'file' && config.path) {
        this.startFileTail(name, state);
      }
    }
  }

  stop(): void {
    for (const state of this.sources.values()) {
      if (state.process) {
        state.process.kill('SIGTERM');
        state.process = undefined;
      }
      if (state.readline) {
        state.readline.close();
        state.readline = undefined;
      }
    }
    this.sources.clear();
  }

  tail(source: string, lines = 50): LogEntry[] {
    const state = this.sources.get(source);
    if (!state) throw new Error(`Unknown log source: "${source}"`);
    return state.buffer.slice(-lines);
  }

  getLogs(filters?: {
    source?: string;
    level?: LogLevel;
    since?: number;
    until?: number;
    limit?: number;
  }): LogEntry[] {
    let entries: LogEntry[] = [];

    if (filters?.source) {
      const state = this.sources.get(filters.source);
      if (!state) throw new Error(`Unknown log source: "${filters.source}"`);
      entries = [...state.buffer];
    } else {
      for (const state of this.sources.values()) {
        entries.push(...state.buffer);
      }
      entries.sort((a, b) => a.timestamp - b.timestamp);
    }

    if (filters?.level) {
      const levels = levelAndAbove(filters.level);
      entries = entries.filter((e) => levels.has(e.level));
    }

    if (filters?.since) {
      const since = filters.since;
      entries = entries.filter((e) => e.timestamp >= since);
    }

    if (filters?.until) {
      const until = filters.until;
      entries = entries.filter((e) => e.timestamp <= until);
    }

    const limit = filters?.limit ?? 200;
    return entries.slice(-limit);
  }

  search(
    pattern: string,
    opts?: { source?: string; caseSensitive?: boolean; limit?: number },
  ): LogEntry[] {
    const flags = opts?.caseSensitive ? '' : 'i';
    const re = new RegExp(pattern, flags);

    let entries: LogEntry[] = [];

    if (opts?.source) {
      const state = this.sources.get(opts.source);
      if (!state) throw new Error(`Unknown log source: "${opts.source}"`);
      entries = state.buffer.filter((e) => re.test(e.message));
    } else {
      for (const state of this.sources.values()) {
        entries.push(...state.buffer.filter((e) => re.test(e.message)));
      }
      entries.sort((a, b) => a.timestamp - b.timestamp);
    }

    const limit = opts?.limit ?? 100;
    return entries.slice(-limit);
  }

  getSourceNames(): string[] {
    return [...this.sources.keys()];
  }

  private startProcess(name: string, state: SourceState): void {
    const command = state.config.command;
    if (!command) return;
    const proc = spawn(command, state.config.args ?? [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    state.process = proc;

    if (!proc.stdout || !proc.stderr) return;
    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => this.pushLine(name, state, line));

    // Also capture stderr
    const rlErr = createInterface({ input: proc.stderr });
    rlErr.on('line', (line) => this.pushLine(name, state, line));

    proc.on('close', () => {
      rl.close();
      rlErr.close();
    });
  }

  private startFileTail(name: string, state: SourceState): void {
    const filePath = state.config.path;
    if (!filePath) return;
    // Use tail -f approach: read from end of file and follow
    const proc = spawn('tail', ['-f', '-n', '100', filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    state.process = proc;

    if (!proc.stdout) return;
    const rl = createInterface({ input: proc.stdout });
    state.readline = rl;
    rl.on('line', (line) => this.pushLine(name, state, line));

    proc.on('close', () => {
      rl.close();
    });
  }

  private pushLine(name: string, state: SourceState, line: string): void {
    const entry = state.parser(name, line);
    if (!entry) return;

    state.buffer.push(entry);

    // FIFO eviction
    if (state.buffer.length > MAX_BUFFER_SIZE) {
      state.buffer.splice(0, state.buffer.length - MAX_BUFFER_SIZE);
    }
  }
}

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

function levelAndAbove(level: LogLevel): Set<LogLevel> {
  const idx = LEVEL_ORDER.indexOf(level);
  return new Set(LEVEL_ORDER.slice(idx));
}
