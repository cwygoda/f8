import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { f8ConfigSchema } from '../src/lib/config/index.js';
import {
  createImageCacheKey,
  parseSidecar,
  processImage
} from '../src/lib/pipeline/index.js';

function fixtureDir(): string {
  return join(tmpdir(), `f8-pipeline-${randomUUID()}`);
}

async function writeImage(
  path: string,
  options: { width?: number; height?: number; color?: string } = {}
): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  await sharp({
    create: {
      width: options.width ?? 80,
      height: options.height ?? 40,
      channels: 3,
      background: options.color ?? '#336699'
    }
  })
    .jpeg()
    .toFile(path);
}

function testConfig(overrides: { widths?: number[] } = {}) {
  return f8ConfigSchema.parse({
    cacheDir: '.f8/cache',
    image: {
      widths: overrides.widths ?? [32, 128],
      formats: ['webp', 'jpeg'],
      allowUpscale: false
    }
  });
}

describe('image pipeline', () => {
  it('parses sidecar Markdown frontmatter and content', () => {
    const cwd = fixtureDir();
    mkdirSync(join(cwd, 'content'), { recursive: true });
    writeFileSync(join(cwd, 'content', 'photo.jpg'), '', 'utf8');
    writeFileSync(
      join(cwd, 'content', 'photo.md'),
      `---
title: Morning fog
description: A quiet sunrise
camera: Leica Q3
location:
  label: Dolomites
  lat: 46.4102
  lng: 11.844
tags:
  - travel
  - sunrise
---

Longer caption text.
`,
      'utf8'
    );

    const sidecar = parseSidecar(join(cwd, 'content', 'photo.jpg'));

    expect(sidecar?.frontmatter.title).toBe('Morning fog');
    expect(sidecar?.frontmatter.location).toMatchObject({ lat: 46.4102 });
    expect(sidecar?.frontmatter.tags).toEqual(['travel', 'sunrise']);
    expect(sidecar?.content).toBe('Longer caption text.');
  });

  it('creates stable cache keys that include config and sidecar hashes', () => {
    const base = {
      relativePath: 'nested/photo.jpg',
      sourceHash: 'source',
      configHash: 'config',
      sidecarHash: 'sidecar'
    };

    expect(createImageCacheKey(base)).toBe(createImageCacheKey(base));
    expect(createImageCacheKey(base)).not.toBe(
      createImageCacheKey({ ...base, configHash: 'changed' })
    );
    expect(createImageCacheKey(base)).not.toBe(
      createImageCacheKey({ ...base, sidecarHash: 'changed' })
    );
  });

  it('generates responsive variants and metadata artifacts without upscaling', async () => {
    const cwd = fixtureDir();
    const imageRoot = join(cwd, 'content');
    await writeImage(join(imageRoot, 'nested', 'photo.jpg'), {
      width: 80,
      height: 40
    });
    writeFileSync(
      join(imageRoot, 'nested', 'photo.md'),
      `---
title: Sidecar title
alt: Sidecar alt
exif:
  aperture: f/5.6
  iso: 100
---

Sidecar caption.
`,
      'utf8'
    );

    const image = await processImage('content/nested/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });

    expect(image.cached).toBe(false);
    expect(image.metadata.relativePath).toBe('nested/photo.jpg');
    expect(image.metadata.title).toBe('Sidecar title');
    expect(image.metadata.alt).toBe('Sidecar alt');
    expect(image.metadata.exif).toMatchObject({ aperture: 'f/5.6', iso: 100 });
    expect(image.metadata.width).toBe(80);
    expect(image.metadata.height).toBe(40);
    expect(image.metadata.variants).toHaveLength(2);
    expect(image.metadata.variants.map((variant) => variant.width)).toEqual([
      32, 32
    ]);
    expect(image.metadata.variants.map((variant) => variant.src)).toEqual([
      '.f8/cache/nested/photo/photo-32.webp',
      '.f8/cache/nested/photo/photo-32.jpg'
    ]);
    expect(image.metadata.dominantColors[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(image.metadata.blurhash).toBeTypeOf('string');
    expect(existsSync(image.metadataPath)).toBe(true);
    expect(existsSync(image.exifPath)).toBe(true);
  });

  it('omits GPS metadata by default and includes it only when configured', async () => {
    const cwd = fixtureDir();
    const imageRoot = join(cwd, 'content');
    await writeImage(join(imageRoot, 'geo.jpg'));
    writeFileSync(
      join(imageRoot, 'geo.md'),
      `---
location:
  label: Private place
  lat: 1.23
  lng: 4.56
---
`,
      'utf8'
    );

    const privateResult = await processImage('content/geo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });
    const publicResult = await processImage('content/geo.jpg', {
      cwd,
      imageRoot,
      force: true,
      config: f8ConfigSchema.parse({
        cacheDir: '.f8/cache',
        image: {
          widths: [32],
          formats: ['webp'],
          allowUpscale: false
        },
        privacy: { includeGpsMetadata: true }
      })
    });

    expect(privateResult.metadata.location).toBeUndefined();
    expect(publicResult.metadata.location).toMatchObject({
      label: 'Private place',
      lat: 1.23,
      lng: 4.56
    });
  });

  it('uses cache and invalidates it when config or sidecar metadata changes', async () => {
    const cwd = fixtureDir();
    const imageRoot = join(cwd, 'content');
    await writeImage(join(imageRoot, 'photo.jpg'), {
      width: 80,
      height: 40
    });
    writeFileSync(
      join(imageRoot, 'photo.md'),
      `---
title: First title
---
`,
      'utf8'
    );

    const first = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });
    const second = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);

    const variantPath = join(cwd, '.f8', 'cache', 'photo', 'photo-32.webp');
    const exifPath = join(cwd, '.f8', 'cache', 'photo', 'photo.exif.json');

    rmSync(variantPath);
    const missingVariant = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });
    expect(missingVariant.cached).toBe(false);
    expect(existsSync(variantPath)).toBe(true);

    rmSync(exifPath);
    const missingExif = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });
    expect(missingExif.cached).toBe(false);
    expect(existsSync(exifPath)).toBe(true);

    const cachedMtime = statSync(variantPath).mtimeMs;

    const changedConfig = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig({ widths: [64] })
    });

    expect(changedConfig.cached).toBe(false);
    expect(
      existsSync(join(cwd, '.f8', 'cache', 'photo', 'photo-64.webp'))
    ).toBe(true);
    expect(statSync(variantPath).mtimeMs).toBe(cachedMtime);

    writeFileSync(
      join(imageRoot, 'photo.md'),
      `---
title: Second title
---
`,
      'utf8'
    );

    const changedSidecar = await processImage('content/photo.jpg', {
      cwd,
      imageRoot,
      config: testConfig()
    });

    expect(changedSidecar.cached).toBe(false);
    expect(changedSidecar.metadata.title).toBe('Second title');
  });
});
