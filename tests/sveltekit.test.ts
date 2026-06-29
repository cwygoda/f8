import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/lib/config/index.js';
import {
  f8SvelteKit,
  getF8PageEntries,
  listCachedF8Assets,
  loadF8Page
} from '../src/lib/sveltekit/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

function fixtureDir(): string {
  return join(tmpdir(), `f8-sveltekit-${randomUUID()}`);
}

function imageMetadata(relativePath: string): F8ImageMetadata {
  return {
    id: relativePath.replace(/[^a-z0-9]+/gi, '-'),
    cacheKey: `cache-${relativePath.replace(/[^a-z0-9]+/gi, '-')}`,
    sourcePath: `/project/content/${relativePath}`,
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

async function writeFixtureImage(path: string): Promise<void> {
  mkdirSync(join(path, '..'), { recursive: true });
  await sharp({
    create: {
      width: 12,
      height: 8,
      channels: 3,
      background: '#336699'
    }
  })
    .png()
    .toFile(path);
}

describe('f8 SvelteKit integration', () => {
  it('loads Markdown pages with SEO metadata and colocated image URLs', async () => {
    const cwd = fixtureDir();
    mkdirSync(join(cwd, 'content', 'travel'), { recursive: true });
    await writeFixtureImage(join(cwd, 'content', 'rain.png'));
    await writeFixtureImage(join(cwd, 'content', 'travel', 'kyoto.png'));
    writeFileSync(
      join(cwd, 'content', 'index.md'),
      `---
title: Kyoto in Rain
description: A quiet walk.
---

# Kyoto in Rain

![](./rain.png)
`,
      'utf8'
    );
    writeFileSync(
      join(cwd, 'content', 'travel', 'kyoto.md'),
      `---
title: Nested Kyoto
---

![](./kyoto.png)
`,
      'utf8'
    );
    writeFileSync(
      join(cwd, '.f8.toml'),
      `contentDir = "content"
cacheDir = ".f8/cache"

[site]
title = "Photo Journal"
url = "https://example.com"

[image]
widths = [8]
formats = ["webp"]
`,
      'utf8'
    );

    const page = await loadF8Page({ cwd, slug: '' });

    expect(page?.seo.title).toBe('Kyoto in Rain');
    expect(page?.seo.canonical).toBe('https://example.com/');
    expect(page?.html).toContain('data-f8-block="figure"');
    expect(page?.html).toContain('/@f8/');
    expect(page?.html).toContain('/rain/rain-8.webp');
    expect(
      existsSync(join(cwd, 'static', 'assets', 'f8', 'rain', 'rain-8.webp'))
    ).toBe(false);
    expect(getF8PageEntries({ cwd })).toEqual([{ slug: 'travel/kyoto' }]);
    expect((await loadF8Page({ cwd, slug: 'travel/kyoto' }))?.html).toContain(
      '/travel/kyoto/kyoto-8.webp'
    );
  });

  it('ignores Markdown image references outside content', async () => {
    const cwd = fixtureDir();
    mkdirSync(join(cwd, 'content'), { recursive: true });
    await writeFixtureImage(join(cwd, 'outside.png'));
    writeFileSync(
      join(cwd, 'content', 'index.md'),
      `![Outside](../outside.png)`,
      'utf8'
    );

    const page = await loadF8Page({ cwd, slug: '' });

    expect(page?.images).toHaveLength(0);
    expect(page?.html).toContain('f8-image--unprocessed');
  });

  it('processes Markdown-relative colocated images on demand', async () => {
    const cwd = fixtureDir();
    mkdirSync(join(cwd, 'content', 'travel'), { recursive: true });
    await writeFixtureImage(join(cwd, 'content', 'travel', 'rain.png'));
    writeFileSync(
      join(cwd, 'content', 'travel', 'kyoto.md'),
      `---
title: Nested Kyoto
---

![Rain](./rain.png)
`,
      'utf8'
    );
    writeFileSync(
      join(cwd, '.f8.toml'),
      `contentDir = "content"
cacheDir = ".f8/cache"

[image]
widths = [8]
formats = ["webp"]
`,
      'utf8'
    );

    const page = await loadF8Page({ cwd, slug: 'travel/kyoto' });

    expect(page?.html).toContain('data-f8-block="figure"');
    expect(page?.images[0]?.relativePath).toBe('travel/rain.png');
    expect(page?.html).toContain('/@f8/');
    expect(page?.html).toContain('/travel/rain/rain-8.webp');
    expect(
      existsSync(
        join(cwd, 'static', 'assets', 'f8', 'travel', 'rain', 'rain-8.webp')
      )
    ).toBe(false);
    expect(
      listCachedF8Assets({
        cwd,
        config: loadConfig({ cwd }).config
      })[0]?.outputFileName
    ).toContain('@f8/');
  });

  it('returns mdsvex preprocessing for +page.md routes with supplied image metadata', async () => {
    const integration = f8SvelteKit({
      images: [imageMetadata('a.jpg'), imageMetadata('b.jpg')]
    });
    const output = await integration.preprocess.markup({
      filename: join('/project', 'src', 'routes', '+page.md'),
      content: `# Gallery

![](./a.jpg)
![](./b.jpg)`
    });

    expect(integration.extensions).toEqual(['.svelte', '.md']);
    expect(integration.images).toHaveLength(2);
    expect(output?.code).toContain('data-f8-block="gallery"');
    expect(output?.code).toContain('Title for a.jpg');
  });
});
