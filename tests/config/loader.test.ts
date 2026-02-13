import { ZodError } from 'zod';
import { configSchema } from '../../src/config/schema.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

vi.mock('c12', () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from 'c12';
import { loadF4tlConfig, defineConfig } from '../../src/config/loader.js';

const mockedLoadConfig = vi.mocked(loadConfig);

describe('defineConfig', () => {
  it('returns its input unchanged', () => {
    const partial = { browser: { headless: false } } as any;
    const result = defineConfig(partial);
    expect(result).toBe(partial);
  });
});

describe('loadF4tlConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls c12 loadConfig with correct arguments', async () => {
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_CONFIG as unknown as Record<string, unknown>,
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    await loadF4tlConfig();

    expect(mockedLoadConfig).toHaveBeenCalledOnce();
    expect(mockedLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'f4tl',
        defaults: DEFAULT_CONFIG as unknown as Record<string, unknown>,
        overrides: {},
      }),
    );
  });

  it('validates result through Zod schema', async () => {
    const rawConfig = {
      browser: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        slowMo: 0,
        timeout: 30_000,
        devtools: false,
        args: [],
      },
      session: {
        outputDir: '.f4tl/sessions',
        maxSteps: 1000,
        keepArtifacts: true,
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
        excludePatterns: ['node_modules'],
      },
      report: {
        outputDir: '.f4tl/reports',
      },
      dashboard: {
        port: 4173,
        host: 'localhost',
      },
    };

    mockedLoadConfig.mockResolvedValue({
      config: rawConfig,
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    const result = await loadF4tlConfig();
    // Verify it went through Zod: result should match the schema output
    const expected = configSchema.parse(rawConfig);
    expect(result).toEqual(expected);
  });

  it('returns correct defaults when c12 returns valid config shape', async () => {
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_CONFIG as unknown as Record<string, unknown>,
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    const result = await loadF4tlConfig();

    expect(result.browser.headless).toBe(true);
    expect(result.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(result.session.outputDir).toBe('.f4tl/sessions');
    expect(result.session.maxSteps).toBe(1000);
    expect(result.capture.format).toBe('png');
    expect(result.mcp.name).toBe('f4tl');
    expect(result.report.outputDir).toBe('.f4tl/reports');
    expect(result.dashboard.port).toBe(4173);
  });

  it('throws ZodError when c12 returns invalid config', async () => {
    mockedLoadConfig.mockResolvedValue({
      config: {
        browser: {
          headless: 'not-a-boolean',
          viewport: { width: -1, height: -1 },
        },
      },
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    await expect(loadF4tlConfig()).rejects.toThrow(ZodError);
  });

  it('passes overrides through to c12', async () => {
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_CONFIG as unknown as Record<string, unknown>,
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    const overrides = { browser: { headless: false } };
    await loadF4tlConfig(overrides);

    expect(mockedLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides,
      }),
    );
  });

  it('passes empty overrides object when none provided', async () => {
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_CONFIG as unknown as Record<string, unknown>,
      cwd: '',
      configFile: '',
      layers: [],
    } as any);

    await loadF4tlConfig();

    expect(mockedLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: {},
      }),
    );
  });
});
