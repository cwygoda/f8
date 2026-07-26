import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { F8Viewer } from '../src/lib/index.js';
import type { F8ImageMetadata } from '../src/lib/types.js';

const mapConstructor = vi.fn();
const markerConstructor = vi.fn();
const mounted: unknown[] = [];

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor(options: Record<string, unknown>) {
      mapConstructor(options);
    }

    resize(): void {}
    remove(): void {}
  },
  Marker: class {
    private element: HTMLElement | undefined;

    constructor(options: { element?: HTMLElement }) {
      this.element = options.element;
      markerConstructor(options);
    }

    setLngLat(): { addTo: () => void } {
      return {
        addTo: () => {
          if (this.element !== undefined) {
            document.body.append(this.element);
          }
        }
      };
    }
  }
}));

afterEach(() => {
  for (const component of mounted.splice(0)) {
    unmount(component as never);
  }
  document.body.innerHTML = '';
  document.body.style.removeProperty('overflow');
  mapConstructor.mockClear();
  markerConstructor.mockClear();
});

describe('F8Viewer map options', () => {
  it('uses a zoomable attribution-free map and clickable marker by default', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [imageFixture()],
          open: true,
          enableMap: true,
          mapStyleUrl: 'https://example.com/style.json',
          mapMarkerUrlTemplate: 'https://example.com/earth?lat={lat}&lng={lng}'
        }
      })
    );
    await tick();

    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Show image information"]'
      )
      ?.click();
    await tick();
    await tick();
    await vi.waitFor(() => expect(mapConstructor).toHaveBeenCalled());

    expect(mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: true,
        scrollZoom: true,
        attributionControl: false
      })
    );
    expect(markerConstructor).toHaveBeenCalled();
    expect(
      document.querySelector<HTMLAnchorElement>('.f8-viewer__map-marker')?.href
    ).toBe('https://example.com/earth?lat=46.6943&lng=12.0859');
  });

  it('replaces the map when navigating between geotagged images', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [
            imageFixture(),
            imageFixture({ id: 'two', lat: 40.7128, lng: -74.006 })
          ],
          open: true,
          enableMap: true,
          mapStyleUrl: 'https://example.com/style.json'
        }
      })
    );
    await tick();

    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Show image information"]'
      )
      ?.click();
    await tick();
    await vi.waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(1));

    document
      .querySelector<HTMLButtonElement>('button[aria-label="Next image"]')
      ?.click();
    await tick();
    expect(
      document
        .querySelector<HTMLImageElement>('[data-f8-viewer-image]')
        ?.getAttribute('data-f8-viewer-image')
    ).toBe('two');

    await vi.waitFor(() => expect(mapConstructor).toHaveBeenCalledTimes(2));
    expect(document.body.textContent).not.toContain('Map preview unavailable');
    expect(mapConstructor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        center: [-74.006, 40.7128]
      })
    );
  });

  it('allows map zoom and marker links to be disabled', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    mounted.push(
      mount(F8Viewer, {
        target,
        props: {
          images: [imageFixture()],
          open: true,
          enableMap: true,
          enableMapZoom: false,
          enableMapMarkerLink: false,
          showMapAttribution: true,
          mapStyleUrl: 'https://example.com/style.json'
        }
      })
    );
    await tick();

    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Show image information"]'
      )
      ?.click();
    await tick();
    await tick();
    await vi.waitFor(() => expect(mapConstructor).toHaveBeenCalled());

    expect(mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: false,
        scrollZoom: false,
        attributionControl: true
      })
    );
    expect(document.querySelector('.f8-viewer__map-marker')).not.toBeNull();
    expect(document.querySelector('a.f8-viewer__map-marker')).toBeNull();
  });
});

function imageFixture(
  options: { id?: string; lat?: number; lng?: number } = {}
): F8ImageMetadata {
  return {
    id: options.id ?? 'one',
    sourcePath: 'images/one.jpg',
    relativePath: 'one.jpg',
    title: 'Alpine lake',
    width: 1280,
    height: 800,
    aspectRatio: 1.6,
    dominantColors: ['#223344'],
    variants: [
      {
        width: 640,
        height: 400,
        format: 'jpeg',
        src: '/assets/one-640.jpeg',
        sizeBytes: 30
      }
    ],
    exif: {
      camera: 'Leica Q3'
    },
    location: {
      label: 'Lago di Braies',
      lat: options.lat ?? 46.6943,
      lng: options.lng ?? 12.0859
    }
  };
}
