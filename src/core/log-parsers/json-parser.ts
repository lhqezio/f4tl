import type { LogEntry, LogLevel } from '../../types/index.js';

const LEVEL_MAP: Record<string, LogLevel> = {
  // pino numeric levels
  '10': 'debug',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error',
  '60': 'fatal',
  // string levels
  trace: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
  critical: 'fatal',
};

function normalizeLevel(raw: unknown): LogLevel {
  if (raw === undefined || raw === null) return 'info';
  const key = String(raw).toLowerCase();
  return LEVEL_MAP[key] ?? 'info';
}

function extractTimestamp(obj: Record<string, unknown>): number {
  // pino: time (epoch ms), winston: timestamp (ISO)
  for (const key of ['time', 'timestamp', '@timestamp', 'ts', 'date']) {
    const val = obj[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const d = new Date(val).getTime();
      if (!isNaN(d)) return d;
    }
  }
  return Date.now();
}

function extractMessage(obj: Record<string, unknown>): string {
  for (const key of ['msg', 'message', 'text', 'log']) {
    if (typeof obj[key] === 'string') return obj[key] as string;
  }
  return JSON.stringify(obj);
}

export function parseJsonLine(source: string, line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) return null;

  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      source,
      level: normalizeLevel(obj.level ?? obj.severity),
      message: extractMessage(obj),
      timestamp: extractTimestamp(obj),
      metadata: obj,
    };
  } catch {
    return null;
  }
}
