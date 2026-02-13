vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';
import { SessionHistory } from '../../src/core/session-history.js';

const mockedReaddir = vi.mocked(readdir);
const mockedReadFile = vi.mocked(readFile);

function makeSessionJson(
  id: string,
  opts?: { startTime?: number; steps?: number; error?: boolean },
) {
  const startTime = opts?.startTime ?? Date.now();
  const steps = Array.from({ length: opts?.steps ?? 3 }, (_, i) => ({
    action: { type: i % 2 === 0 ? 'click' : 'navigate' },
    metadata: { url: `https://example.com/page${i}` },
    ...(opts?.error && i === 0 ? { error: 'something failed' } : {}),
  }));
  return JSON.stringify({
    id,
    startTime,
    endTime: startTime + 60_000,
    steps,
    contexts: ['default'],
  });
}

function makeReportJson(bugs: { id: string; title: string; severity: string; url?: string }[]) {
  return JSON.stringify({
    bugs: bugs.map((b) => ({
      ...b,
      timestamp: Date.now(),
    })),
    findings: [{ id: 'f1' }],
  });
}

describe('SessionHistory', () => {
  let history: SessionHistory;

  beforeEach(() => {
    vi.clearAllMocks();
    history = new SessionHistory('/tmp/sessions');
  });

  describe('getHistory', () => {
    it('returns empty array when output dir does not exist', async () => {
      mockedReaddir.mockRejectedValue(new Error('ENOENT'));
      const result = await history.getHistory();
      expect(result).toEqual([]);
    });

    it('lists sessions from disk', async () => {
      mockedReaddir.mockResolvedValue(['session-a', 'session-b'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('session-a/session.json'))
          return Promise.resolve(makeSessionJson('session-a'));
        if (p.includes('session-b/session.json'))
          return Promise.resolve(makeSessionJson('session-b', { startTime: Date.now() - 120_000 }));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory();
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-a');
      expect(result[1].sessionId).toBe('session-b');
    });

    it('respects limit', async () => {
      mockedReaddir.mockResolvedValue(['a', 'b', 'c'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('session.json')) {
          const dir = p.split('/').at(-2)!;
          return Promise.resolve(makeSessionJson(dir));
        }
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory({ limit: 2 });
      expect(result).toHaveLength(2);
    });

    it('respects since filter', async () => {
      const now = Date.now();
      mockedReaddir.mockResolvedValue(['old', 'new'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('old/session.json'))
          return Promise.resolve(makeSessionJson('old', { startTime: now - 200_000 }));
        if (p.includes('new/session.json'))
          return Promise.resolve(makeSessionJson('new', { startTime: now }));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory({ since: now - 100_000 });
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe('new');
    });

    it('computes urlsCovered and actionTypes', async () => {
      mockedReaddir.mockResolvedValue(['s1'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('session.json')) return Promise.resolve(makeSessionJson('s1', { steps: 4 }));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory();
      expect(result[0].urlsCovered.length).toBeGreaterThan(0);
      expect(result[0].actionTypes).toHaveProperty('click');
      expect(result[0].actionTypes).toHaveProperty('navigate');
    });

    it('counts errors', async () => {
      mockedReaddir.mockResolvedValue(['s1'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('session.json'))
          return Promise.resolve(makeSessionJson('s1', { steps: 3, error: true }));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory();
      expect(result[0].errorCount).toBe(1);
    });

    it('skips invalid session directories', async () => {
      mockedReaddir.mockResolvedValue(['good', 'bad'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('good/session.json')) return Promise.resolve(makeSessionJson('good'));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getHistory();
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe('good');
    });
  });

  describe('getBugLedger', () => {
    it('returns empty array when no sessions exist', async () => {
      mockedReaddir.mockRejectedValue(new Error('ENOENT'));
      const result = await history.getBugLedger();
      expect(result).toEqual([]);
    });

    it('aggregates bugs across sessions', async () => {
      mockedReaddir.mockResolvedValue(['s1', 's2'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('report-s1.json'))
          return Promise.resolve(
            makeReportJson([
              { id: 'b1', title: 'Bug One', severity: 'critical', url: 'https://example.com' },
            ]),
          );
        if (p.includes('report-s2.json'))
          return Promise.resolve(
            makeReportJson([{ id: 'b2', title: 'Bug Two', severity: 'minor' }]),
          );
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getBugLedger();
      expect(result).toHaveLength(2);
    });

    it('filters by severity', async () => {
      mockedReaddir.mockResolvedValue(['s1'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('report-s1.json'))
          return Promise.resolve(
            makeReportJson([
              { id: 'b1', title: 'Critical Bug', severity: 'critical' },
              { id: 'b2', title: 'Minor Bug', severity: 'minor' },
            ]),
          );
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getBugLedger({ severity: 'critical' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Critical Bug');
    });

    it('generates stable fingerprints', async () => {
      mockedReaddir.mockResolvedValue(['s1', 's2'] as never);
      const bug = { id: 'b1', title: 'Same Bug', severity: 'major', url: 'https://a.com' };
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('report-')) return Promise.resolve(makeReportJson([bug]));
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getBugLedger();
      expect(result).toHaveLength(2);
      expect(result[0].fingerprint).toBe(result[1].fingerprint);
      expect(result[0].fingerprint).toHaveLength(16);
    });

    it('respects limit', async () => {
      mockedReaddir.mockResolvedValue(['s1'] as never);
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('report-'))
          return Promise.resolve(
            makeReportJson([
              { id: 'b1', title: 'Bug 1', severity: 'minor' },
              { id: 'b2', title: 'Bug 2', severity: 'minor' },
              { id: 'b3', title: 'Bug 3', severity: 'minor' },
            ]),
          );
        return Promise.reject(new Error('not found'));
      });

      const result = await history.getBugLedger({ limit: 2 });
      expect(result).toHaveLength(2);
    });
  });

  describe('compare', () => {
    it('throws when session not found', async () => {
      mockedReadFile.mockRejectedValue(new Error('not found'));
      await expect(history.compare('a', 'b')).rejects.toThrow('Session not found');
    });

    it('identifies URLs only in session A / B', async () => {
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('/a/session.json'))
          return Promise.resolve(
            JSON.stringify({
              id: 'a',
              startTime: Date.now(),
              steps: [
                { action: { type: 'navigate' }, metadata: { url: 'https://a.com' } },
                { action: { type: 'click' }, metadata: { url: 'https://shared.com' } },
              ],
            }),
          );
        if (p.includes('/b/session.json'))
          return Promise.resolve(
            JSON.stringify({
              id: 'b',
              startTime: Date.now(),
              steps: [
                { action: { type: 'navigate' }, metadata: { url: 'https://b.com' } },
                { action: { type: 'fill' }, metadata: { url: 'https://shared.com' } },
              ],
            }),
          );
        return Promise.reject(new Error('not found'));
      });

      const result = await history.compare('a', 'b');
      expect(result.onlyInA.urls).toContain('https://a.com');
      expect(result.onlyInB.urls).toContain('https://b.com');
      expect(result.common.urls).toContain('https://shared.com');
      expect(result.onlyInA.actionTypes).toContain('click');
      expect(result.onlyInB.actionTypes).toContain('fill');
      expect(result.common.actionTypes).toContain('navigate');
    });

    it('identifies new, fixed, and persistent bugs', async () => {
      mockedReadFile.mockImplementation((path: unknown) => {
        const p = path as string;
        if (p.includes('/a/session.json'))
          return Promise.resolve(
            JSON.stringify({
              id: 'a',
              startTime: 1,
              steps: [{ action: { type: 'x' }, metadata: { url: '' } }],
            }),
          );
        if (p.includes('/b/session.json'))
          return Promise.resolve(
            JSON.stringify({
              id: 'b',
              startTime: 2,
              steps: [{ action: { type: 'x' }, metadata: { url: '' } }],
            }),
          );
        if (p.includes('report-a.json'))
          return Promise.resolve(
            makeReportJson([
              { id: 'old', title: 'Fixed Bug', severity: 'major' },
              { id: 'persist', title: 'Persistent Bug', severity: 'minor', url: 'https://x.com' },
            ]),
          );
        if (p.includes('report-b.json'))
          return Promise.resolve(
            makeReportJson([
              { id: 'new', title: 'New Bug', severity: 'critical' },
              { id: 'persist', title: 'Persistent Bug', severity: 'minor', url: 'https://x.com' },
            ]),
          );
        return Promise.reject(new Error('not found'));
      });

      const result = await history.compare('a', 'b');
      expect(result.bugDiff.newInB).toContain('New Bug');
      expect(result.bugDiff.fixedInB).toContain('Fixed Bug');
      expect(result.bugDiff.persistent).toContain('Persistent Bug');
    });
  });
});
