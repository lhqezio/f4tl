import type { LogEntry } from '../../types/index.js';
import { parseJsonLine } from './json-parser.js';
import { parseClfLine } from './clf-parser.js';
import { parsePlainLine } from './plain-parser.js';

export type LogParser = (source: string, line: string) => LogEntry | null;

export function createParser(format: 'json' | 'clf' | 'plain'): LogParser {
  switch (format) {
    case 'json':
      return parseJsonLine;
    case 'clf':
      return parseClfLine;
    case 'plain':
      return parsePlainLine;
  }
}

export { parseJsonLine, parseClfLine, parsePlainLine };
