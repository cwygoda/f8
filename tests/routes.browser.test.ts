import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import Page from '../src/routes/[...slug]/+page.svelte';
import type { F8ImageMetadata } from '../src/lib/types.js';

const mounted: unknown[] = [];

afterEach(() => {
  for (const component of mounted.splice(0)) {
    unmount(component as never);
  }
  document.body.innerHTML = '';
  document.body.style.removeProperty('overflow');
});

describe('static Markdown page viewer', () => {
  it('opens the viewer instead of following generated image asset links', async () => {
    const target = document.createElement('div');
    document.body.append(target);

    mounted.push(
      mount(Page, {
        target,
        props: {
          data: {
            page: pageFixture()
          }
        }
      })
    );
    await tick();

    const trigger = target.querySelector<HTMLAnchorElement>(
      'a[data-f8-viewer-trigger]'
    );
    expect(trigger).not.toBeNull();

    const followed = trigger?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    );
    await tick();
    await tick();

    expect(followed).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.querySelector('[data-f8-viewer-image="demo-image"]')
    ).not.toBeNull();
  });
});

function pageFixture() {
  const image = imageFixture();

  return {
    slug: 'demo',
    path: '/content/demo.md',
    urlPath: '/demo',
    frontmatter: {
      title: 'Demo page'
    },
    markdown: '',
    html: `<figure class="f8-figure" data-f8-block="figure" data-f8-image-id="${image.id}"><a class="f8-image__trigger" href="${image.variants[0]?.src}" data-f8-viewer-trigger data-f8-image-id="${image.id}" aria-label="Open image: Demo image"><picture class="f8-image"><img src="${image.variants[0]?.src}" alt="Demo image" width="1200" height="800" data-f8-image-id="${image.id}"></picture></a></figure>`,
    images: [image],
    viewer: {
      enableMap: true,
      enableMapZoom: true,
      showMapAttribution: false,
      enableMapMarkerLink: true,
      mapMarkerUrlTemplate: 'https://earth.google.com/web/@{lat},{lng}',
      enableExifOverlay: true,
      mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty'
    },
    seo: {
      title: 'Demo page',
      openGraph: {
        title: 'Demo page',
        type: 'article' as const
      },
      twitter: {
        card: 'summary' as const,
        title: 'Demo page'
      }
    }
  };
}

function imageFixture(): F8ImageMetadata {
  return {
    id: 'demo-image',
    cacheKey: 'demo-cache',
    sourcePath: '/content/demo.jpg',
    relativePath: 'demo.jpg',
    title: 'Demo image',
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    dominantColors: ['#224466'],
    variants: [
      {
        width: 1200,
        height: 800,
        format: 'jpeg',
        src: '/@f8/demo-cache/demo/demo-1200.jpg',
        sizeBytes: 1024
      }
    ]
  };
}
