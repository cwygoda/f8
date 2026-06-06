import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { f8ConfigSchema } from '../src/lib/config/index.js';
import {
  createImageCacheKey,
  discoverImages,
  parseSidecar,
  processImageDirectory
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
    imageDir: 'images',
    cacheDir: '.f8/cache',
    image: {
      widths: overrides.widths ?? [32, 128],
      formats: ['webp', 'jpeg'],
      sortBy: 'path',
      sortDirection: 'asc',
      allowUpscale: false
    }
  });
}

describe('image pipeline', () => {
  it('discovers supported images recursively and sorts them', async () => {
    const cwd = fixtureDir();
    await writeImage(join(cwd, 'images', 'z.jpg'));
    await writeImage(join(cwd, 'images', 'nested', 'a.png'));
    writeFileSync(join(cwd, 'images', 'ignored.txt'), 'not an image', 'utf8');

    const discovered = discoverImages({
      rootDir: join(cwd, 'images'),
      sortBy: 'name'
    });

    expect(discovered.map((imagePath) => basename(imagePath))).toEqual([
      'a.png',
      'z.jpg'
    ]);
  });

  it('parses sidecar Markdown frontmatter and content', () => {
    const cwd = fixtureDir();
    mkdirSync(join(cwd, 'images'), { recursive: true });
    writeFileSync(join(cwd, 'images', 'photo.jpg'), '', 'utf8');
    writeFileSync(
      join(cwd, 'images', 'photo.md'),
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

    const sidecar = parseSidecar(join(cwd, 'images', 'photo.jpg'));

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
    await writeImage(join(cwd, 'images', 'nested', 'photo.jpg'), {
      width: 80,
      height: 40
    });
    writeFileSync(
      join(cwd, 'images', 'nested', 'photo.md'),
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

    const result = await processImageDirectory({ cwd, config: testConfig() });
    const image = result.images[0];

    expect(result.generated).toBe(1);
    expect(image?.metadata.relativePath).toBe('nested/photo.jpg');
    expect(image?.metadata.title).toBe('Sidecar title');
    expect(image?.metadata.alt).toBe('Sidecar alt');
    expect(image?.metadata.exif).toMatchObject({ aperture: 'f/5.6', iso: 100 });
    expect(image?.metadata.width).toBe(80);
    expect(image?.metadata.height).toBe(40);
    expect(image?.metadata.variants).toHaveLength(2);
    expect(image?.metadata.variants.map((variant) => variant.width)).toEqual([
      32, 32
    ]);
    expect(image?.metadata.variants.map((variant) => variant.src)).toEqual([
      '.f8/cache/nested/photo/photo-32.webp',
      '.f8/cache/nested/photo/photo-32.jpg'
    ]);
    expect(image?.metadata.dominantColors[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(image?.metadata.blurhash).toBeTypeOf('string');
    expect(existsSync(image?.metadataPath ?? '')).toBe(true);
    expect(existsSync(image?.exifPath ?? '')).toBe(true);
  });

  it('uses cache and invalidates it when config or sidecar metadata changes', async () => {
    const cwd = fixtureDir();
    await writeImage(join(cwd, 'images', 'photo.jpg'), {
      width: 80,
      height: 40
    });
    writeFileSync(
      join(cwd, 'images', 'photo.md'),
      `---
title: First title
---
`,
      'utf8'
    );

    const first = await processImageDirectory({ cwd, config: testConfig() });
    const second = await processImageDirectory({ cwd, config: testConfig() });

    expect(first.generated).toBe(1);
    expect(second.cached).toBe(1);

    const variantPath = join(cwd, '.f8', 'cache', 'photo', 'photo-32.webp');
    const exifPath = join(cwd, '.f8', 'cache', 'photo', 'photo.exif.json');

    rmSync(variantPath);
    const missingVariant = await processImageDirectory({
      cwd,
      config: testConfig()
    });
    expect(missingVariant.generated).toBe(1);
    expect(existsSync(variantPath)).toBe(true);

    rmSync(exifPath);
    const missingExif = await processImageDirectory({
      cwd,
      config: testConfig()
    });
    expect(missingExif.generated).toBe(1);
    expect(existsSync(exifPath)).toBe(true);

    const cachedMtime = statSync(variantPath).mtimeMs;

    const changedConfig = await processImageDirectory({
      cwd,
      config: testConfig({ widths: [64] })
    });

    expect(changedConfig.generated).toBe(1);
    expect(
      existsSync(join(cwd, '.f8', 'cache', 'photo', 'photo-64.webp'))
    ).toBe(true);
    expect(statSync(variantPath).mtimeMs).toBe(cachedMtime);

    writeFileSync(
      join(cwd, 'images', 'photo.md'),
      `---
title: Second title
---
`,
      'utf8'
    );

    const changedSidecar = await processImageDirectory({
      cwd,
      config: testConfig()
    });

    expect(changedSidecar.generated).toBe(1);
    expect(changedSidecar.images[0]?.metadata.title).toBe('Second title');
  });
});
