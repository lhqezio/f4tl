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
  webhookConfigSchema,
  learningConfigSchema,
  appConfigSchema,
  authConfigSchema,
  journeysConfigSchema,
  journeySchema,
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

  it('accepts suppressErrors with patterns', () => {
    const result = captureConfigSchema.parse({
      suppressErrors: {
        console: ['React warning', 'DevTools'],
        network: ['analytics\\.google'],
      },
    });
    expect(result.suppressErrors?.console).toEqual(['React warning', 'DevTools']);
    expect(result.suppressErrors?.network).toEqual(['analytics\\.google']);
  });

  it('defaults suppressErrors arrays when provided empty', () => {
    const result = captureConfigSchema.parse({ suppressErrors: {} });
    expect(result.suppressErrors?.console).toEqual([]);
    expect(result.suppressErrors?.network).toEqual([]);
  });

  it('makes suppressErrors optional', () => {
    const result = captureConfigSchema.parse({});
    expect(result.suppressErrors).toBeUndefined();
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

describe('webhookConfigSchema', () => {
  it('defaults baseUrl to localhost:3000', () => {
    const result = webhookConfigSchema.parse({});
    expect(result.baseUrl).toBe('http://localhost:3000');
  });

  it('accepts custom baseUrl', () => {
    const result = webhookConfigSchema.parse({ baseUrl: 'http://app:8080' });
    expect(result.baseUrl).toBe('http://app:8080');
  });

  it('accepts signingSecrets', () => {
    const result = webhookConfigSchema.parse({
      signingSecrets: { stripe: 'whsec_xxx', github: 'ghsec_yyy' },
    });
    expect(result.signingSecrets?.stripe).toBe('whsec_xxx');
  });

  it('makes signingSecrets optional', () => {
    const result = webhookConfigSchema.parse({});
    expect(result.signingSecrets).toBeUndefined();
  });
});

describe('learningConfigSchema', () => {
  it('defaults enabled to true', () => {
    const result = learningConfigSchema.parse({});
    expect(result.enabled).toBe(true);
  });

  it('accepts enabled false', () => {
    const result = learningConfigSchema.parse({ enabled: false });
    expect(result.enabled).toBe(false);
  });
});

describe('appConfigSchema', () => {
  it('requires baseUrl', () => {
    expect(() => appConfigSchema.parse({})).toThrow();
  });

  it('accepts minimal config with just baseUrl', () => {
    const result = appConfigSchema.parse({ baseUrl: 'http://localhost:3000' });
    expect(result.baseUrl).toBe('http://localhost:3000');
    expect(result.name).toBeUndefined();
    expect(result.pages).toBeUndefined();
  });

  it('accepts full config with pages', () => {
    const result = appConfigSchema.parse({
      name: 'My App',
      baseUrl: 'http://localhost:3000',
      description: 'E-commerce platform',
      pages: [
        { path: '/login', label: 'Login', priority: 'high' },
        { path: '/dashboard', auth: 'admin' },
        { path: '/products' },
      ],
      ignorePatterns: ['/api/health', '/static/*'],
    });
    expect(result.name).toBe('My App');
    expect(result.pages).toHaveLength(3);
    expect(result.pages![0].priority).toBe('high');
    expect(result.pages![1].auth).toBe('admin');
    expect(result.pages![2].priority).toBe('medium'); // default
    expect(result.ignorePatterns).toEqual(['/api/health', '/static/*']);
  });

  it('rejects invalid baseUrl', () => {
    expect(() => appConfigSchema.parse({ baseUrl: 'not-a-url' })).toThrow();
  });

  it('defaults page priority to medium', () => {
    const result = appConfigSchema.parse({
      baseUrl: 'http://localhost:3000',
      pages: [{ path: '/home' }],
    });
    expect(result.pages![0].priority).toBe('medium');
  });

  it('is optional in root configSchema', () => {
    const result = configSchema.parse({});
    expect(result.app).toBeUndefined();
  });

  it('is included in root configSchema when provided', () => {
    const result = configSchema.parse({
      app: { baseUrl: 'http://localhost:3000', name: 'Test App' },
    });
    expect(result.app?.name).toBe('Test App');
    expect(result.app?.baseUrl).toBe('http://localhost:3000');
  });
});

describe('authConfigSchema', () => {
  it('accepts jwt strategy with defaults', () => {
    const result = authConfigSchema.parse({
      strategy: 'jwt',
      jwt: { tokenEnv: 'JWT_TOKEN' },
    });
    expect(result.strategy).toBe('jwt');
    expect(result.jwt?.storageKey).toBe('token');
    expect(result.jwt?.storageType).toBe('localStorage');
  });

  it('accepts jwt strategy with custom storage', () => {
    const result = authConfigSchema.parse({
      strategy: 'jwt',
      jwt: { tokenEnv: 'AUTH_TOKEN', storageKey: 'auth', storageType: 'sessionStorage' },
    });
    expect(result.jwt?.storageKey).toBe('auth');
    expect(result.jwt?.storageType).toBe('sessionStorage');
  });

  it('accepts jwt with cookie storage type', () => {
    const result = authConfigSchema.parse({
      strategy: 'jwt',
      jwt: { tokenEnv: 'TOKEN', storageType: 'cookie' },
    });
    expect(result.jwt?.storageType).toBe('cookie');
  });

  it('accepts oauth strategy', () => {
    const result = authConfigSchema.parse({
      strategy: 'oauth',
      oauth: {
        provider: 'github',
        authUrl: 'https://github.com/login/oauth/authorize',
        clientIdEnv: 'GITHUB_CLIENT_ID',
        callbackUrl: 'http://localhost:3000/auth/callback',
      },
    });
    expect(result.strategy).toBe('oauth');
    expect(result.oauth?.provider).toBe('github');
  });

  it('still accepts form strategy', () => {
    const result = authConfigSchema.parse({
      strategy: 'form',
      formLogin: {
        loginUrl: '/login',
        usernameSelector: '#email',
        passwordSelector: '#password',
        submitSelector: 'button[type=submit]',
        usernameEnv: 'USER',
        passwordEnv: 'PASS',
      },
    });
    expect(result.strategy).toBe('form');
  });

  it('rejects unknown strategy', () => {
    expect(() => authConfigSchema.parse({ strategy: 'magic' })).toThrow();
  });
});

describe('journeySchema', () => {
  it('accepts a guided journey with steps', () => {
    const result = journeySchema.parse({
      description: 'Login flow',
      steps: [
        { action: 'navigate', target: '/login' },
        { action: 'fill', target: '#email', value: 'test@test.com' },
      ],
    });
    expect(result.mode).toBe('guided');
    expect(result.steps).toHaveLength(2);
  });

  it('accepts autonomous mode', () => {
    const result = journeySchema.parse({
      description: 'Explore',
      mode: 'autonomous',
      steps: [{ action: 'navigate', target: '/products' }],
    });
    expect(result.mode).toBe('autonomous');
  });

  it('accepts auth and dependsOn', () => {
    const result = journeySchema.parse({
      description: 'Checkout',
      auth: 'buyer',
      dependsOn: ['login'],
      steps: [{ action: 'click', target: '#pay' }],
    });
    expect(result.auth).toBe('buyer');
    expect(result.dependsOn).toEqual(['login']);
  });

  it('requires description and steps', () => {
    expect(() => journeySchema.parse({})).toThrow();
    expect(() => journeySchema.parse({ description: 'No steps' })).toThrow();
  });
});

describe('journeysConfigSchema', () => {
  it('accepts a record of journeys', () => {
    const result = journeysConfigSchema.parse({
      login: {
        description: 'Login',
        steps: [{ action: 'navigate', target: '/login' }],
      },
      checkout: {
        description: 'Checkout',
        dependsOn: ['login'],
        steps: [{ action: 'click', target: '#buy' }],
      },
    });
    expect(Object.keys(result)).toEqual(['login', 'checkout']);
  });

  it('is optional in root configSchema', () => {
    const result = configSchema.parse({});
    expect(result.journeys).toBeUndefined();
  });

  it('is included in root configSchema when provided', () => {
    const result = configSchema.parse({
      journeys: {
        test: {
          description: 'Test journey',
          steps: [{ action: 'navigate', target: '/' }],
        },
      },
    });
    expect(result.journeys?.test.description).toBe('Test journey');
  });
});
