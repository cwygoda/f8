import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse as parseToml } from 'smol-toml';
import { ZodError } from 'zod';

import { isF8CaptionAlign, type F8CaptionAlign } from '../types.js';
import { f8ConfigSchema, type F8Config } from './schema.js';

export { f8ConfigSchema } from './schema.js';
export type {
  F8Config,
  F8GalleryConfig,
  F8ImageConfig,
  F8PrivacyConfig,
  F8SecurityConfig,
  F8SiteConfig,
  F8ViewerConfig
} from './schema.js';

export const DEFAULT_CONFIG_FILE = '.f8.toml';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

type ViewerBooleanKey = Extract<
  {
    [K in keyof F8Config['viewer']]: F8Config['viewer'][K] extends boolean
      ? K
      : never;
  }[keyof F8Config['viewer']],
  string
>;

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
  assignString(config, 'outputDir', env.F8_OUTPUT_DIR);
  assignString(config, 'cacheDir', env.F8_CACHE_DIR);
  assignSiteEnv(config, env);
  assignViewerEnv(config, env);
  assignPrivacyEnv(config, env);
  assignSecurityEnv(config, env);

  return config;
}

function assignSiteEnv(
  config: DeepPartial<F8Config>,
  env: NodeJS.ProcessEnv
): void {
  if (env.F8_SITE_TITLE !== undefined && env.F8_SITE_TITLE.length > 0) {
    config.site = { ...(config.site ?? {}), title: env.F8_SITE_TITLE };
  }

  if (env.F8_SITE_URL !== undefined && env.F8_SITE_URL.length > 0) {
    config.site = { ...(config.site ?? {}), url: env.F8_SITE_URL };
  }
}

function assignViewerEnv(
  config: DeepPartial<F8Config>,
  env: NodeJS.ProcessEnv
): void {
  assignViewerBoolean(config, 'enableMap', 'F8_ENABLE_MAP', env.F8_ENABLE_MAP);
  assignViewerBoolean(
    config,
    'enableMapZoom',
    'F8_ENABLE_MAP_ZOOM',
    env.F8_ENABLE_MAP_ZOOM
  );
  assignViewerBoolean(
    config,
    'showMapAttribution',
    'F8_SHOW_MAP_ATTRIBUTION',
    env.F8_SHOW_MAP_ATTRIBUTION
  );
  assignViewerBoolean(
    config,
    'enableMapMarkerLink',
    'F8_ENABLE_MAP_MARKER_LINK',
    env.F8_ENABLE_MAP_MARKER_LINK
  );
  assignViewerBoolean(
    config,
    'showCaptions',
    'F8_SHOW_VIEWER_CAPTIONS',
    env.F8_SHOW_VIEWER_CAPTIONS
  );
  assignViewerCaptionAlign(
    config,
    'F8_VIEWER_CAPTION_ALIGN',
    env.F8_VIEWER_CAPTION_ALIGN
  );

  if (
    env.F8_MAP_MARKER_URL_TEMPLATE !== undefined &&
    env.F8_MAP_MARKER_URL_TEMPLATE.length > 0
  ) {
    config.viewer = {
      ...(config.viewer ?? {}),
      mapMarkerUrlTemplate: env.F8_MAP_MARKER_URL_TEMPLATE
    };
  }

  assignViewerBoolean(
    config,
    'enableExifOverlay',
    'F8_ENABLE_EXIF_OVERLAY',
    env.F8_ENABLE_EXIF_OVERLAY
  );

  if (env.F8_MAP_STYLE_URL !== undefined && env.F8_MAP_STYLE_URL.length > 0) {
    config.viewer = {
      ...(config.viewer ?? {}),
      mapStyleUrl: env.F8_MAP_STYLE_URL
    };
  }
}

function assignPrivacyEnv(
  config: DeepPartial<F8Config>,
  env: NodeJS.ProcessEnv
): void {
  const includeGpsMetadata = parseBooleanEnv(
    'F8_INCLUDE_GPS_METADATA',
    env.F8_INCLUDE_GPS_METADATA
  );
  if (includeGpsMetadata !== undefined) {
    config.privacy = { ...(config.privacy ?? {}), includeGpsMetadata };
  }

  const includeExifMetadata = parseBooleanEnv(
    'F8_INCLUDE_EXIF_METADATA',
    env.F8_INCLUDE_EXIF_METADATA
  );
  if (includeExifMetadata !== undefined) {
    config.privacy = { ...(config.privacy ?? {}), includeExifMetadata };
  }

  const stripOutputMetadata = parseBooleanEnv(
    'F8_STRIP_OUTPUT_METADATA',
    env.F8_STRIP_OUTPUT_METADATA
  );
  if (stripOutputMetadata !== undefined) {
    config.privacy = { ...(config.privacy ?? {}), stripOutputMetadata };
  }
}

function assignSecurityEnv(
  config: DeepPartial<F8Config>,
  env: NodeJS.ProcessEnv
): void {
  const allowUnprocessedImages = parseBooleanEnv(
    'F8_ALLOW_UNPROCESSED_IMAGES',
    env.F8_ALLOW_UNPROCESSED_IMAGES
  );
  if (allowUnprocessedImages !== undefined) {
    config.security = { ...(config.security ?? {}), allowUnprocessedImages };
  }
}

function assignViewerBoolean(
  config: DeepPartial<F8Config>,
  key: ViewerBooleanKey,
  name: string,
  value: string | undefined
): void {
  const parsed = parseBooleanEnv(name, value);
  if (parsed !== undefined) {
    config.viewer = { ...(config.viewer ?? {}), [key]: parsed };
  }
}

function assignViewerCaptionAlign(
  config: DeepPartial<F8Config>,
  name: string,
  value: string | undefined
): void {
  const parsed = parseCaptionAlignEnv(name, value);
  if (parsed !== undefined) {
    config.viewer = { ...(config.viewer ?? {}), captionAlign: parsed };
  }
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

function parseCaptionAlignEnv(
  name: string,
  value: string | undefined
): F8CaptionAlign | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (isF8CaptionAlign(normalized)) {
    return normalized;
  }

  throw new F8ConfigError(`${name} must be left, center, or right.`);
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
