<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import type { TransitionConfig } from 'svelte/transition';

  import type { F8ImageMetadata } from '../types.js';
  import { DEFAULT_MAP_MARKER_URL_TEMPLATE } from '../viewer-defaults.js';
  import {
    DEFAULT_IMAGE_SIZES,
    fallbackVariant,
    hasLocation,
    imageAlt,
    imageCaption,
    sourceSets
  } from './image-utils.js';

  type MapState = 'idle' | 'loading' | 'ready' | 'unavailable';
  type NavigationDirection = -1 | 0 | 1;

  interface ImageTransitionParams {
    direction: NavigationDirection;
  }

  interface MapLibreModule {
    Map: new (options: Record<string, unknown>) => {
      remove: () => void;
      resize: () => void;
    };
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
  export let enableMapZoom = true;
  export let showMapAttribution = false;
  export let enableMapMarkerLink = true;
  export let mapMarkerUrlTemplate = DEFAULT_MAP_MARKER_URL_TEMPLATE;
  export let enableExifOverlay = true;
  export let mapStyleUrl: string | undefined = undefined;
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
  let mapInstance: { remove: () => void; resize: () => void } | undefined;
  let navigationDirection: NavigationDirection = 0;
  const navigationState: {
    imageId: string | undefined;
    index: number | undefined;
  } = {
    imageId: undefined,
    index: undefined
  };

  $: safeIndex = normalizeIndex(index, images.length);
  $: current = images[safeIndex];
  $: navigationDirection = updateNavigationDirection(
    current?.id,
    safeIndex,
    images.length
  );
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

  function viewerBackdrop(node: HTMLElement): TransitionConfig {
    void node;

    if (prefersReducedMotion()) {
      return { duration: 0 };
    }

    return {
      duration: 160,
      easing: cubicOut,
      css: (t) => `opacity: ${t}`
    };
  }

  function imageIntro(
    node: HTMLElement,
    { direction }: ImageTransitionParams
  ): TransitionConfig {
    void node;

    return imageMotion(direction, 170);
  }

  function imageOutro(
    node: HTMLElement,
    { direction }: ImageTransitionParams
  ): TransitionConfig {
    void node;

    return imageMotion(reverseNavigationDirection(direction), 130);
  }

  function imageMotion(
    direction: NavigationDirection,
    duration: number
  ): TransitionConfig {
    if (prefersReducedMotion()) {
      return { duration: 0 };
    }

    const x = direction * 22;

    return {
      duration,
      easing: cubicOut,
      css: (t, u) => `
        opacity: ${t};
        transform: translate3d(${x * u}px, 0, 0) scale(${0.995 + t * 0.005});
      `
    };
  }

  function overlayReveal(node: HTMLElement): TransitionConfig {
    void node;

    if (prefersReducedMotion()) {
      return { duration: 0 };
    }

    return {
      duration: 150,
      easing: cubicOut,
      css: (t, u) => `
        opacity: ${t};
        transform: translate3d(0, ${0.45 * u}rem, 0);
      `
    };
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
      mapStyleUrl === undefined ||
      image.location?.lat === undefined ||
      image.location.lng === undefined
    ) {
      mapState = 'unavailable';
      return;
    }

    try {
      const maplibre =
        (await import('maplibre-gl')) as unknown as MapLibreModule;

      mapInstance = new maplibre.Map({
        container: mapHost,
        style: mapStyleUrl,
        center: [image.location.lng, image.location.lat],
        zoom: 9,
        interactive: enableMapZoom,
        scrollZoom: enableMapZoom,
        boxZoom: enableMapZoom,
        doubleClickZoom: enableMapZoom,
        touchZoomRotate: enableMapZoom,
        dragPan: enableMapZoom,
        dragRotate: false,
        keyboard: enableMapZoom,
        attributionControl: showMapAttribution
      });
      new maplibre.Marker({
        anchor: 'center',
        element: createMapMarkerElement(image)
      })
        .setLngLat([image.location.lng, image.location.lat])
        .addTo(mapInstance);
      mapInstance.resize();
      mapState = 'ready';
    } catch {
      mapState = 'unavailable';
    }
  }

  function resetMap(): void {
    mapInstance?.remove();
    mapInstance = undefined;
    mapState = 'idle';
    mapImageId = undefined;
  }

  function createMapMarkerElement(image: F8ImageMetadata): HTMLElement {
    const markerUrl = mapMarkerUrl(image);
    const marker =
      markerUrl === undefined
        ? document.createElement('div')
        : document.createElement('a');
    marker.className = 'f8-viewer__map-marker';

    if (
      markerUrl !== undefined &&
      marker instanceof globalThis.HTMLAnchorElement
    ) {
      marker.href = markerUrl;
      marker.target = '_blank';
      marker.rel = 'noopener noreferrer';
      marker.ariaLabel = 'Open location in Google Earth';
      marker.title = 'Open location in Google Earth';
    } else {
      marker.setAttribute('aria-hidden', 'true');
    }

    const pulse = document.createElement('span');
    pulse.className = 'f8-viewer__map-marker-pulse';
    const core = document.createElement('span');
    core.className = 'f8-viewer__map-marker-core';
    const glint = document.createElement('span');
    glint.className = 'f8-viewer__map-marker-glint';

    marker.append(pulse, core, glint);
    return marker;
  }

  function mapMarkerUrl(image: F8ImageMetadata): string | undefined {
    if (
      !enableMapMarkerLink ||
      image.location?.lat === undefined ||
      image.location.lng === undefined
    ) {
      return undefined;
    }

    return mapMarkerUrlTemplate
      .replaceAll('{lat}', formatCoordinate(image.location.lat))
      .replaceAll('{latitude}', formatCoordinate(image.location.lat))
      .replaceAll('{lng}', formatCoordinate(image.location.lng))
      .replaceAll('{longitude}', formatCoordinate(image.location.lng));
  }

  function formatCoordinate(value: number): string {
    return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  function normalizeIndex(value: number, length: number): number {
    if (length <= 0) {
      return 0;
    }

    return ((value % length) + length) % length;
  }

  function updateNavigationDirection(
    imageId: string | undefined,
    nextIndex: number,
    imageCount: number
  ): NavigationDirection {
    if (imageId === navigationState.imageId) {
      navigationState.index = nextIndex;
      return navigationDirection;
    }

    const direction =
      navigationState.index === undefined || imageId === undefined
        ? 0
        : navigationDirectionFor(navigationState.index, nextIndex, imageCount);

    navigationState.imageId = imageId;
    navigationState.index = nextIndex;

    return direction;
  }

  function navigationDirectionFor(
    previous: number,
    next: number,
    length: number
  ): NavigationDirection {
    if (length <= 1) {
      return 0;
    }

    const start = normalizeIndex(previous, length);
    const end = normalizeIndex(next, length);

    if (start === end) {
      return 0;
    }

    const forwardDistance = normalizeIndex(end - start, length);
    const backwardDistance = normalizeIndex(start - end, length);

    return forwardDistance <= backwardDistance ? 1 : -1;
  }

  function reverseNavigationDirection(
    direction: NavigationDirection
  ): NavigationDirection {
    if (direction === 0) {
      return 0;
    }

    return direction === 1 ? -1 : 1;
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

  function prefersReducedMotion(): boolean {
    const view = isBrowser() ? document.defaultView : undefined;
    const animationsUnsupported =
      !isBrowser() || typeof document.documentElement.animate !== 'function';

    return (
      animationsUnsupported ||
      (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    );
  }
</script>

{#if open && current !== undefined}
  <div
    bind:this={dialog}
    class="f8-viewer"
    transition:viewerBackdrop
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

    {#key current.id}
      <figure
        class="f8-viewer__figure"
        in:imageIntro={{ direction: navigationDirection }}
        out:imageOutro={{ direction: navigationDirection }}
      >
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
            {#if captionContent.title}<strong>{captionContent.title}</strong
              >{/if}
            {#if captionContent.description}<span
                >{captionContent.description}</span
              >{/if}
          </figcaption>
        {/if}
      </figure>
    {/key}

    {#if enableExifOverlay && infoOpen}
      <aside
        class="f8-viewer__overlay"
        aria-label="Image information"
        transition:overlayReveal
      >
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
    color: #eef1ea;
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
    background: color-mix(in srgb, var(--f8-accent), transparent 58%);
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
    grid-area: 1 / 1;
    display: grid;
    gap: 1rem;
    max-width: min(92vw, 1440px);
    max-height: 92vh;
    margin: 0;
    will-change: opacity, transform;
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
    color: #cfd6cc;
    font-family: var(
      --f8-font-sans,
      'Noto Sans Variable',
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    font-size: 0.95rem;
    line-height: 1.45;
    text-align: center;
  }

  .f8-viewer__caption strong {
    color: #eef1ea;
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
      'Noto Sans Variable',
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
    background: #1a1f1a;
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
    color: #ece8df;
    background: rgb(0 0 0 / 56%);
    font-size: 0.85rem;
  }

  .f8-viewer__map :global(.maplibregl-map),
  .f8-viewer__map :global(.maplibregl-canvas-container) {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .f8-viewer__map :global(.maplibregl-canvas) {
    position: absolute;
    top: 0;
    left: 0;
  }

  .f8-viewer__map :global(.maplibregl-control-container) {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .f8-viewer__map :global(.maplibregl-ctrl-bottom-right) {
    position: absolute;
    right: 0;
    bottom: 0;
  }

  .f8-viewer__map :global(.maplibregl-ctrl),
  .f8-viewer__map :global(.maplibregl-ctrl a) {
    pointer-events: auto;
  }

  .f8-viewer__map :global(.maplibregl-ctrl-attrib) {
    padding: 0.15rem 0.35rem;
    color: #111;
    background: rgb(255 255 255 / 72%);
    font-family: var(--f8-font-sans, system-ui, sans-serif);
    font-size: 0.62rem;
    line-height: 1.3;
  }

  .f8-viewer__map :global(.maplibregl-ctrl-attrib a) {
    color: inherit;
  }

  .f8-viewer__map :global(.maplibregl-marker) {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  .f8-viewer__map :global(.f8-viewer__map-marker) {
    position: relative;
    display: block;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    color: inherit;
    cursor: pointer;
    text-decoration: none;
  }

  .f8-viewer__map :global(.f8-viewer__map-marker:focus-visible) {
    outline: 2px solid #ece8df;
    outline-offset: 0.35rem;
  }

  .f8-viewer__map :global(.f8-viewer__map-marker-pulse),
  .f8-viewer__map :global(.f8-viewer__map-marker-core),
  .f8-viewer__map :global(.f8-viewer__map-marker-glint) {
    position: absolute;
    inset: 50% auto auto 50%;
    border-radius: 999px;
    translate: -50% -50%;
  }

  .f8-viewer__map :global(.f8-viewer__map-marker-pulse) {
    width: 2.2rem;
    height: 2.2rem;
    background: color-mix(in srgb, var(--f8-accent), transparent 72%);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--f8-accent), white 20%);
    animation: f8-map-marker-pulse 1.9s ease-out infinite;
  }

  .f8-viewer__map :global(.f8-viewer__map-marker-core) {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--f8-accent);
    box-shadow:
      0 0 0 0.24rem rgb(18 16 14 / 82%),
      0 0 0 0.34rem color-mix(in srgb, var(--f8-accent), white 18%),
      0 0.45rem 1rem rgb(0 0 0 / 45%);
  }

  .f8-viewer__map :global(.f8-viewer__map-marker-glint) {
    width: 0.22rem;
    height: 0.22rem;
    margin: -0.13rem 0 0 0.13rem;
    background: #ece8df;
  }

  @keyframes f8-map-marker-pulse {
    from {
      opacity: 0.85;
      scale: 0.58;
    }

    to {
      opacity: 0;
      scale: 1.55;
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
    .f8-viewer__figure {
      will-change: auto;
    }

    .f8-viewer__map :global(.f8-viewer__map-marker-pulse) {
      animation: none;
      opacity: 0;
    }
  }
</style>
