import {
  navigateSchema,
  clickSchema,
  fillSchema,
  scrollSchema,
  pressSchema,
} from '../../../src/server/tools/browser.js';
import {
  createBugSchema,
  addFindingSchema,
  generateReportSchema,
} from '../../../src/server/tools/report.js';
import { discoverSchema, fireSchema } from '../../../src/server/tools/webhook.js';
import {
  getHistorySchema,
  getBugsSchema,
  compareSchema,
} from '../../../src/server/tools/learning.js';

describe('navigateSchema', () => {
  it('accepts a valid URL', () => {
    const result = navigateSchema.parse({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
  });

  it('rejects an invalid URL', () => {
    expect(() => navigateSchema.parse({ url: 'not-a-url' })).toThrow();
  });

  it('defaults waitUntil to load', () => {
    const result = navigateSchema.parse({ url: 'https://example.com' });
    expect(result.waitUntil).toBe('load');
  });
});

describe('clickSchema', () => {
  it('accepts exactly one selector (css)', () => {
    const result = clickSchema.parse({ selector: { css: '.btn' } });
    expect(result.selector.css).toBe('.btn');
  });

  it('rejects empty selector object', () => {
    expect(() => clickSchema.parse({ selector: {} })).toThrow();
  });

  it('rejects multiple selectors', () => {
    expect(() => clickSchema.parse({ selector: { css: '.a', text: 'b' } })).toThrow();
  });
});

describe('fillSchema', () => {
  it('requires selector and value', () => {
    const result = fillSchema.parse({
      selector: { css: '#email' },
      value: 'test@example.com',
    });
    expect(result.value).toBe('test@example.com');
  });

  it('rejects missing value', () => {
    expect(() => fillSchema.parse({ selector: { css: '#email' } })).toThrow();
  });

  it('rejects missing selector', () => {
    expect(() => fillSchema.parse({ value: 'test' })).toThrow();
  });
});

describe('pressSchema', () => {
  it('requires key string', () => {
    const result = pressSchema.parse({ key: 'Enter' });
    expect(result.key).toBe('Enter');
  });

  it('rejects missing key', () => {
    expect(() => pressSchema.parse({})).toThrow();
  });
});

describe('scrollSchema', () => {
  it('makes selector optional', () => {
    const result = scrollSchema.parse({});
    expect(result.selector).toBeUndefined();
  });

  it('defaults x and y to 0', () => {
    const result = scrollSchema.parse({});
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('accepts selector with scroll amounts', () => {
    const result = scrollSchema.parse({
      selector: { css: '.container' },
      x: 100,
      y: 200,
    });
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });
});

describe('createBugSchema', () => {
  const validBug = {
    title: 'Test bug',
    severity: 'critical' as const,
    stepsToReproduce: ['Step 1'],
    expected: 'Expected',
    actual: 'Actual',
  };

  it.each(['critical', 'major', 'minor', 'cosmetic'] as const)(
    'accepts severity %s',
    (severity) => {
      expect(() => createBugSchema.parse({ ...validBug, severity })).not.toThrow();
    },
  );

  it('rejects invalid severity', () => {
    expect(() => createBugSchema.parse({ ...validBug, severity: 'blocker' })).toThrow();
  });
});

describe('addFindingSchema', () => {
  const validFinding = {
    title: 'Test finding',
    category: 'usability' as const,
    description: 'Some description',
  };

  it.each([
    'usability',
    'performance',
    'accessibility',
    'security',
    'suggestion',
    'observation',
  ] as const)('accepts category %s', (category) => {
    expect(() => addFindingSchema.parse({ ...validFinding, category })).not.toThrow();
  });

  it('rejects invalid category', () => {
    expect(() => addFindingSchema.parse({ ...validFinding, category: 'other' })).toThrow();
  });
});

describe('generateReportSchema', () => {
  it('defaults format to markdown', () => {
    const result = generateReportSchema.parse({});
    expect(result.format).toBe('markdown');
  });

  it.each(['markdown', 'json', 'html'] as const)('accepts format %s', (format) => {
    const result = generateReportSchema.parse({ format });
    expect(result.format).toBe(format);
  });

  it('rejects invalid format', () => {
    expect(() => generateReportSchema.parse({ format: 'csv' })).toThrow();
  });
});

// ── Webhook Schemas ──────────────────────────────────────────────────────────

describe('discoverSchema', () => {
  it('defaults refresh to false', () => {
    const result = discoverSchema.parse({});
    expect(result.refresh).toBe(false);
  });

  it('accepts refresh true', () => {
    const result = discoverSchema.parse({ refresh: true });
    expect(result.refresh).toBe(true);
  });
});

describe('fireSchema', () => {
  it('requires url and payload', () => {
    const result = fireSchema.parse({
      url: '/api/webhooks/stripe',
      payload: { type: 'test' },
    });
    expect(result.url).toBe('/api/webhooks/stripe');
    expect(result.payload).toEqual({ type: 'test' });
  });

  it('rejects missing url', () => {
    expect(() => fireSchema.parse({ payload: {} })).toThrow();
  });

  it('rejects missing payload', () => {
    expect(() => fireSchema.parse({ url: '/hook' })).toThrow();
  });

  it('accepts optional signing provider', () => {
    const result = fireSchema.parse({
      url: '/hook',
      payload: {},
      signing: 'stripe',
    });
    expect(result.signing).toBe('stripe');
  });

  it('accepts optional verifyUi', () => {
    const result = fireSchema.parse({
      url: '/hook',
      payload: {},
      verifyUi: { selector: '.status', expectedText: 'Paid', timeout: 3000 },
    });
    expect(result.verifyUi?.selector).toBe('.status');
    expect(result.verifyUi?.timeout).toBe(3000);
  });
});

// ── Learning Schemas ─────────────────────────────────────────────────────────

describe('getHistorySchema', () => {
  it('defaults limit to 20', () => {
    const result = getHistorySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it('accepts limit in range', () => {
    const result = getHistorySchema.parse({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  it('rejects limit > 100', () => {
    expect(() => getHistorySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects limit < 1', () => {
    expect(() => getHistorySchema.parse({ limit: 0 })).toThrow();
  });

  it.each(['url', 'actionType', 'context'] as const)('accepts groupBy %s', (groupBy) => {
    const result = getHistorySchema.parse({ groupBy });
    expect(result.groupBy).toBe(groupBy);
  });

  it('rejects invalid groupBy', () => {
    expect(() => getHistorySchema.parse({ groupBy: 'invalid' })).toThrow();
  });
});

describe('getBugsSchema', () => {
  it('defaults limit to 50', () => {
    const result = getBugsSchema.parse({});
    expect(result.limit).toBe(50);
  });

  it.each(['critical', 'major', 'minor', 'cosmetic'] as const)(
    'accepts severity %s',
    (severity) => {
      const result = getBugsSchema.parse({ severity });
      expect(result.severity).toBe(severity);
    },
  );

  it('rejects invalid severity', () => {
    expect(() => getBugsSchema.parse({ severity: 'blocker' })).toThrow();
  });

  it('rejects limit > 200', () => {
    expect(() => getBugsSchema.parse({ limit: 201 })).toThrow();
  });
});

describe('compareSchema', () => {
  it('requires both session IDs', () => {
    const result = compareSchema.parse({ sessionA: 'a', sessionB: 'b' });
    expect(result.sessionA).toBe('a');
    expect(result.sessionB).toBe('b');
  });

  it('rejects missing sessionA', () => {
    expect(() => compareSchema.parse({ sessionB: 'b' })).toThrow();
  });

  it('rejects missing sessionB', () => {
    expect(() => compareSchema.parse({ sessionA: 'a' })).toThrow();
  });
});
