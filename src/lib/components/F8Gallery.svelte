<script lang="ts">
  import type { F8ImageMetadata } from '../types.js';
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
  export let enableExifOverlay = true;
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
    {enableExifOverlay}
  />
{/if}

<style>
  :global(:where(.f8-theme, .f8-gallery, .f8-viewer, .f8-image-frame)) {
    --f8-bg: light-dark(#fbf8f1, #11100e);
    --f8-fg: light-dark(#181510, #f8f2e8);
    --f8-muted: light-dark(#6b6256, #c9bfae);
    --f8-border: light-dark(rgb(24 21 16 / 14%), rgb(248 242 232 / 18%));
    --f8-accent: #c69b54;
    --f8-overlay-bg: light-dark(rgb(251 248 241 / 88%), rgb(17 16 14 / 84%));
    --f8-shadow: 0 24px 80px rgb(0 0 0 / 28%);
    --f8-radius: 18px;
    --f8-gap: clamp(0.75rem, 2vw, 1.5rem);
    color-scheme: light dark;
  }

  .f8-gallery {
    width: 100%;
    color: var(--f8-fg);
    font-family: var(
      --f8-font-sans,
      Inter,
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
