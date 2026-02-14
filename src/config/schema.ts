import { z } from 'zod';

export const browserConfigSchema = z.object({
  headless: z.boolean().default(true),
  viewport: z
    .object({
      width: z.number().int().min(320).max(3840),
      height: z.number().int().min(240).max(2160),
    })
    .default({ width: 1280, height: 720 }),
  slowMo: z.number().int().min(0).max(5000).default(0),
  timeout: z.number().int().min(1000).max(120_000).default(30_000),
  devtools: z.boolean().default(false),
  args: z.array(z.string()).default([]),
});

export const sessionConfigSchema = z.object({
  outputDir: z.string().default('.f4tl/sessions'),
  maxSteps: z.number().int().min(10).max(10_000).default(1000),
  keepArtifacts: z.boolean().default(true),
});

export const captureConfigSchema = z.object({
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().int().min(1).max(100).default(90),
  fullPage: z.boolean().default(false),
  animations: z.enum(['disabled', 'allow']).default('disabled'),
  suppressErrors: z
    .object({
      console: z.array(z.string()).default([]),
      network: z.array(z.string()).default([]),
    })
    .optional(),
});

export const mcpConfigSchema = z.object({
  name: z.string().default('f4tl'),
  version: z.string().default('0.1.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const logSourceConfigSchema = z.object({
  type: z.enum(['process', 'file']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  path: z.string().optional(),
  parser: z.enum(['json', 'clf', 'plain']).default('plain'),
});

export const databaseConfigSchema = z.object({
  type: z.literal('postgres').default('postgres'),
  connectionString: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  allowedTables: z.array(z.string()).optional(),
  maxConnections: z.number().int().min(1).max(20).default(3),
  queryTimeout: z.number().int().min(1000).max(60_000).default(10_000),
});

export const codebaseConfigSchema = z.object({
  projectRoot: z.string().default(process.cwd()),
  excludePatterns: z
    .array(z.string())
    .default(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', '.f4tl']),
});

const authFormLoginSchema = z.object({
  loginUrl: z.string(),
  usernameSelector: z.string(),
  passwordSelector: z.string(),
  submitSelector: z.string(),
  usernameEnv: z.string(),
  passwordEnv: z.string(),
});

const authJwtSchema = z.object({
  tokenEnv: z.string(),
  storageKey: z.string().default('token'),
  storageType: z.enum(['localStorage', 'sessionStorage', 'cookie']).default('localStorage'),
});

const authOauthSchema = z.object({
  provider: z.string(),
  authUrl: z.string(),
  clientIdEnv: z.string(),
  callbackUrl: z.string(),
});

export const authConfigSchema = z.object({
  strategy: z.enum(['form', 'cookie', 'storage-state', 'custom', 'jwt', 'oauth']),
  formLogin: authFormLoginSchema.optional(),
  cookies: z
    .object({
      domain: z.string(),
      items: z.array(z.object({ name: z.string(), valueEnv: z.string() })),
    })
    .optional(),
  storageStatePath: z.string().optional(),
  customScriptPath: z.string().optional(),
  jwt: authJwtSchema.optional(),
  oauth: authOauthSchema.optional(),
});

export const reportConfigSchema = z.object({
  outputDir: z.string().default('.f4tl/reports'),
});

export const dashboardConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(4173),
  host: z.string().default('localhost'),
});

export const webhookConfigSchema = z.object({
  signingSecrets: z.record(z.string(), z.string()).optional(),
  baseUrl: z.string().default('http://localhost:3000'),
});

export const journeyStepSchema = z.object({
  action: z.string(),
  target: z.string().optional(),
  value: z.string().optional(),
  expect: z.string().optional(),
  note: z.string().optional(),
});

export const journeySchema = z.object({
  description: z.string(),
  auth: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  mode: z.enum(['guided', 'autonomous']).default('guided'),
  steps: z.array(journeyStepSchema),
});

export const journeysConfigSchema = z.record(z.string(), journeySchema);

export const appPageSchema = z.object({
  path: z.string(),
  label: z.string().optional(),
  auth: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

export const appConfigSchema = z.object({
  name: z.string().optional(),
  baseUrl: z.string().url(),
  description: z.string().optional(),
  pages: z.array(appPageSchema).optional(),
  ignorePatterns: z.array(z.string()).optional(),
});

export const learningConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

export const agentConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default('claude-sonnet-4-20250514'),
  maxTurns: z.number().int().min(1).max(500).default(50),
  systemPrompt: z.string().optional(),
});

export const configSchema = z.object({
  browser: browserConfigSchema.default({}),
  session: sessionConfigSchema.default({}),
  capture: captureConfigSchema.default({}),
  mcp: mcpConfigSchema.default({}),
  auth: z.record(z.string(), authConfigSchema).optional(),
  logs: z.record(z.string(), logSourceConfigSchema).optional(),
  database: databaseConfigSchema.optional(),
  codebase: codebaseConfigSchema.default({}),
  report: reportConfigSchema.default({}),
  dashboard: dashboardConfigSchema.default({}),
  webhooks: webhookConfigSchema.optional(),
  learning: learningConfigSchema.optional(),
  app: appConfigSchema.optional(),
  journeys: journeysConfigSchema.optional(),
  agent: agentConfigSchema.optional(),
});

export type ValidatedConfig = z.infer<typeof configSchema>;
