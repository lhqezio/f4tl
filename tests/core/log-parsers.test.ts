import { parseJsonLine } from '../../src/core/log-parsers/json-parser.js';
import { parseClfLine } from '../../src/core/log-parsers/clf-parser.js';
import { parsePlainLine } from '../../src/core/log-parsers/plain-parser.js';

const SOURCE = 'test-source';

describe('parseJsonLine', () => {
  it('parses pino-style JSON with numeric level 30', () => {
    const line = '{"level":30,"time":1700000000000,"msg":"hello"}';
    const entry = parseJsonLine(SOURCE, line);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('info');
    expect(entry!.message).toBe('hello');
    expect(entry!.timestamp).toBe(1700000000000);
  });

  it('parses winston-style JSON with string level and timestamp', () => {
    const line = '{"level":"error","timestamp":"2024-01-15T10:30:00Z","message":"fail"}';
    const entry = parseJsonLine(SOURCE, line);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('error');
    expect(entry!.message).toBe('fail');
  });

  it.each([
    [10, 'debug'],
    [50, 'error'],
    [60, 'fatal'],
  ] as const)('maps pino numeric level %d to %s', (numeric, expected) => {
    const line = JSON.stringify({ level: numeric, msg: 'test' });
    const entry = parseJsonLine(SOURCE, line);
    expect(entry!.level).toBe(expected);
  });

  it.each([
    ['warning', 'warn'],
    ['critical', 'fatal'],
  ] as const)('maps string alias "%s" to "%s"', (alias, expected) => {
    const line = JSON.stringify({ level: alias, msg: 'test' });
    const entry = parseJsonLine(SOURCE, line);
    expect(entry!.level).toBe(expected);
  });

  it('defaults to info when level is missing', () => {
    const line = '{"msg":"no level here"}';
    const entry = parseJsonLine(SOURCE, line);
    expect(entry!.level).toBe('info');
  });

  it('prioritizes msg over message over text over log', () => {
    const withMsg = parseJsonLine(SOURCE, '{"msg":"a","message":"b","text":"c","log":"d"}');
    expect(withMsg!.message).toBe('a');

    const withMessage = parseJsonLine(SOURCE, '{"message":"b","text":"c","log":"d"}');
    expect(withMessage!.message).toBe('b');

    const withText = parseJsonLine(SOURCE, '{"text":"c","log":"d"}');
    expect(withText!.message).toBe('c');

    const withLog = parseJsonLine(SOURCE, '{"log":"d"}');
    expect(withLog!.message).toBe('d');
  });

  it('falls back to JSON.stringify when no message key exists', () => {
    const line = '{"foo":"bar"}';
    const entry = parseJsonLine(SOURCE, line);
    expect(entry!.message).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('returns null for non-JSON input', () => {
    expect(parseJsonLine(SOURCE, 'just plain text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJsonLine(SOURCE, '')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseJsonLine(SOURCE, '   \t  ')).toBeNull();
  });

  it('returns null for line not starting with {', () => {
    expect(parseJsonLine(SOURCE, '[{"level":"info"}]')).toBeNull();
  });
});

describe('parseClfLine', () => {
  it('parses a standard CLF line', () => {
    const line = '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /path HTTP/1.0" 200 2326';
    const entry = parseClfLine(SOURCE, line);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('info');
    expect(entry!.message).toBe('GET /path 200');
    expect(entry!.source).toBe(SOURCE);
  });

  it('maps status 404 to warn', () => {
    const line = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /missing HTTP/1.1" 404 0';
    const entry = parseClfLine(SOURCE, line);
    expect(entry!.level).toBe('warn');
  });

  it('maps status 500 to error', () => {
    const line = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "POST /api HTTP/1.1" 500 123';
    const entry = parseClfLine(SOURCE, line);
    expect(entry!.level).toBe('error');
  });

  it('handles dash fields: user "-" becomes undefined, size "-" becomes 0', () => {
    const line = '10.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.1" 200 -';
    const entry = parseClfLine(SOURCE, line);
    expect(entry!.metadata!.user).toBeUndefined();
    expect(entry!.metadata!.size).toBe(0);
  });

  it('returns null for non-CLF line', () => {
    expect(parseClfLine(SOURCE, 'not a clf line at all')).toBeNull();
  });

  it('returns null for empty line', () => {
    expect(parseClfLine(SOURCE, '')).toBeNull();
  });
});

describe('parsePlainLine', () => {
  it('detects ERROR level', () => {
    const entry = parsePlainLine(SOURCE, '2024-01-15 ERROR something broke');
    expect(entry!.level).toBe('error');
  });

  it('detects WARN level', () => {
    const entry = parsePlainLine(SOURCE, 'WARN: disk space low');
    expect(entry!.level).toBe('warn');
  });

  it('detects WARNING level as warn', () => {
    const entry = parsePlainLine(SOURCE, '[WARNING] memory usage high');
    expect(entry!.level).toBe('warn');
  });

  it('detects INFO level', () => {
    const entry = parsePlainLine(SOURCE, 'INFO server started');
    expect(entry!.level).toBe('info');
  });

  it('detects DEBUG level', () => {
    const entry = parsePlainLine(SOURCE, 'DEBUG query executed in 5ms');
    expect(entry!.level).toBe('debug');
  });

  it('detects FATAL level', () => {
    const entry = parsePlainLine(SOURCE, 'FATAL unrecoverable error');
    expect(entry!.level).toBe('fatal');
  });

  it('defaults to info when no level keyword present', () => {
    const entry = parsePlainLine(SOURCE, 'some generic log message');
    expect(entry!.level).toBe('info');
  });

  it('detects ISO 8601 timestamp', () => {
    const entry = parsePlainLine(SOURCE, '2024-01-15T10:30:00.000Z INFO started');
    expect(entry!.timestamp).toBe(new Date('2024-01-15T10:30:00.000Z').getTime());
  });

  it('returns null for empty line', () => {
    expect(parsePlainLine(SOURCE, '')).toBeNull();
  });

  it('returns null for whitespace-only line', () => {
    expect(parsePlainLine(SOURCE, '   ')).toBeNull();
  });
});
