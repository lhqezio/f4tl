import type { LogEntry, LogLevel } from '../../types/index.js';

const LEVEL_PATTERNS: [RegExp, LogLevel][] = [
  [/\b(FATAL|CRITICAL)\b/i, 'fatal'],
  [/\bERROR\b/i, 'error'],
  [/\bWARN(?:ING)?\b/i, 'warn'],
  [/\bINFO\b/i, 'info'],
  [/\bDEBUG\b/i, 'debug'],
];

// Common timestamp patterns
const TIMESTAMP_PATTERNS = [
  // ISO 8601: 2024-01-15T10:30:00.000Z
  /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
  // Date + time: 2024-01-15 10:30:00
  /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
  // Syslog-like: Jan 15 10:30:00
  /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
];

function detectLevel(line: string): LogLevel {
  for (const [re, level] of LEVEL_PATTERNS) {
    if (re.test(line)) return level;
  }
  return 'info';
}

function detectTimestamp(line: string): number {
  for (const re of TIMESTAMP_PATTERNS) {
    const m = re.exec(line);
    if (m) {
      const d = new Date(m[1]).getTime();
      if (!isNaN(d)) return d;
    }
  }
  return Date.now();
}

export function parsePlainLine(source: string, line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  return {
    source,
    level: detectLevel(trimmed),
    message: trimmed,
    timestamp: detectTimestamp(trimmed),
  };
}
