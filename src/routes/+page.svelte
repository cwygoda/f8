<svelte:head>
  <title>f8</title>
  <meta
    name="description"
    content="Image-first publishing toolkit for SvelteKit"
  />
</svelte:head>

<main class="shell">
  <p class="eyebrow">f8</p>
  <h1>Image-first publishing toolkit for SvelteKit.</h1>
  <p>
    Milestone 2 adds cache-aware image discovery, responsive variants, sidecar
    metadata, EXIF artifacts, blurhash placeholders, and dominant colors.
  </p>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
    color: #f7f3ea;
    background: #141210;
  }

  .shell {
    box-sizing: border-box;
    min-height: 100svh;
    max-width: 760px;
    padding: clamp(3rem, 10vw, 8rem) clamp(1.25rem, 5vw, 4rem);
  }

  .eyebrow {
    margin: 0 0 1rem;
    color: #c8a86a;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.75rem, 10vw, 6.5rem);
    line-height: 0.95;
    letter-spacing: -0.06em;
  }

  p:last-child {
    max-width: 36rem;
    margin-top: 1.5rem;
    color: #cfc7b8;
    font-size: clamp(1.05rem, 2vw, 1.25rem);
    line-height: 1.7;
  }
</style>
