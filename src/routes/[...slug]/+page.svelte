<script lang="ts">
  import { onMount } from 'svelte';

  import F8Viewer from '$lib/components/F8Viewer.svelte';
  import type { PageData } from './$types.js';

  let { data }: { data: PageData } = $props();
  const page = $derived(data.page);
  let viewerOpen = $state(false);
  let viewerIndex = $state(0);
  let articleElement: HTMLElement | undefined = $state();

  onMount(() => {
    const article = articleElement;
    if (article === undefined) {
      return;
    }

    article.addEventListener('click', openViewerFromTrigger);
    return () => {
      article.removeEventListener('click', openViewerFromTrigger);
    };
  });

  function openViewerFromTrigger(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || hasModifier(event)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof globalThis.Element)) {
      return;
    }

    const trigger = target.closest('a[data-f8-viewer-trigger]');
    if (!(trigger instanceof globalThis.HTMLAnchorElement)) {
      return;
    }

    const imageId = trigger.dataset.f8ImageId;
    const nextIndex = page.images.findIndex((image) => image.id === imageId);
    if (nextIndex === -1) {
      return;
    }

    event.preventDefault();
    viewerIndex = nextIndex;
    viewerOpen = true;
  }

  function hasModifier(event: MouseEvent): boolean {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  }
</script>

<svelte:head>
  <title>{page.seo.title}</title>
  {#if page.seo.description !== undefined}
    <meta name="description" content={page.seo.description} />
  {/if}
  {#if page.seo.canonical !== undefined}
    <link rel="canonical" href={page.seo.canonical} />
  {/if}
  <meta property="og:type" content={page.seo.openGraph.type} />
  <meta property="og:title" content={page.seo.openGraph.title} />
  {#if page.seo.openGraph.description !== undefined}
    <meta property="og:description" content={page.seo.openGraph.description} />
  {/if}
  {#if page.seo.openGraph.image !== undefined}
    <meta property="og:image" content={page.seo.openGraph.image} />
  {/if}
  {#if page.seo.openGraph.url !== undefined}
    <meta property="og:url" content={page.seo.openGraph.url} />
  {/if}
  <meta name="twitter:card" content={page.seo.twitter.card} />
  <meta name="twitter:title" content={page.seo.twitter.title} />
  {#if page.seo.twitter.description !== undefined}
    <meta name="twitter:description" content={page.seo.twitter.description} />
  {/if}
  {#if page.seo.twitter.image !== undefined}
    <meta name="twitter:image" content={page.seo.twitter.image} />
  {/if}
</svelte:head>

<main
  class="f8-shell py-8 sm:py-12 lg:py-20"
  data-theme={page.frontmatter.theme ?? 'system'}
>
  <header
    class="site-hero f8-container mb-24 pt-10 sm:mb-32 lg:mb-40 lg:pt-20"
    aria-labelledby="page-title"
  >
    <p class="f8-eyebrow mb-5">f8 static site</p>
    <h1 id="page-title" class="f8-display">
      {page.frontmatter.title ?? 'Image-first stories'}
    </h1>
    {#if page.frontmatter.description !== undefined}
      <p class="f8-dek mt-8">{page.frontmatter.description}</p>
    {/if}
  </header>

  <article
    bind:this={articleElement}
    class="f8-page prose prose-f8 prose-lg sm:prose-xl"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html page.html}
  </article>

  <F8Viewer
    images={page.images}
    bind:open={viewerOpen}
    bind:index={viewerIndex}
    enableMap={page.viewer.enableMap}
    enableMapZoom={page.viewer.enableMapZoom}
    showMapAttribution={page.viewer.showMapAttribution}
    enableMapMarkerLink={page.viewer.enableMapMarkerLink}
    mapMarkerUrlTemplate={page.viewer.mapMarkerUrlTemplate}
    enableExifOverlay={page.viewer.enableExifOverlay}
    mapStyleUrl={page.viewer.mapStyleUrl}
  />
</main>
