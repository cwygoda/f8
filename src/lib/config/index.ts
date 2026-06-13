import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse as parseToml } from 'smol-toml';
import { ZodError } from 'zod';

import { f8ConfigSchema, type F8Config } from './schema.js';

export { f8ConfigSchema } from './schema.js';
export type {
  F8Config,
  F8GalleryConfig,
  F8ImageConfig,
  F8SiteConfig,
  F8ViewerConfig
} from './schema.js';

export const DEFAULT_CONFIG_FILE = 'f8.config.toml';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export interface LoadConfigOptions {
  cwd?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  overrides?: DeepPartial<F8Config>;
}

export interface LoadConfigResult {
  config: F8Config;
  path?: string;
}

export class F8ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'F8ConfigError';
  }
}

export function loadConfig(options: LoadConfigOptions = {}): LoadConfigResult {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath ?? DEFAULT_CONFIG_FILE);
  const env = options.env ?? process.env;

  const fileConfig = existsSync(configPath) ? readTomlConfig(configPath) : {};
  const envConfig = configFromEnv(env);
  const merged = deepMerge(fileConfig, envConfig, options.overrides ?? {});

  try {
    const config = f8ConfigSchema.parse(merged);

    if (existsSync(configPath)) {
      return { config, path: configPath };
    }

    return { config };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new F8ConfigError(formatZodError(error), { cause: error });
    }

    throw error;
  }
}

function readTomlConfig(path: string): Record<string, unknown> {
  try {
    return parseToml(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    throw new F8ConfigError(`Failed to read ${path}: ${formatCause(error)}`, {
      cause: error
    });
  }
}

function configFromEnv(env: NodeJS.ProcessEnv): DeepPartial<F8Config> {
  const config: DeepPartial<F8Config> = {};

  assignString(config, 'contentDir', env.F8_CONTENT_DIR);
  assignString(config, 'imageDir', env.F8_IMAGE_DIR);
  assignString(config, 'outputDir', env.F8_OUTPUT_DIR);
  assignString(config, 'cacheDir', env.F8_CACHE_DIR);

  if (env.F8_SITE_TITLE !== undefined && env.F8_SITE_TITLE.length > 0) {
    config.site = { ...(config.site ?? {}), title: env.F8_SITE_TITLE };
  }

  if (env.F8_SITE_URL !== undefined && env.F8_SITE_URL.length > 0) {
    config.site = { ...(config.site ?? {}), url: env.F8_SITE_URL };
  }

  const enableMap = parseBooleanEnv('F8_ENABLE_MAP', env.F8_ENABLE_MAP);
  if (enableMap !== undefined) {
    config.viewer = { ...(config.viewer ?? {}), enableMap };
  }

  const enableExifOverlay = parseBooleanEnv(
    'F8_ENABLE_EXIF_OVERLAY',
    env.F8_ENABLE_EXIF_OVERLAY
  );
  if (enableExifOverlay !== undefined) {
    config.viewer = { ...(config.viewer ?? {}), enableExifOverlay };
  }

  return config;
}

function assignString<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string | undefined
): void {
  if (value !== undefined && value.length > 0) {
    target[key] = value as T[K];
  }
}

function parseBooleanEnv(
  name: string,
  value: string | undefined
): boolean | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) {
    return false;
  }

  throw new F8ConfigError(`${name} must be a boolean-like value.`);
}

function deepMerge(
  ...values: Array<Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const value of values) {
    for (const [key, entry] of Object.entries(value)) {
      const existing = result[key];
      if (isPlainObject(existing) && isPlainObject(entry)) {
        result[key] = deepMerge(existing, entry);
      } else if (entry !== undefined) {
        result[key] = entry;
      }
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatZodError(error: ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
      return `${path}: ${issue.message}`;
    })
    .join('\n');

  return `Invalid f8 configuration:\n${issues}`;
}

function formatCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
