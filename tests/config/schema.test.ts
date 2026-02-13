import {
  configSchema,
  browserConfigSchema,
  sessionConfigSchema,
  captureConfigSchema,
  mcpConfigSchema,
  databaseConfigSchema,
  codebaseConfigSchema,
  reportConfigSchema,
  dashboardConfigSchema,
} from '../../src/config/schema.js';

describe('configSchema', () => {
  it('produces all defaults from empty object', () => {
    const result = configSchema.parse({});
    expect(result.browser.headless).toBe(true);
    expect(result.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(result.browser.slowMo).toBe(0);
    expect(result.browser.timeout).toBe(30_000);
  });

  it('merges partial overrides correctly', () => {
    const result = configSchema.parse({
      browser: { headless: false, viewport: { width: 800, height: 600 } },
      mcp: { logLevel: 'debug' },
    });
    expect(result.browser.headless).toBe(false);
    expect(result.browser.viewport).toEqual({ width: 800, height: 600 });
    // Non-overridden defaults still present
    expect(result.browser.slowMo).toBe(0);
    expect(result.browser.timeout).toBe(30_000);
    expect(result.mcp.logLevel).toBe('debug');
    expect(result.mcp.name).toBe('f4tl');
  });
});

describe('sessionConfigSchema', () => {
  it('produces correct defaults', () => {
    const result = sessionConfigSchema.parse({});
    expect(result.outputDir).toBe('.f4tl/sessions');
    expect(result.maxSteps).toBe(1000);
    expect(result.keepArtifacts).toBe(true);
  });
});

describe('captureConfigSchema', () => {
  it('produces correct defaults', () => {
    const result = captureConfigSchema.parse({});
    expect(result.format).toBe('png');
    expect(result.quality).toBe(90);
    expect(result.fullPage).toBe(false);
  });

  it('accepts png format', () => {
    expect(() => captureConfigSchema.parse({ format: 'png' })).not.toThrow();
  });

  it('accepts jpeg format', () => {
    expect(() => captureConfigSchema.parse({ format: 'jpeg' })).not.toThrow();
  });

  it('rejects bmp format', () => {
    expect(() => captureConfigSchema.parse({ format: 'bmp' })).toThrow();
  });
});

describe('mcpConfigSchema', () => {
  it('produces correct defaults', () => {
    const result = mcpConfigSchema.parse({});
    expect(result.name).toBe('f4tl');
    expect(result.version).toBe('0.1.0');
    expect(result.logLevel).toBe('info');
  });

  it.each(['debug', 'info', 'warn', 'error'] as const)('accepts logLevel %s', (level) => {
    expect(() => mcpConfigSchema.parse({ logLevel: level })).not.toThrow();
  });

  it('rejects trace logLevel', () => {
    expect(() => mcpConfigSchema.parse({ logLevel: 'trace' })).toThrow();
  });
});

describe('reportConfigSchema', () => {
  it('produces correct defaults', () => {
    const result = reportConfigSchema.parse({});
    expect(result.outputDir).toBe('.f4tl/reports');
  });
});

describe('dashboardConfigSchema', () => {
  it('produces correct defaults', () => {
    const result = dashboardConfigSchema.parse({});
    expect(result.port).toBe(4173);
    expect(result.host).toBe('localhost');
  });
});

describe('browserConfigSchema', () => {
  describe('viewport boundaries', () => {
    it('accepts width 320', () => {
      expect(() =>
        browserConfigSchema.parse({ viewport: { width: 320, height: 480 } }),
      ).not.toThrow();
    });

    it('rejects width 319', () => {
      expect(() => browserConfigSchema.parse({ viewport: { width: 319, height: 480 } })).toThrow();
    });

    it('accepts width 3840', () => {
      expect(() =>
        browserConfigSchema.parse({ viewport: { width: 3840, height: 480 } }),
      ).not.toThrow();
    });

    it('rejects width 3841', () => {
      expect(() => browserConfigSchema.parse({ viewport: { width: 3841, height: 480 } })).toThrow();
    });
  });

  describe('timeout boundaries', () => {
    it('accepts timeout 1000', () => {
      expect(() => browserConfigSchema.parse({ timeout: 1000 })).not.toThrow();
    });

    it('rejects timeout 999', () => {
      expect(() => browserConfigSchema.parse({ timeout: 999 })).toThrow();
    });

    it('accepts timeout 120000', () => {
      expect(() => browserConfigSchema.parse({ timeout: 120_000 })).not.toThrow();
    });

    it('rejects timeout 120001', () => {
      expect(() => browserConfigSchema.parse({ timeout: 120_001 })).toThrow();
    });
  });
});

describe('databaseConfigSchema', () => {
  describe('port boundaries', () => {
    it('accepts port 1', () => {
      expect(() => databaseConfigSchema.parse({ port: 1 })).not.toThrow();
    });

    it('rejects port 0', () => {
      expect(() => databaseConfigSchema.parse({ port: 0 })).toThrow();
    });

    it('accepts port 65535', () => {
      expect(() => databaseConfigSchema.parse({ port: 65535 })).not.toThrow();
    });

    it('rejects port 65536', () => {
      expect(() => databaseConfigSchema.parse({ port: 65536 })).toThrow();
    });
  });
});

describe('codebaseConfigSchema', () => {
  it('default excludePatterns includes node_modules, .git, dist', () => {
    const result = codebaseConfigSchema.parse({});
    expect(result.excludePatterns).toContain('node_modules');
    expect(result.excludePatterns).toContain('.git');
    expect(result.excludePatterns).toContain('dist');
  });
});
