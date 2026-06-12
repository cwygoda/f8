import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { f8SvelteKit, loadImageManifest } from '../src/lib/sveltekit/index.js';
import type { F8ImageManifest } from '../src/lib/pipeline/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

function fixtureDir(): string {
  return join(tmpdir(), `f8-sveltekit-${randomUUID()}`);
}

function imageMetadata(relativePath: string): F8ImageMetadata {
  return {
    id: relativePath.replace(/[^a-z0-9]+/gi, '-'),
    sourcePath: `/project/images/${relativePath}`,
    relativePath,
    title: `Title for ${relativePath}`,
    description: `Description for ${relativePath}`,
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    dominantColors: ['#336699'],
    variants: [
      {
        width: 960,
        height: 640,
        format: 'webp',
        src: `.f8/cache/${relativePath.replace(/\.jpg$/, '')}-960.webp`,
        sizeBytes: 3456
      }
    ]
  };
}

function writeManifest(cwd: string, images: F8ImageMetadata[]): string {
  const manifestPath = join(cwd, '.f8', 'cache', 'manifest.json');
  const manifest: F8ImageManifest = {
    pipelineVersion: 'test',
    generatedAt: '2026-01-01T00:00:00.000Z',
    imageDir: 'images',
    cacheDir: '.f8/cache',
    images
  };

  mkdirSync(join(cwd, '.f8', 'cache'), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

describe('f8 SvelteKit integration', () => {
  it('loads image metadata from the generated manifest', () => {
    const cwd = fixtureDir();
    const images = [imageMetadata('a.jpg')];
    const manifestPath = writeManifest(cwd, images);

    const manifest = loadImageManifest({ cwd });

    expect(manifest.images).toHaveLength(1);
    expect(manifest.images[0]?.relativePath).toBe('a.jpg');
    expect(loadImageManifest({ manifestPath }).images[0]?.title).toBe(
      'Title for a.jpg'
    );
  });

  it('returns mdsvex preprocessing for +page.md routes with f8 image transforms', async () => {
    const cwd = fixtureDir();
    writeManifest(cwd, [imageMetadata('a.jpg'), imageMetadata('b.jpg')]);

    const integration = f8SvelteKit({ cwd });
    const output = await integration.preprocess.markup({
      filename: join(cwd, 'src', 'routes', '+page.md'),
      content: `# Gallery

![](./images/a.jpg)
![](./images/b.jpg)`
    });

    expect(integration.extensions).toEqual(['.svelte', '.md']);
    expect(integration.images).toHaveLength(2);
    expect(output?.code).toContain('data-f8-block="gallery"');
    expect(output?.code).toContain('Title for a.jpg');
  });
});
