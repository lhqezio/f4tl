import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from '../../src/core/zod-to-json-schema.js';

describe('zodToJsonSchema', () => {
  it('converts ZodString to JSON Schema', () => {
    const schema = z.string();
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string' });
  });

  it('converts ZodString with constraints', () => {
    const schema = z.string().min(1).max(100);
    const result = zodToJsonSchema(schema);
    expect(result.type).toBe('string');
    expect(result.minLength).toBe(1);
    expect(result.maxLength).toBe(100);
  });

  it('converts ZodString url format', () => {
    const schema = z.string().url();
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string', format: 'uri' });
  });

  it('converts ZodNumber', () => {
    expect(zodToJsonSchema(z.number())).toEqual({ type: 'number' });
  });

  it('converts ZodNumber with int', () => {
    const schema = z.number().int().min(0).max(100);
    const result = zodToJsonSchema(schema);
    expect(result.type).toBe('integer');
    expect(result.minimum).toBe(0);
    expect(result.maximum).toBe(100);
  });

  it('converts ZodBoolean', () => {
    expect(zodToJsonSchema(z.boolean())).toEqual({ type: 'boolean' });
  });

  it('converts ZodEnum', () => {
    const schema = z.enum(['a', 'b', 'c']);
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string', enum: ['a', 'b', 'c'] });
  });

  it('converts ZodLiteral', () => {
    expect(zodToJsonSchema(z.literal('hello'))).toEqual({ type: 'string', const: 'hello' });
  });

  it('converts ZodArray', () => {
    const schema = z.array(z.string());
    expect(zodToJsonSchema(schema)).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('converts ZodObject with required and optional fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      active: z.boolean().default(true),
    });
    const result = zodToJsonSchema(schema);
    expect(result.type).toBe('object');
    expect(result.properties).toBeDefined();
    expect(result.required).toEqual(['name']);
    expect((result.properties as Record<string, unknown>).name).toEqual({ type: 'string' });
    expect((result.properties as Record<string, unknown>).active).toEqual({
      type: 'boolean',
      default: true,
    });
  });

  it('handles ZodDefault', () => {
    const schema = z.string().default('hello');
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string', default: 'hello' });
  });

  it('handles ZodOptional', () => {
    const schema = z.string().optional();
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string' });
  });

  it('handles ZodEffects (.refine)', () => {
    const schema = z.string().refine((s) => s.length > 0);
    expect(zodToJsonSchema(schema)).toEqual({ type: 'string' });
  });

  it('handles ZodUnion', () => {
    const schema = z.union([z.string(), z.number()]);
    expect(zodToJsonSchema(schema)).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    });
  });

  it('handles ZodRecord', () => {
    const schema = z.record(z.string(), z.number());
    expect(zodToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: { type: 'number' },
    });
  });

  it('handles nested objects', () => {
    const schema = z.object({
      viewport: z.object({
        width: z.number(),
        height: z.number(),
      }),
    });
    const result = zodToJsonSchema(schema);
    const viewport = (result.properties as Record<string, Record<string, unknown>>).viewport;
    expect(viewport.type).toBe('object');
    expect(viewport.required).toEqual(['width', 'height']);
  });

  it('preserves .describe() as description', () => {
    const schema = z.object({
      url: z.string().describe('The URL to navigate to'),
    });
    const result = zodToJsonSchema(schema);
    const url = (result.properties as Record<string, Record<string, unknown>>).url;
    expect(url.description).toBe('The URL to navigate to');
  });

  it('converts actual browser navigate schema', () => {
    const navigateSchema = z.object({
      url: z.string().url().describe('URL to navigate to'),
      waitUntil: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .default('load')
        .describe('When to consider navigation complete'),
      context: z.string().optional().describe('Browser context to use'),
    });
    const result = zodToJsonSchema(navigateSchema);
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['url']);
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.url.type).toBe('string');
    expect(props.url.format).toBe('uri');
    expect(props.waitUntil.default).toBe('load');
  });
});
