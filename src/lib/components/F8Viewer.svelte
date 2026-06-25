<script lang="ts">
  import { onMount, tick } from 'svelte';

  import type { F8ImageMetadata } from '../types.js';
  import {
    DEFAULT_IMAGE_SIZES,
    fallbackVariant,
    hasLocation,
    imageAlt,
    imageCaption,
    sourceSets
  } from './image-utils.js';

  type MapState = 'idle' | 'loading' | 'ready' | 'unavailable';

  interface MapLibreModule {
    Map: new (options: Record<string, unknown>) => { remove: () => void };
    Marker: new (options: Record<string, unknown>) => {
      setLngLat: (lngLat: [number, number]) => {
        addTo: (map: unknown) => void;
      };
    };
  }

  export let images: F8ImageMetadata[] = [];
  export let open = false;
  export let index = 0;
  export let sizes = DEFAULT_IMAGE_SIZES;
  export let enableMap = true;
  export let enableExifOverlay = true;
  export let onClose: (() => void) | undefined = undefined;
  export let onIndexChange: ((index: number) => void) | undefined = undefined;

  let dialog: HTMLElement | undefined;
  let mapHost: HTMLDivElement | undefined;
  let previousFocus: HTMLElement | null = null;
  let mounted = false;
  let wasOpen = false;
  let infoOpen = false;
  let touchStartX: number | undefined;
  let mapState: MapState = 'idle';
  let mapImageId: string | undefined;
  let mapInstance: { remove: () => void } | undefined;

  $: safeIndex = normalizeIndex(index, images.length);
  $: current = images[safeIndex];
  $: captionContent = current === undefined ? {} : imageCaption(current);
  $: titleId =
    current === undefined ? undefined : `f8-viewer-title-${current.id}`;
  $: captionId =
    current === undefined ? undefined : `f8-viewer-caption-${current.id}`;
  $: fallback = current === undefined ? undefined : fallbackVariant(current);
  $: sources = current === undefined ? [] : sourceSets(current.variants);
  $: canNavigate = images.length > 1;
  $: locationAvailable = current === undefined ? false : hasLocation(current);
  $: if (mounted && open && !wasOpen) {
    wasOpen = true;
    void activateViewer();
  }
  $: if (mounted && !open && wasOpen) {
    wasOpen = false;
    deactivateViewer();
  }
  $: if (
    open &&
    infoOpen &&
    enableMap &&
    locationAvailable &&
    current !== undefined
  ) {
    void ensureMap(current);
  }

  onMount(() => {
    mounted = true;

    if (open) {
      wasOpen = true;
      void activateViewer();
    }

    return () => {
      if (wasOpen) {
        deactivateViewer();
      }
    };
  });

  async function activateViewer(): Promise<void> {
    if (!isBrowser()) {
      return;
    }

    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.setProperty('overflow', 'hidden');
    await tick();
    dialog?.focus();
  }

  function deactivateViewer(): void {
    if (!isBrowser()) {
      return;
    }

    infoOpen = false;
    resetMap();
    document.body.style.removeProperty('overflow');
    previousFocus?.focus();
    previousFocus = null;
  }

  function closeViewer(): void {
    open = false;
    onClose?.();
  }

  function go(delta: number): void {
    if (images.length === 0) {
      return;
    }

    index = normalizeIndex(safeIndex + delta, images.length);
    resetMap();
    onIndexChange?.(index);
  }

  function toggleInfo(): void {
    infoOpen = !infoOpen;
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeViewer();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      toggleInfo();
    } else if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function trapFocus(event: KeyboardEvent): void {
    const focusable = dialog === undefined ? [] : getFocusable(dialog);

    if (focusable.length === 0) {
      event.preventDefault();
      dialog?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function handleTouchStart(event: TouchEvent): void {
    touchStartX = event.changedTouches[0]?.clientX;
  }

  function handleTouchEnd(event: TouchEvent): void {
    if (touchStartX === undefined) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) {
      touchStartX = undefined;
      return;
    }

    const distance = endX - touchStartX;
    touchStartX = undefined;

    if (Math.abs(distance) < 48) {
      return;
    }

    go(distance > 0 ? -1 : 1);
  }

  async function ensureMap(image: F8ImageMetadata): Promise<void> {
    if (
      !isBrowser() ||
      mapState === 'loading' ||
      mapState === 'ready' ||
      mapImageId === image.id
    ) {
      return;
    }

    mapState = 'loading';
    mapImageId = image.id;
    await tick();

    if (
      mapHost === undefined ||
      image.location?.lat === undefined ||
      image.location.lng === undefined
    ) {
      mapState = 'unavailable';
      return;
    }

    try {
      const maplibre =
        (await import('maplibre-gl')) as unknown as MapLibreModule;
      const style = {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'f8-map-background',
            type: 'background',
            paint: { 'background-color': '#1b1a17' }
          }
        ]
      };

      mapInstance = new maplibre.Map({
        container: mapHost,
        style,
        center: [image.location.lng, image.location.lat],
        zoom: 9,
        interactive: false,
        attributionControl: false
      });
      new maplibre.Marker({ color: '#c69b54' })
        .setLngLat([image.location.lng, image.location.lat])
        .addTo(mapInstance);
      mapState = 'ready';
    } catch {
      mapState = 'unavailable';
    }
  }

  function resetMap(): void {
    mapInstance?.remove();
    mapInstance = undefined;
    mapHost = undefined;
    mapState = 'idle';
    mapImageId = undefined;
  }

  function normalizeIndex(value: number, length: number): number {
    if (length <= 0) {
      return 0;
    }

    return ((value % length) + length) % length;
  }

  function getFocusable(root: HTMLElement): HTMLElement[] {
    return [
      ...root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ].filter((element) => !element.hasAttribute('aria-hidden'));
  }

  function isBrowser(): boolean {
    return typeof document !== 'undefined';
  }
</script>

{#if open && current !== undefined}
  <div
    bind:this={dialog}
    class="f8-viewer"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={captionId}
    tabindex="-1"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
    <h2 id={titleId} class="f8-viewer__sr-only">
      {current.title ?? current.alt ?? 'Image viewer'}
    </h2>
    <p class="f8-viewer__sr-only" aria-live="polite">
      Image {safeIndex + 1} of {images.length}
    </p>

    <div class="f8-viewer__chrome" aria-label="Viewer controls">
      <button
        class="f8-viewer__button"
        type="button"
        aria-label="Close viewer"
        on:click={closeViewer}>×</button
      >
      {#if enableExifOverlay}
        <button
          class="f8-viewer__button"
          class:f8-viewer__button--active={infoOpen}
          type="button"
          aria-label={infoOpen
            ? 'Hide image information'
            : 'Show image information'}
          aria-pressed={infoOpen}
          on:click={toggleInfo}
        >
          ℹ
        </button>
      {/if}
    </div>

    {#if canNavigate}
      <button
        class="f8-viewer__nav f8-viewer__nav--prev"
        type="button"
        aria-label="Previous image"
        on:click={() => go(-1)}>‹</button
      >
      <button
        class="f8-viewer__nav f8-viewer__nav--next"
        type="button"
        aria-label="Next image"
        on:click={() => go(1)}>›</button
      >
    {/if}

    <figure class="f8-viewer__figure">
      <picture>
        {#each sources as source (source.type)}
          <source type={source.type} srcset={source.srcset} {sizes} />
        {/each}
        <img
          src={fallback?.src ?? current.sourcePath}
          alt={imageAlt(current)}
          width={current.width}
          height={current.height}
          decoding="async"
          data-f8-viewer-image={current.id}
        />
      </picture>
      {#if captionContent.title || captionContent.description}
        <figcaption id={captionId} class="f8-viewer__caption">
          {#if captionContent.title}<strong>{captionContent.title}</strong>{/if}
          {#if captionContent.description}<span
              >{captionContent.description}</span
            >{/if}
        </figcaption>
      {/if}
    </figure>

    {#if enableExifOverlay && infoOpen}
      <aside class="f8-viewer__overlay" aria-label="Image information">
        <div>
          {#if captionContent.title}<h2>{captionContent.title}</h2>{/if}
          {#if captionContent.description}<p>
              {captionContent.description}
            </p>{/if}
        </div>

        <dl class="f8-viewer__meta">
          {#if current.exif?.camera}<div>
              <dt>▣ Camera</dt>
              <dd>{current.exif.camera}</dd>
            </div>{/if}
          {#if current.exif?.lens}<div>
              <dt>⌁ Lens</dt>
              <dd>{current.exif.lens}</dd>
            </div>{/if}
          {#if current.exif?.aperture}<div>
              <dt>◐ Aperture</dt>
              <dd>{current.exif.aperture}</dd>
            </div>{/if}
          {#if current.exif?.shutter}<div>
              <dt>◒ Shutter</dt>
              <dd>{current.exif.shutter}</dd>
            </div>{/if}
          {#if current.exif?.iso}<div>
              <dt>◌ ISO</dt>
              <dd>{current.exif.iso}</dd>
            </div>{/if}
          {#if current.exif?.focalLength}<div>
              <dt>⌖ Focal length</dt>
              <dd>{current.exif.focalLength}</dd>
            </div>{/if}
          {#if current.exif?.capturedAt}<div>
              <dt>◷ Captured</dt>
              <dd>{current.exif.capturedAt}</dd>
            </div>{/if}
          {#if current.location?.label}<div>
              <dt>⌾ Location</dt>
              <dd>{current.location.label}</dd>
            </div>{/if}
        </dl>

        {#if enableMap && locationAvailable}
          <div class="f8-viewer__map" aria-label="Map preview">
            <div bind:this={mapHost} class="f8-viewer__map-canvas"></div>
            {#if mapState === 'loading'}<span>Loading map…</span>{/if}
            {#if mapState === 'unavailable'}<span>Map preview unavailable</span
              >{/if}
          </div>
        {/if}
      </aside>
    {/if}
  </div>
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

  .f8-viewer {
    position: fixed;
    z-index: 9999;
    inset: 0;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 3vw, 2rem);
    color: var(--f8-fg);
    background: rgb(10 9 8 / 94%);
    backdrop-filter: blur(18px);
    animation: f8-viewer-in 180ms ease-out;
  }

  .f8-viewer:focus {
    outline: none;
  }

  .f8-viewer__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .f8-viewer__chrome,
  .f8-viewer__nav {
    position: fixed;
    z-index: 2;
  }

  .f8-viewer__chrome {
    top: max(1rem, env(safe-area-inset-top));
    right: max(1rem, env(safe-area-inset-right));
    display: flex;
    gap: 0.6rem;
  }

  .f8-viewer__button,
  .f8-viewer__nav {
    display: grid;
    place-items: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    color: #fff8ed;
    font: inherit;
    font-size: 1.4rem;
    background: rgb(255 255 255 / 10%);
    border: 1px solid rgb(255 255 255 / 16%);
    border-radius: 999px;
    box-shadow: var(--f8-shadow);
    cursor: pointer;
  }

  .f8-viewer__button--active,
  .f8-viewer__button:hover,
  .f8-viewer__nav:hover {
    background: rgb(198 155 84 / 42%);
  }

  .f8-viewer__button:focus-visible,
  .f8-viewer__nav:focus-visible {
    outline: 3px solid var(--f8-accent);
    outline-offset: 3px;
  }

  .f8-viewer__nav {
    top: 50%;
    transform: translateY(-50%);
  }

  .f8-viewer__nav--prev {
    left: max(1rem, env(safe-area-inset-left));
  }

  .f8-viewer__nav--next {
    right: max(1rem, env(safe-area-inset-right));
  }

  .f8-viewer__figure {
    display: grid;
    gap: 1rem;
    max-width: min(92vw, 1440px);
    max-height: 92vh;
    margin: 0;
  }

  .f8-viewer__figure picture,
  .f8-viewer__figure img {
    display: block;
    max-width: 100%;
    max-height: min(82vh, 1100px);
    margin: auto;
    border-radius: calc(var(--f8-radius) * 0.7);
  }

  .f8-viewer__figure img {
    width: auto;
    height: auto;
    object-fit: contain;
    box-shadow: var(--f8-shadow);
  }

  .f8-viewer__caption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    justify-content: center;
    color: #ded3c1;
    font-family: var(
      --f8-font-sans,
      Inter,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    font-size: 0.95rem;
    line-height: 1.45;
    text-align: center;
  }

  .f8-viewer__caption strong {
    color: #fff8ed;
  }

  .f8-viewer__overlay {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    z-index: 3;
    width: min(26rem, calc(100vw - 2rem));
    max-height: min(72vh, 42rem);
    padding: 1rem;
    overflow: auto;
    color: var(--f8-fg);
    background: var(--f8-overlay-bg);
    border: 1px solid var(--f8-border);
    border-radius: var(--f8-radius);
    box-shadow: var(--f8-shadow);
    backdrop-filter: blur(24px);
    animation: f8-overlay-in 160ms ease-out;
  }

  .f8-viewer__overlay h2,
  .f8-viewer__overlay p {
    margin: 0;
  }

  .f8-viewer__overlay p {
    margin-top: 0.45rem;
    color: var(--f8-muted);
    line-height: 1.55;
  }

  .f8-viewer__meta {
    display: grid;
    gap: 0.7rem;
    margin: 1rem 0 0;
    font-family: var(
      --f8-font-sans,
      Inter,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .f8-viewer__meta div {
    display: grid;
    grid-template-columns: minmax(7.5rem, 38%) 1fr;
    gap: 1rem;
  }

  .f8-viewer__meta dt {
    color: var(--f8-muted);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .f8-viewer__meta dd {
    margin: 0;
    font-size: 0.9rem;
  }

  .f8-viewer__map {
    position: relative;
    min-height: 10rem;
    margin-top: 1rem;
    overflow: hidden;
    background: #1b1a17;
    border: 1px solid var(--f8-border);
    border-radius: calc(var(--f8-radius) * 0.75);
  }

  .f8-viewer__map-canvas {
    position: absolute;
    inset: 0;
  }

  .f8-viewer__map span {
    position: absolute;
    inset: auto 0 0;
    padding: 0.65rem 0.8rem;
    color: #efe6d7;
    background: rgb(0 0 0 / 56%);
    font-size: 0.85rem;
  }

  @keyframes f8-viewer-in {
    from {
      opacity: 0;
      transform: scale(0.985);
    }
  }

  @keyframes f8-overlay-in {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
  }

  @media (width <= 720px) {
    .f8-viewer {
      padding: 0.75rem;
    }

    .f8-viewer__nav {
      top: auto;
      bottom: max(1rem, env(safe-area-inset-bottom));
      transform: none;
    }

    .f8-viewer__overlay {
      right: 0.75rem;
      bottom: 5rem;
      left: 0.75rem;
      width: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .f8-viewer,
    .f8-viewer__overlay {
      animation: none;
    }
  }
</style>
