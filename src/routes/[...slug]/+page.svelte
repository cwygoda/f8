<script lang="ts">
  import type { PageData } from './$types.js';

  let { data }: { data: PageData } = $props();
  const page = $derived(data.page);
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

<main class="site-shell" data-theme={page.frontmatter.theme ?? 'system'}>
  <header class="site-hero" aria-labelledby="page-title">
    <p class="eyebrow">f8 static site</p>
    <h1 id="page-title">{page.frontmatter.title ?? 'Image-first stories'}</h1>
    {#if page.frontmatter.description !== undefined}
      <p class="dek">{page.frontmatter.description}</p>
    {/if}
  </header>

  <article class="f8-page">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html page.html}
  </article>
</main>

<style>
  :global(:root) {
    color-scheme: light dark;
    --f8-font-sans:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', sans-serif;
    --f8-font-serif: ui-serif, Georgia, Cambria, serif;
    --f8-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --f8-bg: #f8f3ea;
    --f8-fg: #181410;
    --f8-muted: #6e6255;
    --f8-border: rgb(24 20 16 / 14%);
    --f8-accent: #9f6c26;
    --f8-overlay-bg: rgb(248 243 234 / 86%);
    --f8-shadow: 0 28px 90px rgb(45 30 12 / 16%);
    --f8-radius: 24px;
    --f8-gap: clamp(0.85rem, 2vw, 1.5rem);
  }

  :global(body) {
    margin: 0;
    font-family: var(--f8-font-sans);
    color: var(--f8-fg);
    background:
      radial-gradient(
        circle at 80% 2rem,
        color-mix(in srgb, var(--f8-accent), transparent 82%),
        transparent 28rem
      ),
      var(--f8-bg);
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --f8-bg: #12100e;
      --f8-fg: #f7f1e8;
      --f8-muted: #c8bcad;
      --f8-border: rgb(247 241 232 / 15%);
      --f8-accent: #d1a45f;
      --f8-overlay-bg: rgb(18 16 14 / 88%);
      --f8-shadow: 0 30px 100px rgb(0 0 0 / 42%);
    }
  }

  .site-shell[data-theme='light'] {
    color-scheme: light;
    --f8-bg: #f8f3ea;
    --f8-fg: #181410;
    --f8-muted: #6e6255;
    --f8-border: rgb(24 20 16 / 14%);
    --f8-accent: #9f6c26;
  }

  .site-shell[data-theme='dark'] {
    color-scheme: dark;
    --f8-bg: #12100e;
    --f8-fg: #f7f1e8;
    --f8-muted: #c8bcad;
    --f8-border: rgb(247 241 232 / 15%);
    --f8-accent: #d1a45f;
  }

  .site-shell {
    box-sizing: border-box;
    min-height: 100svh;
    padding: clamp(1.25rem, 4vw, 4rem);
  }

  .site-hero {
    max-width: 1180px;
    margin: 0 auto clamp(3rem, 9vw, 7rem);
    padding-top: clamp(2rem, 5vw, 5rem);
  }

  .eyebrow {
    margin: 0 0 1rem;
    color: var(--f8-accent);
    font-size: 0.78rem;
    font-weight: 850;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 12ch;
    margin: 0;
    font-size: clamp(3rem, 10vw, 8.5rem);
    line-height: 0.88;
    letter-spacing: -0.07em;
  }

  .dek {
    max-width: 42rem;
    margin: clamp(1.25rem, 3vw, 2rem) 0 0;
    color: var(--f8-muted);
    font-size: clamp(1.08rem, 2vw, 1.35rem);
    line-height: 1.7;
  }

  .f8-page {
    max-width: 740px;
    margin: 0 auto;
    font-family: var(--f8-font-serif);
    font-size: clamp(1.05rem, 1.5vw, 1.22rem);
    line-height: 1.78;
  }

  .f8-page :global(h1),
  .f8-page :global(h2),
  .f8-page :global(h3) {
    font-family: var(--f8-font-sans);
    line-height: 1.02;
    letter-spacing: -0.05em;
  }

  .f8-page :global(h1) {
    display: none;
  }

  .f8-page :global(h2) {
    margin: 4rem 0 1rem;
    font-size: clamp(2rem, 5vw, 4rem);
  }

  .f8-page :global(p),
  .f8-page :global(ul),
  .f8-page :global(ol) {
    margin: 1.25rem 0;
  }

  .f8-page :global(a) {
    color: var(--f8-accent);
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.2em;
  }

  .f8-page :global(code) {
    border: 1px solid var(--f8-border);
    border-radius: 0.4rem;
    padding: 0.12rem 0.32rem;
    font-family: var(--f8-font-mono);
    font-size: 0.88em;
  }

  .f8-page :global(pre) {
    overflow: auto;
    border: 1px solid var(--f8-border);
    border-radius: var(--f8-radius);
    padding: 1rem;
    background: color-mix(in srgb, var(--f8-fg), transparent 94%);
  }

  .f8-page :global(pre code) {
    border: 0;
    padding: 0;
    background: transparent;
  }

  .f8-page :global(.f8-figure),
  .f8-page :global(.f8-gallery) {
    width: min(1180px, calc(100vw - clamp(2rem, 8vw, 8rem)));
    margin: clamp(2.5rem, 7vw, 5rem)
      calc((740px - min(1180px, calc(100vw - clamp(2rem, 8vw, 8rem)))) / 2);
  }

  .f8-page :global(.f8-gallery__grid) {
    columns: 1;
    column-gap: var(--f8-gap);
  }

  .f8-page :global(.f8-gallery__item) {
    display: inline-block;
    width: 100%;
    margin: 0 0 var(--f8-gap);
    break-inside: avoid;
  }

  .f8-page :global(.f8-image__trigger) {
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .f8-page :global(.f8-image) {
    display: block;
    overflow: hidden;
    border-radius: var(--f8-radius);
    box-shadow: var(--f8-shadow);
  }

  .f8-page :global(.f8-image img),
  .f8-page :global(img) {
    display: block;
    width: 100%;
    height: auto;
  }

  .f8-page :global(.f8-figure__caption),
  .f8-page :global(.f8-gallery__caption) {
    max-width: 42rem;
    margin: 0.8rem 0 0;
    color: var(--f8-muted);
    font-family: var(--f8-font-sans);
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .f8-page :global(.f8-gallery__caption) {
    margin-bottom: 0.5rem;
  }

  .f8-page :global(.f8-figure__caption-title),
  .f8-page :global(.f8-gallery__caption-title) {
    color: var(--f8-fg);
  }

  @media (min-width: 44rem) {
    .f8-page :global(.f8-gallery__grid) {
      columns: 2;
    }
  }

  @media (min-width: 70rem) {
    .f8-page :global(.f8-gallery__grid) {
      columns: 3;
    }
  }

  @media (max-width: 820px) {
    .f8-page :global(.f8-figure),
    .f8-page :global(.f8-gallery) {
      width: 100%;
      margin-right: 0;
      margin-left: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .f8-page :global(.f8-image__trigger img) {
      transition:
        scale 220ms ease,
        filter 220ms ease;
    }

    .f8-page :global(.f8-image__trigger:hover img) {
      scale: 1.025;
      filter: saturate(1.04) brightness(1.03);
    }
  }
</style>
