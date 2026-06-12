import { describe, expect, it } from 'vitest';

import {
  parseMarkdownBlocks,
  renderMarkdown
} from '../src/lib/markdown/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

function imageMetadata(
  relativePath: string,
  overrides: Partial<F8ImageMetadata> = {}
): F8ImageMetadata {
  const id = relativePath.replace(/[^a-z0-9]+/gi, '-');

  return {
    id,
    sourcePath: `/project/images/${relativePath}`,
    relativePath,
    title: `Title for ${relativePath}`,
    description: `Description for ${relativePath}`,
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    dominantColors: ['#336699'],
    variants: [
      {
        width: 480,
        height: 320,
        format: 'webp',
        src: `.f8/cache/${relativePath.replace(/\.jpg$/, '')}-480.webp`,
        sizeBytes: 1234
      },
      {
        width: 480,
        height: 320,
        format: 'jpeg',
        src: `.f8/cache/${relativePath.replace(/\.jpg$/, '')}-480.jpg`,
        sizeBytes: 2345
      },
      {
        width: 960,
        height: 640,
        format: 'webp',
        src: `.f8/cache/${relativePath.replace(/\.jpg$/, '')}-960.webp`,
        sizeBytes: 3456
      }
    ],
    ...overrides
  };
}

describe('markdown renderer', () => {
  it('renders a single isolated image as an accessible captioned figure', () => {
    const result = renderMarkdown('![Rain street](./images/street.jpg)', {
      images: [imageMetadata('street.jpg')]
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ type: 'images', kind: 'figure' });
    expect(result.images[0]?.metadata?.relativePath).toBe('street.jpg');
    expect(result.html).toContain('data-f8-block="figure"');
    expect(result.html).toContain('<picture class="f8-image"');
    expect(result.html).toContain('srcset=".f8/cache/street-480.webp 480w');
    expect(result.html).toContain('alt="Rain street"');
    expect(result.html).toContain('<figcaption class="f8-figure__caption">');
    expect(result.html).toContain('Title for street.jpg');
    expect(result.html).toContain('Description for street.jpg');
    expect(result.html).toContain(
      'aria-label="Open image: Title for street.jpg"'
    );
  });

  it('groups consecutive image lines with no empty lines into one gallery', () => {
    const blocks = parseMarkdownBlocks(
      `![](./images/a.jpg)
![](./images/b.jpg)
![](./images/c.jpg)`,
      {
        images: [
          imageMetadata('a.jpg'),
          imageMetadata('b.jpg'),
          imageMetadata('c.jpg')
        ]
      }
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'images', kind: 'gallery' });

    const result = renderMarkdown(
      `![](./images/a.jpg)
![](./images/b.jpg)
![](./images/c.jpg)`,
      {
        images: [
          imageMetadata('a.jpg'),
          imageMetadata('b.jpg'),
          imageMetadata('c.jpg')
        ]
      }
    );

    expect(result.html).toContain('data-f8-block="gallery"');
    expect(result.html).toContain('role="group"');
    expect(result.html).toContain('aria-label="Image gallery with 3 images"');
    expect(result.html.match(/role="listitem"/g)).toHaveLength(3);
  });

  it('preserves natural prose and image ordering while separating blank-line images', () => {
    const result = renderMarkdown(
      `# Kyoto in Rain

The first storm arrived just before dawn.

![](./images/street.jpg)
![](./images/lantern.jpg)

By evening, the streets turned gold.

![](./images/night.jpg)`,
      {
        images: [
          imageMetadata('street.jpg'),
          imageMetadata('lantern.jpg'),
          imageMetadata('night.jpg')
        ]
      }
    );

    expect(result.blocks.map((block) => block.type)).toEqual([
      'prose',
      'prose',
      'images',
      'prose',
      'images'
    ]);
    expect(result.blocks[2]).toMatchObject({ type: 'images', kind: 'gallery' });
    expect(result.blocks[4]).toMatchObject({ type: 'images', kind: 'figure' });

    const headingIndex = result.html.indexOf('<h1>Kyoto in Rain</h1>');
    const firstProseIndex = result.html.indexOf('The first storm arrived');
    const galleryIndex = result.html.indexOf('data-f8-block="gallery"');
    const secondProseIndex = result.html.indexOf('By evening');
    const figureIndex = result.html.lastIndexOf('data-f8-block="figure"');

    expect(headingIndex).toBeLessThan(firstProseIndex);
    expect(firstProseIndex).toBeLessThan(galleryIndex);
    expect(galleryIndex).toBeLessThan(secondProseIndex);
    expect(secondProseIndex).toBeLessThan(figureIndex);
  });

  it('does not group images separated by blank lines', () => {
    const result = renderMarkdown(
      `![](./images/a.jpg)

![](./images/b.jpg)`,
      {
        images: [imageMetadata('a.jpg'), imageMetadata('b.jpg')]
      }
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks).toEqual([
      expect.objectContaining({ type: 'images', kind: 'figure' }),
      expect.objectContaining({ type: 'images', kind: 'figure' })
    ]);
    expect(result.html).not.toContain('data-f8-block="gallery"');
  });

  it('uses real Markdown parsing instead of transforming image syntax inside code', () => {
    const result = renderMarkdown(
      `Inline \`![](./images/a.jpg)\` stays code.

\`\`\`md
![](./images/b.jpg)
\`\`\`

![](./images/c.jpg)`,
      {
        images: [
          imageMetadata('a.jpg'),
          imageMetadata('b.jpg'),
          imageMetadata('c.jpg')
        ]
      }
    );

    expect(result.blocks.map((block) => block.type)).toEqual([
      'prose',
      'prose',
      'images'
    ]);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.metadata?.relativePath).toBe('c.jpg');
    expect(result.html).toContain('<code>![](./images/a.jpg)</code>');
    expect(result.html).toContain(
      '<pre><code class="language-md">![](./images/b.jpg)'
    );
  });
});
