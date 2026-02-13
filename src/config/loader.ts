import { loadConfig } from 'c12';
import { configSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { F4tlConfig } from '../types/index.js';

export async function loadF4tlConfig(overrides?: Record<string, unknown>): Promise<F4tlConfig> {
  const { config: rawConfig } = await loadConfig({
    name: 'f4tl',
    defaults: DEFAULT_CONFIG as unknown as Record<string, unknown>,
    overrides: overrides ?? {},
  });

  return configSchema.parse(rawConfig) as F4tlConfig;
}

export function defineConfig(config: Partial<F4tlConfig>): Partial<F4tlConfig> {
  return config;
}
