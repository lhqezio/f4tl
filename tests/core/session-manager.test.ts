import type {
  BrowserAction,
  F4tlConfig,
  SessionConfig,
  SessionEvent,
  StepMetadata,
} from '../../src/types/index.js';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('test-id-123'),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { nanoid } from 'nanoid';
import { mkdir, writeFile } from 'node:fs/promises';
import { SessionManager } from '../../src/core/session-manager.js';

const mockedMkdir = vi.mocked(mkdir);
const mockedWriteFile = vi.mocked(writeFile);
const mockedNanoid = vi.mocked(nanoid);

function createSessionConfig(overrides?: Partial<SessionConfig>): SessionConfig {
  return {
    outputDir: '/tmp/test-sessions',
    maxSteps: 1000,
    keepArtifacts: false,
    ...overrides,
  };
}

function createMinimalF4tlConfig(): F4tlConfig {
  return {
    browser: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      slowMo: 0,
      timeout: 30_000,
      devtools: false,
      args: [],
    },
    session: {
      outputDir: '/tmp/test-sessions',
      maxSteps: 1000,
      keepArtifacts: false,
    },
    capture: {
      format: 'png',
      quality: 90,
      fullPage: false,
      animations: 'disabled',
    },
    mcp: {
      name: 'f4tl',
      version: '0.1.0',
      logLevel: 'info',
    },
    codebase: {
      projectRoot: '/tmp',
      excludePatterns: [],
    },
    report: {
      outputDir: '/tmp/test-reports',
    },
    dashboard: {
      port: 4173,
      host: 'localhost',
    },
  };
}

function createAction(type = 'click'): BrowserAction {
  return {
    type: type as BrowserAction['type'],
    params: { selector: '#btn' },
    timestamp: Date.now(),
  };
}

function createMetadata(): StepMetadata {
  return {
    url: 'https://example.com',
    title: 'Example Page',
    viewport: { width: 1280, height: 720 },
    consoleErrors: [],
    networkErrors: [],
  };
}

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedNanoid.mockReturnValue('test-id-123');
    manager = new SessionManager(createSessionConfig());
  });

  describe('getSession', () => {
    it('returns null before start', () => {
      expect(manager.getSession()).toBeNull();
    });

    it('returns session after start', () => {
      manager.startSession(createMinimalF4tlConfig());
      const session = manager.getSession();
      expect(session).not.toBeNull();
      expect(session!.id).toBe('test-id-123');
    });
  });

  describe('startSession', () => {
    it('returns a session ID', () => {
      const id = manager.startSession(createMinimalF4tlConfig());
      expect(id).toBe('test-id-123');
    });

    it('sets session with correct initial state', () => {
      const config = createMinimalF4tlConfig();
      manager.startSession(config);
      const session = manager.getSession();
      expect(session).not.toBeNull();
      expect(session!.steps).toEqual([]);
      expect(session!.config).toBe(config);
      expect(session!.startTime).toBeGreaterThan(0);
      expect(session!.endTime).toBeUndefined();
    });
  });

  describe('getCurrentStepCount', () => {
    it('is 0 initially after startSession', () => {
      manager.startSession(createMinimalF4tlConfig());
      expect(manager.getCurrentStepCount()).toBe(0);
    });

    it('increments after recordStep', async () => {
      manager.startSession(createMinimalF4tlConfig());
      await manager.recordStep(createAction(), 'base64screenshot', createMetadata(), 100);
      expect(manager.getCurrentStepCount()).toBe(1);
    });

    it('returns 0 when no session', () => {
      expect(manager.getCurrentStepCount()).toBe(0);
    });
  });

  describe('recordStep', () => {
    it('adds step and returns SessionStep with correct fields', async () => {
      manager.startSession(createMinimalF4tlConfig());
      const action = createAction('navigate');
      const metadata = createMetadata();
      const step = await manager.recordStep(action, 'screenshot-data', metadata, 250, undefined);

      expect(step.id).toBe('test-id-123');
      expect(step.action).toBe(action);
      expect(step.screenshot).toBe('screenshot-data');
      expect(step.metadata).toBe(metadata);
      expect(step.duration).toBe(250);
      expect(step.error).toBeUndefined();
    });

    it('includes error when provided', async () => {
      manager.startSession(createMinimalF4tlConfig());
      const step = await manager.recordStep(
        createAction(),
        'screenshot',
        createMetadata(),
        100,
        'Something failed',
      );
      expect(step.error).toBe('Something failed');
    });

    it('throws when no session is active', async () => {
      await expect(
        manager.recordStep(createAction(), 'screenshot', createMetadata(), 100),
      ).rejects.toThrow('No active session');
    });

    it('throws when maxSteps is reached', async () => {
      const limitedManager = new SessionManager(createSessionConfig({ maxSteps: 2 }));
      limitedManager.startSession(createMinimalF4tlConfig());

      await limitedManager.recordStep(createAction(), 'ss1', createMetadata(), 50);
      await limitedManager.recordStep(createAction(), 'ss2', createMetadata(), 50);

      await expect(
        limitedManager.recordStep(createAction(), 'ss3', createMetadata(), 50),
      ).rejects.toThrow('Session step limit reached (2)');
    });
  });

  describe('contextId tracking', () => {
    it('stores contextId on step when provided', async () => {
      manager.startSession(createMinimalF4tlConfig());
      const step = await manager.recordStep(
        createAction(),
        'screenshot',
        createMetadata(),
        100,
        undefined,
        'buyer',
      );
      expect(step.contextId).toBe('buyer');
    });

    it('omits contextId when not provided', async () => {
      manager.startSession(createMinimalF4tlConfig());
      const step = await manager.recordStep(createAction(), 'screenshot', createMetadata(), 100);
      expect(step.contextId).toBeUndefined();
    });

    it('includes contextId in step:recorded event', async () => {
      const listener = vi.fn();
      manager.on('step:recorded', listener);
      manager.startSession(createMinimalF4tlConfig());

      await manager.recordStep(
        createAction(),
        'screenshot',
        createMetadata(),
        100,
        undefined,
        'seller',
      );

      const event = listener.mock.calls[0][0];
      expect((event.data as any).step.contextId).toBe('seller');
    });

    it('tracks contexts and includes them in session on endSession', async () => {
      manager.startSession(createMinimalF4tlConfig());
      await manager.recordStep(createAction(), 'ss', createMetadata(), 50, undefined, 'buyer');
      await manager.recordStep(createAction(), 'ss', createMetadata(), 50, undefined, 'seller');
      await manager.recordStep(createAction(), 'ss', createMetadata(), 50, undefined, 'buyer');

      const session = await manager.endSession();
      expect(session.contexts).toBeDefined();
      expect(session.contexts).toHaveLength(2);
      expect(session.contexts).toContain('buyer');
      expect(session.contexts).toContain('seller');
    });

    it('omits contexts when no contextId was used', async () => {
      manager.startSession(createMinimalF4tlConfig());
      await manager.recordStep(createAction(), 'ss', createMetadata(), 50);
      const session = await manager.endSession();
      expect(session.contexts).toBeUndefined();
    });

    it('includes contextId in artifact JSON when keepArtifacts is true', async () => {
      const artifactManager = new SessionManager(createSessionConfig({ keepArtifacts: true }));
      artifactManager.startSession(createMinimalF4tlConfig());

      await artifactManager.recordStep(
        createAction(),
        'base64',
        createMetadata(),
        100,
        undefined,
        'admin',
      );

      // Find the JSON writeFile call (not the PNG one)
      const jsonCall = mockedWriteFile.mock.calls.find(
        (call) => typeof call[1] === 'string' && call[1].includes('"contextId"'),
      );
      expect(jsonCall).toBeDefined();
      const written = JSON.parse(jsonCall![1] as string);
      expect(written.contextId).toBe('admin');
    });
  });

  describe('endSession', () => {
    it('sets endTime and returns completed session', async () => {
      manager.startSession(createMinimalF4tlConfig());
      await manager.recordStep(createAction(), 'screenshot', createMetadata(), 100);

      const session = await manager.endSession();

      expect(session.endTime).toBeDefined();
      expect(session.endTime).toBeGreaterThan(0);
      expect(session.id).toBe('test-id-123');
      expect(session.steps).toHaveLength(1);
    });

    it('clears session after ending', async () => {
      manager.startSession(createMinimalF4tlConfig());
      await manager.endSession();
      expect(manager.getSession()).toBeNull();
    });

    it('throws when no session is active', async () => {
      await expect(manager.endSession()).rejects.toThrow('No active session');
    });
  });

  describe('events', () => {
    it('emits session:start on startSession', () => {
      const listener = vi.fn();
      manager.on('session:start', listener);

      manager.startSession(createMinimalF4tlConfig());

      expect(listener).toHaveBeenCalledOnce();
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('session:start');
      expect(event.sessionId).toBe('test-id-123');
      expect(event.data).toEqual({ sessionId: 'test-id-123' });
    });

    it('emits step:recorded on recordStep with screenshot omitted from payload', async () => {
      const listener = vi.fn();
      manager.on('step:recorded', listener);
      manager.startSession(createMinimalF4tlConfig());

      await manager.recordStep(createAction(), 'base64-data', createMetadata(), 150);

      expect(listener).toHaveBeenCalledOnce();
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('step:recorded');
      expect(event.sessionId).toBe('test-id-123');
      expect((event.data as any).step.screenshot).toBeUndefined();
      expect((event.data as any).stepIndex).toBe(0);
    });

    it('emits session:end on endSession', async () => {
      const listener = vi.fn();
      manager.on('session:end', listener);
      manager.startSession(createMinimalF4tlConfig());

      await manager.endSession();

      expect(listener).toHaveBeenCalledOnce();
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('session:end');
      expect(event.sessionId).toBe('test-id-123');
      expect((event.data as any).sessionId).toBe('test-id-123');
      expect((event.data as any).stepCount).toBe(0);
    });

    it('off removes a listener', async () => {
      const listener = vi.fn();
      manager.on('session:start', listener);
      manager.off('session:start', listener);

      manager.startSession(createMinimalF4tlConfig());

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('artifacts', () => {
    it('calls mkdir and writeFile when keepArtifacts is true', async () => {
      const artifactManager = new SessionManager(createSessionConfig({ keepArtifacts: true }));
      artifactManager.startSession(createMinimalF4tlConfig());

      await artifactManager.recordStep(createAction(), 'c2NyZWVuc2hvdA==', createMetadata(), 100);

      expect(mockedMkdir).toHaveBeenCalled();
      expect(mockedWriteFile).toHaveBeenCalled();
    });

    it('does not call mkdir or writeFile when keepArtifacts is false', async () => {
      const noArtifactManager = new SessionManager(createSessionConfig({ keepArtifacts: false }));
      noArtifactManager.startSession(createMinimalF4tlConfig());

      await noArtifactManager.recordStep(createAction(), 'screenshot', createMetadata(), 100);

      expect(mockedMkdir).not.toHaveBeenCalled();
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('writes session.json on endSession when keepArtifacts is true', async () => {
      const artifactManager = new SessionManager(createSessionConfig({ keepArtifacts: true }));
      artifactManager.startSession(createMinimalF4tlConfig());

      await artifactManager.endSession();

      expect(mockedMkdir).toHaveBeenCalled();
      // session.json should be written
      const writeFileCall = mockedWriteFile.mock.calls.find((call) =>
        String(call[0]).endsWith('session.json'),
      );
      expect(writeFileCall).toBeDefined();
    });
  });
});
