<script lang="ts">
  import type { F8ImageMetadata } from '../types.js';
  import {
    DEFAULT_IMAGE_SIZES,
    aspectRatioStyle,
    fallbackVariant,
    imageAlt,
    imageCaption,
    placeholderColor,
    sourceSets
  } from './image-utils.js';

  export let image: F8ImageMetadata;
  export let alt: string | undefined = undefined;
  export let sizes = DEFAULT_IMAGE_SIZES;
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let decoding: 'async' | 'auto' | 'sync' = 'async';
  export let caption = false;
  export let interactive = false;
  export let label: string | undefined = undefined;
  export let onOpen: ((image: F8ImageMetadata) => void) | undefined = undefined;

  $: fallback = fallbackVariant(image);
  $: altText = imageAlt(image, alt);
  $: captionContent = imageCaption(image);
  $: background = placeholderColor(image);
  $: aspectRatio = aspectRatioStyle(image);
  $: sources = sourceSets(image.variants);
  $: triggerLabel = label ?? `Open ${image.title ?? image.alt ?? 'image'}`;

  function openImage(): void {
    onOpen?.(image);
  }
</script>

<figure
  class="f8-image-frame"
  class:f8-image-frame--interactive={interactive}
  style:background-color={background}
  style:aspect-ratio={aspectRatio}
  data-f8-image-id={image.id}
>
  {#if interactive}
    <button
      class="f8-image-frame__trigger"
      type="button"
      aria-label={triggerLabel}
      on:click={openImage}
    >
      <span class="f8-image-frame__media">
        <picture>
          {#each sources as source (source.type)}
            <source type={source.type} srcset={source.srcset} {sizes} />
          {/each}
          <img
            src={fallback?.src ?? image.sourcePath}
            {loading}
            {decoding}
            alt={altText}
            width={image.width}
            height={image.height}
            data-f8-image-id={image.id}
          />
        </picture>
      </span>
    </button>
  {:else}
    <picture>
      {#each sources as source (source.type)}
        <source type={source.type} srcset={source.srcset} {sizes} />
      {/each}
      <img
        src={fallback?.src ?? image.sourcePath}
        {loading}
        {decoding}
        alt={altText}
        width={image.width}
        height={image.height}
        data-f8-image-id={image.id}
      />
    </picture>
  {/if}

  {#if caption && (captionContent.title || captionContent.description)}
    <figcaption class="f8-image-frame__caption">
      {#if captionContent.title}
        <strong>{captionContent.title}</strong>
      {/if}
      {#if captionContent.description}
        <span>{captionContent.description}</span>
      {/if}
    </figcaption>
  {/if}
</figure>

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

  .f8-image-frame {
    position: relative;
    display: block;
    width: 100%;
    margin: 0;
    overflow: hidden;
    color: var(--f8-fg);
    background: color-mix(in srgb, var(--f8-muted), transparent 82%);
    border-radius: var(--f8-radius);
    box-shadow: var(--f8-image-shadow, none);
  }

  .f8-image-frame picture,
  .f8-image-frame img,
  .f8-image-frame__media {
    display: block;
    width: 100%;
    height: 100%;
  }

  .f8-image-frame img {
    object-fit: cover;
    background: inherit;
  }

  .f8-image-frame__trigger {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: inherit;
    cursor: zoom-in;
  }

  .f8-image-frame__trigger:focus-visible {
    outline: 3px solid var(--f8-accent);
    outline-offset: 4px;
  }

  .f8-image-frame--interactive img {
    transition:
      scale 180ms ease,
      filter 180ms ease;
  }

  .f8-image-frame--interactive:hover img {
    scale: 1.018;
    filter: brightness(1.04) saturate(1.03);
  }

  .f8-image-frame__caption {
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem 0.1rem 0;
    color: var(--f8-muted);
    font-family: var(
      --f8-font-sans,
      Inter,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .f8-image-frame__caption strong {
    color: var(--f8-fg);
    font-weight: 650;
  }

  @media (prefers-reduced-motion: reduce) {
    .f8-image-frame--interactive img {
      transition: none;
    }

    .f8-image-frame--interactive:hover img {
      scale: 1;
      filter: none;
    }
  }
</style>
