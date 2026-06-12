import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { F8Gallery, F8Viewer } from '../src/lib/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

const mounted: unknown[] = [];

afterEach(() => {
  for (const component of mounted.splice(0)) {
    unmount(component as never);
  }
  document.body.innerHTML = '';
  document.body.style.removeProperty('overflow');
});

describe('F8 UI components', () => {
  it('renders a masonry gallery and opens the viewer from image buttons', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Gallery, {
        target,
        props: {
          images: [imageFixture('one'), imageFixture('two')],
          enableMap: false
        }
      })
    );

    expect(target.querySelector('.f8-gallery--masonry')).not.toBeNull();
    expect(target.querySelectorAll('[role="listitem"]')).toHaveLength(2);

    const opener = target.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Alpine lake"]'
    );
    opener?.click();
    await tick();

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.querySelector('[data-f8-viewer-image="one"]')
    ).not.toBeNull();
  });

  it('supports viewer keyboard navigation, Escape close, and focus restoration', async () => {
    const focusBefore = document.createElement('button');
    focusBefore.textContent = 'Before';
    document.body.append(focusBefore);
    focusBefore.focus();

    const target = document.createElement('div');
    document.body.append(target);
    const onClose = vi.fn();
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [imageFixture('one'), imageFixture('two')],
          open: true,
          enableMap: false,
          onClose
        }
      })
    );
    await tick();
    await tick();

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(dialog);

    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await tick();
    expect(
      document.querySelector('[data-f8-viewer-image="two"]')
    ).not.toBeNull();

    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await tick();
    expect(
      document.querySelector('[data-f8-viewer-image="one"]')
    ).not.toBeNull();

    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await tick();
    await tick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(focusBefore);
  });

  it('traps focus inside the viewer controls', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [imageFixture('one'), imageFixture('two')],
          open: true,
          enableMap: false
        }
      })
    );
    await tick();
    await tick();

    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('.f8-viewer button')
    ];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    last?.focus();
    document
      .querySelector<HTMLElement>('[role="dialog"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
    await tick();
    expect(document.activeElement).toBe(first);
  });

  it('toggles the info overlay with EXIF details and lazy map placeholder', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: { images: [imageFixture('one')], open: true, enableMap: true }
      })
    );
    await tick();

    expect(
      document.querySelector('[aria-label="Image information"]')
    ).toBeNull();
    expect(document.querySelector('[aria-label="Map preview"]')).toBeNull();

    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Show image information"]'
      )
      ?.click();
    await tick();

    expect(
      document.querySelector('[aria-label="Image information"]')?.textContent
    ).toContain('Camera');
    expect(
      document.querySelector('[aria-label="Image information"]')?.textContent
    ).toContain('Leica Q3');
    expect(document.querySelector('[aria-label="Map preview"]')).not.toBeNull();
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
