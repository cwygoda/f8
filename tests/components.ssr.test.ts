import { render as renderServer } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import { F8Image, F8Viewer } from '../src/lib/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

describe('F8 UI components SSR', () => {
  it('renders responsive image markup during SSR', () => {
    const { body } = renderServer(F8Image, {
      props: { image: imageFixture('one'), caption: true }
    });

    expect(body).toContain('<picture');
    expect(body).toContain(
      'srcset="/assets/one-640.avif 640w, /assets/one-1280.avif 1280w"'
    );
    expect(body).toContain('sizes="(min-width: 72rem) 72rem, 100vw"');
    expect(body).toContain('alt="Alpine lake"');
    expect(body).toContain('A cold morning');
    expect(body).toContain('background-color: #223344');
  });

  it('renders the viewer during SSR without touching browser globals', () => {
    const { body } = renderServer(F8Viewer, {
      props: { images: [imageFixture('one')], open: true, enableMap: true }
    });

    expect(body).toContain('role="dialog"');
    expect(body).toContain('data-f8-viewer-image="one"');
  });
});

function imageFixture(id: 'one' | 'two'): F8ImageMetadata {
  const title = id === 'one' ? 'Alpine lake' : 'Forest path';

  return {
    id,
    sourcePath: `images/${id}.jpg`,
    relativePath: `${id}.jpg`,
    alt: title,
    title,
    description: id === 'one' ? 'A cold morning' : 'Green shade',
    width: id === 'one' ? 1280 : 960,
    height: id === 'one' ? 800 : 1200,
    aspectRatio: id === 'one' ? 1.6 : 0.8,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    dominantColors: id === 'one' ? ['#223344'] : ['#334422'],
    variants: [
      {
        width: 640,
        height: id === 'one' ? 400 : 800,
        format: 'avif',
        src: `/assets/${id}-640.avif`,
        sizeBytes: 10
      },
      {
        width: 1280,
        height: id === 'one' ? 800 : 1600,
        format: 'avif',
        src: `/assets/${id}-1280.avif`,
        sizeBytes: 20
      },
      {
        width: 640,
        height: id === 'one' ? 400 : 800,
        format: 'jpeg',
        src: `/assets/${id}-640.jpeg`,
        sizeBytes: 30
      }
    ],
    exif: {
      camera: 'Leica Q3',
      lens: 'Summilux 28mm',
      aperture: 'f/2.8',
      shutter: '1/500',
      iso: 100,
      focalLength: '28mm',
      capturedAt: '2026-01-01T08:00:00Z'
    },
    location: {
      label: 'Lago di Braies',
      lat: 46.6943,
      lng: 12.0859
    }
  };
}
