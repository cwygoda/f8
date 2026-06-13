import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { F8ConfigError, loadConfig } from '../src/lib/config/index.js';

function fixtureDir(): string {
  return join(tmpdir(), `f8-config-${randomUUID()}`);
}

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    const cwd = fixtureDir();
    mkdirSync(cwd, { recursive: true });

    const result = loadConfig({ cwd, env: {} });

    expect(result.path).toBeUndefined();
    expect(result.config.contentDir).toBe('content');
    expect(result.config.image.widths).toContain(1024);
    expect(result.config.viewer.enableMap).toBe(true);
    expect(result.config.privacy.includeGpsMetadata).toBe(false);
    expect(result.config.privacy.stripOutputMetadata).toBe(true);
    expect(result.config.security.sanitizeMarkdown).toBe(true);
  });

  it('loads f8.config.toml and applies env overrides', () => {
    const cwd = fixtureDir();
    mkdirSync(cwd, { recursive: true });
    writeFileSync(
      join(cwd, 'f8.config.toml'),
      `contentDir = "stories"
imageDir = "photos"

[viewer]
enableMap = true
`,
      'utf8'
    );

    const result = loadConfig({
      cwd,
      env: {
        F8_IMAGE_DIR: 'env-images',
        F8_ENABLE_MAP: 'false',
        F8_INCLUDE_GPS_METADATA: 'true',
        F8_ALLOW_UNPROCESSED_IMAGES: 'true'
      }
    });

    expect(result.path).toBe(join(cwd, 'f8.config.toml'));
    expect(result.config.contentDir).toBe('stories');
    expect(result.config.imageDir).toBe('env-images');
    expect(result.config.viewer.enableMap).toBe(false);
    expect(result.config.privacy.includeGpsMetadata).toBe(true);
    expect(result.config.security.allowUnprocessedImages).toBe(true);
  });

  it('throws a useful error for invalid config', () => {
    const cwd = fixtureDir();
    mkdirSync(cwd, { recursive: true });
    writeFileSync(
      join(cwd, 'f8.config.toml'),
      `unknownKey = true
`,
      'utf8'
    );

    expect(() => loadConfig({ cwd, env: {} })).toThrow(F8ConfigError);
    expect(() => loadConfig({ cwd, env: {} })).toThrow(
      'Invalid f8 configuration'
    );
  });
});
