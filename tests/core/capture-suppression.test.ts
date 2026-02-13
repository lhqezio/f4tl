import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptureManager } from '../../src/core/capture.js';
import type { CaptureConfig } from '../../src/types/index.js';

// Minimal mock page
function createMockPage() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
    url: vi.fn().mockReturnValue('http://localhost:3000/test'),
    title: vi.fn().mockResolvedValue('Test Page'),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    context: vi.fn().mockReturnValue({
      newCDPSession: vi.fn().mockRejectedValue(new Error('no CDP')),
    }),
  };
}

describe('CaptureManager — Error Suppression', () => {
  let page: ReturnType<typeof createMockPage>;
  const baseConfig: CaptureConfig = {
    format: 'png',
    quality: 90,
    fullPage: false,
    animations: 'disabled',
  };

  beforeEach(() => {
    page = createMockPage();
  });

  it('returns all errors when no suppression configured', async () => {
    const cm = new CaptureManager(page as never, baseConfig);

    // Simulate console error
    page.emit('console', {
      type: () => 'error',
      text: () => 'React warning: something broke',
      location: () => ({}),
    });

    // Simulate network error
    page.emit('response', {
      status: () => 404,
      url: () => 'http://localhost:3000/api/missing',
      request: () => ({ method: () => 'GET' }),
      statusText: () => 'Not Found',
    });

    const result = await cm.capture();
    expect(result.metadata.consoleErrors).toHaveLength(1);
    expect(result.metadata.networkErrors).toHaveLength(1);
  });

  it('suppresses console errors matching config patterns', async () => {
    const cm = new CaptureManager(page as never, {
      ...baseConfig,
      suppressErrors: {
        console: ['React warning', 'third-party-lib'],
        network: [],
      },
    });

    page.emit('console', {
      type: () => 'error',
      text: () => 'React warning: something broke',
      location: () => ({}),
    });
    page.emit('console', {
      type: () => 'error',
      text: () => 'third-party-lib: deprecation notice',
      location: () => ({}),
    });
    page.emit('console', {
      type: () => 'error',
      text: () => 'Real bug: uncaught TypeError',
      location: () => ({}),
    });

    const result = await cm.capture();
    expect(result.metadata.consoleErrors).toHaveLength(1);
    expect(result.metadata.consoleErrors[0].text).toBe('Real bug: uncaught TypeError');
  });

  it('suppresses network errors matching config patterns', async () => {
    const cm = new CaptureManager(page as never, {
      ...baseConfig,
      suppressErrors: {
        console: [],
        network: ['analytics\\.google', 'sentry\\.io'],
      },
    });

    page.emit('response', {
      status: () => 403,
      url: () => 'https://analytics.google.com/collect',
      request: () => ({ method: () => 'POST' }),
      statusText: () => 'Forbidden',
    });
    page.emit('response', {
      status: () => 500,
      url: () => 'https://sentry.io/api/report',
      request: () => ({ method: () => 'POST' }),
      statusText: () => 'Internal Server Error',
    });
    page.emit('response', {
      status: () => 404,
      url: () => 'http://localhost:3000/api/users',
      request: () => ({ method: () => 'GET' }),
      statusText: () => 'Not Found',
    });

    const result = await cm.capture();
    expect(result.metadata.networkErrors).toHaveLength(1);
    expect(result.metadata.networkErrors[0].url).toBe('http://localhost:3000/api/users');
  });

  it('suppresses via runtime patterns', async () => {
    const cm = new CaptureManager(page as never, baseConfig);
    cm.addRuntimeSuppression('console', 'DevTools');
    cm.addRuntimeSuppression('network', 'favicon\\.ico');

    page.emit('console', {
      type: () => 'warning',
      text: () => 'DevTools failed to load source map',
      location: () => ({}),
    });
    page.emit('console', {
      type: () => 'error',
      text: () => 'Actual error worth seeing',
      location: () => ({}),
    });
    page.emit('response', {
      status: () => 404,
      url: () => 'http://localhost:3000/favicon.ico',
      request: () => ({ method: () => 'GET' }),
      statusText: () => 'Not Found',
    });
    page.emit('response', {
      status: () => 500,
      url: () => 'http://localhost:3000/api/crash',
      request: () => ({ method: () => 'GET' }),
      statusText: () => 'Internal Server Error',
    });

    const result = await cm.capture();
    expect(result.metadata.consoleErrors).toHaveLength(1);
    expect(result.metadata.consoleErrors[0].text).toBe('Actual error worth seeing');
    expect(result.metadata.networkErrors).toHaveLength(1);
    expect(result.metadata.networkErrors[0].url).toBe('http://localhost:3000/api/crash');
  });

  it('combines config and runtime patterns', async () => {
    const cm = new CaptureManager(page as never, {
      ...baseConfig,
      suppressErrors: {
        console: ['React warning'],
        network: [],
      },
    });
    cm.addRuntimeSuppression('console', 'DevTools');

    page.emit('console', {
      type: () => 'error',
      text: () => 'React warning: prop type mismatch',
      location: () => ({}),
    });
    page.emit('console', {
      type: () => 'warning',
      text: () => 'DevTools source map missing',
      location: () => ({}),
    });
    page.emit('console', {
      type: () => 'error',
      text: () => 'Real error: network timeout',
      location: () => ({}),
    });

    const result = await cm.capture();
    expect(result.metadata.consoleErrors).toHaveLength(1);
    expect(result.metadata.consoleErrors[0].text).toBe('Real error: network timeout');
  });

  it('getRuntimeSuppressions returns current patterns', () => {
    const cm = new CaptureManager(page as never, baseConfig);
    cm.addRuntimeSuppression('console', 'foo');
    cm.addRuntimeSuppression('network', 'bar');

    const sups = cm.getRuntimeSuppressions();
    expect(sups.console).toEqual(['foo']);
    expect(sups.network).toEqual(['bar']);
  });
});
