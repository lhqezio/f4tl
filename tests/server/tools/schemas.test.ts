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
