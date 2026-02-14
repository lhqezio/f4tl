import type { ZodTypeAny } from 'zod';

/**
 * Convert a Zod schema to JSON Schema for the Anthropic tools API.
 * Handles common types: object, string, number, boolean, enum, array,
 * optional, default, effects (.refine/.transform), union, record, literal.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convertSchema(schema);
}

function convertSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  const typeName: string = def.typeName;

  switch (typeName) {
    case 'ZodObject':
      return convertObject(schema);
    case 'ZodString':
      return convertString(def);
    case 'ZodNumber':
      return convertNumber(def);
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodLiteral':
      return { type: typeof def.value, const: def.value };
    case 'ZodArray':
      return { type: 'array', items: convertSchema(def.type) };
    case 'ZodOptional':
      return convertSchema(def.innerType);
    case 'ZodDefault':
      return { ...convertSchema(def.innerType), default: def.defaultValue() };
    case 'ZodEffects':
      // .refine() / .transform() — unwrap to inner type
      return convertSchema(def.schema);
    case 'ZodUnion':
      return { anyOf: def.options.map((opt: ZodTypeAny) => convertSchema(opt)) };
    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: convertSchema(def.valueType),
      };
    case 'ZodNullable': {
      const inner = convertSchema(def.innerType);
      return { anyOf: [inner, { type: 'null' }] };
    }
    default:
      // Fallback for unknown types
      return {};
  }
}

function convertObject(schema: ZodTypeAny): Record<string, unknown> {
  const shape = schema._def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const fieldSchema = value as ZodTypeAny;
    properties[key] = convertSchema(fieldSchema);

    // Add description from .describe()
    if (fieldSchema._def.description) {
      (properties[key] as Record<string, unknown>).description = fieldSchema._def.description;
    }

    // Check if field is required (not optional and not default)
    if (!isOptional(fieldSchema)) {
      required.push(key);
    }
  }

  const result: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

function isOptional(schema: ZodTypeAny): boolean {
  const typeName = schema._def.typeName;
  if (typeName === 'ZodOptional') return true;
  if (typeName === 'ZodDefault') return true;
  if (typeName === 'ZodEffects') return isOptional(schema._def.schema);
  return false;
}

function convertString(def: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'string' };
  const checks = def.checks as Array<{ kind: string; value?: unknown }> | undefined;
  if (checks) {
    for (const check of checks) {
      if (check.kind === 'min') result.minLength = check.value;
      if (check.kind === 'max') result.maxLength = check.value;
      if (check.kind === 'url') result.format = 'uri';
      if (check.kind === 'email') result.format = 'email';
    }
  }
  return result;
}

function convertNumber(def: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'number' };
  const checks = def.checks as
    | Array<{ kind: string; value?: unknown; inclusive?: boolean }>
    | undefined;
  if (checks) {
    for (const check of checks) {
      if (check.kind === 'int') result.type = 'integer';
      if (check.kind === 'min') result.minimum = check.value;
      if (check.kind === 'max') result.maximum = check.value;
    }
  }
  return result;
}
