<script lang="ts">
  import type { F8ImageMetadata } from '../types.js';
  import { DEFAULT_MAP_MARKER_URL_TEMPLATE } from '../viewer-defaults.js';
  import F8Image from './F8Image.svelte';
  import F8Viewer from './F8Viewer.svelte';
  import { DEFAULT_IMAGE_SIZES } from './image-utils.js';

  export let images: F8ImageMetadata[] = [];
  export let sizes = DEFAULT_IMAGE_SIZES;
  export let layout: 'masonry' | 'grid' = 'masonry';
  export let gap = 'var(--f8-gap)';
  export let maxColumns = 4;
  export let showCaptions = true;
  export let enableViewer = true;
  export let enableMap = true;
  export let enableMapZoom = true;
  export let showMapAttribution = false;
  export let enableMapMarkerLink = true;
  export let mapMarkerUrlTemplate = DEFAULT_MAP_MARKER_URL_TEMPLATE;
  export let enableExifOverlay = true;
  export let mapStyleUrl: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;

  let viewerOpen = false;
  let viewerIndex = 0;

  $: galleryLabel = ariaLabel ?? `Image gallery with ${images.length} images`;
  $: styleVars = `--f8-gallery-gap: ${gap}; --f8-gallery-max-columns: ${maxColumns};`;

  function openImage(image: F8ImageMetadata): void {
    if (!enableViewer) {
      return;
    }

    const nextIndex = images.findIndex(
      (candidate) => candidate.id === image.id
    );
    viewerIndex = nextIndex >= 0 ? nextIndex : 0;
    viewerOpen = true;
  }
</script>

<section
  class="f8-gallery"
  class:f8-gallery--grid={layout === 'grid'}
  class:f8-gallery--masonry={layout === 'masonry'}
  style={styleVars}
  role="group"
  aria-label={galleryLabel}
  data-f8-block="gallery"
>
  <div class="f8-gallery__grid" role="list">
    {#each images as image (image.id)}
      <div class="f8-gallery__item" role="listitem">
        <F8Image
          {image}
          {sizes}
          caption={showCaptions}
          interactive={enableViewer}
          onOpen={openImage}
        />
      </div>
    {/each}
  </div>
</section>

{#if enableViewer}
  <F8Viewer
    {images}
    bind:open={viewerOpen}
    bind:index={viewerIndex}
    {sizes}
    {enableMap}
    {enableMapZoom}
    {showMapAttribution}
    {enableMapMarkerLink}
    {mapMarkerUrlTemplate}
    {enableExifOverlay}
    {mapStyleUrl}
  />
{/if}

<style>
  :global(:where(.f8-theme, .f8-gallery, .f8-viewer, .f8-image-frame)) {
    --f8-bg: light-dark(#f3f0e8, #171a17);
    --f8-surface: light-dark(#ebe7dc, #20241f);
    --f8-fg: light-dark(#252722, #ece8df);
    --f8-muted: light-dark(#6b7168, #aeb6aa);
    --f8-border: light-dark(rgb(37 39 34 / 13%), rgb(236 232 223 / 14%));
    --f8-accent: light-dark(#52685d, #9aad9f);
    --f8-accent-2: light-dark(#a66f53, #c29174);
    --f8-overlay-bg: light-dark(rgb(243 240 232 / 88%), rgb(23 26 23 / 90%));
    --f8-shadow: 0 18px 54px rgb(70 64 49 / 10%);
    --f8-radius: 0.9rem;
    --f8-gap: clamp(0.75rem, 1.5vw, 1.15rem);
    color-scheme: light dark;
  }

  .f8-gallery {
    width: 100%;
    color: var(--f8-fg);
    font-family: var(
      --f8-font-sans,
      'Noto Sans Variable',
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .f8-gallery__grid {
    gap: var(--f8-gallery-gap, var(--f8-gap));
  }

  .f8-gallery--masonry .f8-gallery__grid {
    column-count: min(var(--f8-gallery-max-columns, 4), 4);
    column-gap: var(--f8-gallery-gap, var(--f8-gap));
  }

  .f8-gallery--masonry .f8-gallery__item {
    display: inline-block;
    width: 100%;
    margin: 0 0 var(--f8-gallery-gap, var(--f8-gap));
    break-inside: avoid;
  }

  .f8-gallery--grid .f8-gallery__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  }

  .f8-gallery__item :global(.f8-image-frame) {
    --f8-image-shadow: 0 14px 48px rgb(0 0 0 / 14%);
  }

  @media (width <= 900px) {
    .f8-gallery--masonry .f8-gallery__grid {
      column-count: min(var(--f8-gallery-max-columns, 3), 3);
    }
  }

  @media (width <= 640px) {
    .f8-gallery--masonry .f8-gallery__grid {
      column-count: min(var(--f8-gallery-max-columns, 2), 2);
    }
  }

  @media (width <= 420px) {
    .f8-gallery--masonry .f8-gallery__grid {
      column-count: 1;
    }
  }
</style>
