<script lang="ts">
  import { F8Gallery } from '$lib/svelte/index.js';
  import type { F8ImageMetadata } from '$lib/types.js';

  const demoImages: F8ImageMetadata[] = [
    {
      id: 'demo-aurora',
      sourcePath: '/demo/aurora-640.jpeg',
      relativePath: 'demo/aurora.jpeg',
      alt: 'Abstract golden light over a blue alpine scene',
      title: 'Alpine blue hour',
      description:
        'Responsive image markup, captions, and viewer controls from f8 metadata.',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      dominantColors: ['#20364a'],
      variants: [
        {
          width: 1200,
          height: 800,
          format: 'jpeg',
          src: '/demo/aurora-640.jpeg',
          sizeBytes: 15_000
        }
      ],
      exif: {
        camera: 'f8 Demo Camera',
        lens: '28mm editorial prime',
        aperture: 'f/4',
        shutter: '1/250',
        iso: 200,
        focalLength: '28mm'
      }
    },
    {
      id: 'demo-canyon',
      sourcePath: '/demo/canyon-640.jpeg',
      relativePath: 'demo/canyon.jpeg',
      alt: 'Warm abstract canyon light',
      title: 'Canyon study',
      description:
        'Masonry layout balances mixed aspect ratios with accessible image buttons.',
      width: 900,
      height: 1200,
      aspectRatio: 0.75,
      dominantColors: ['#5b3427'],
      variants: [
        {
          width: 900,
          height: 1200,
          format: 'jpeg',
          src: '/demo/canyon-640.jpeg',
          sizeBytes: 17_000
        }
      ],
      exif: {
        camera: 'f8 Demo Camera',
        aperture: 'f/5.6',
        shutter: '1/500',
        iso: 100
      }
    },
    {
      id: 'demo-forest',
      sourcePath: '/demo/forest-640.jpeg',
      relativePath: 'demo/forest.jpeg',
      alt: 'Green abstract forest gradient',
      title: 'Forest hush',
      description:
        'The fullscreen viewer supports keyboard navigation, swipe, and focus restoration.',
      width: 1100,
      height: 900,
      aspectRatio: 1.22,
      dominantColors: ['#1d3a30'],
      variants: [
        {
          width: 1100,
          height: 900,
          format: 'jpeg',
          src: '/demo/forest-640.jpeg',
          sizeBytes: 19_000
        }
      ],
      exif: {
        camera: 'f8 Demo Camera',
        lens: '50mm',
        aperture: 'f/2.8',
        focalLength: '50mm'
      }
    },
    {
      id: 'demo-coast',
      sourcePath: '/demo/coast-640.jpeg',
      relativePath: 'demo/coast.jpeg',
      alt: 'Muted coastal abstract scene',
      title: 'Quiet coast',
      description:
        'CSS variables make the components ready for project-level theming.',
      width: 1000,
      height: 1250,
      aspectRatio: 0.8,
      dominantColors: ['#24384d'],
      variants: [
        {
          width: 1000,
          height: 1250,
          format: 'jpeg',
          src: '/demo/coast-640.jpeg',
          sizeBytes: 19_000
        }
      ],
      exif: {
        camera: 'f8 Demo Camera',
        shutter: '1/1000',
        iso: 160,
        focalLength: '35mm'
      }
    }
  ];
</script>

<svelte:head>
  <title>f8 — image-first publishing toolkit</title>
  <meta
    name="description"
    content="Image-first publishing toolkit for SvelteKit with responsive image processing, Markdown rendering, galleries, and an immersive viewer."
  />
</svelte:head>

<main class="shell f8-theme">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__copy">
      <p class="eyebrow">f8 · Milestone 4</p>
      <h1 id="hero-title">Image-first publishing for SvelteKit.</h1>
      <p class="lede">
        Turn folders of images and Markdown into responsive visual stories with
        semantic rendering, masonry galleries, and an accessible full-screen
        viewer.
      </p>
      <div class="actions" aria-label="Project highlights">
        <span>Responsive variants</span>
        <span>Markdown image blocks</span>
        <span>Svelte components</span>
      </div>
    </div>

    <aside class="status" aria-label="Milestone status">
      <strong>Now shipping</strong>
      <ul>
        <li><span>✓</span> F8Image, F8Gallery, F8Viewer</li>
        <li><span>✓</span> Keyboard, swipe, overlay controls</li>
        <li><span>✓</span> CSS-variable themes and SSR tests</li>
      </ul>
    </aside>
  </section>

  <section class="demo" aria-labelledby="demo-title">
    <div class="demo__intro">
      <p class="eyebrow">Component demo</p>
      <h2 id="demo-title">A real f8 gallery, rendered on the landing page.</h2>
      <p>
        Click any image to open the viewer. Use arrow keys for previous/next, <kbd
          >i</kbd
        >
        for metadata, and <kbd>Esc</kbd> to close.
      </p>
    </div>

    <F8Gallery
      images={demoImages}
      gap="clamp(0.85rem, 2vw, 1.35rem)"
      enableMap={false}
    />
  </section>
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
    background:
      radial-gradient(
        circle at 78% 8%,
        rgb(198 155 84 / 18%),
        transparent 32rem
      ),
      linear-gradient(135deg, #171411 0%, #0f1114 48%, #15120f 100%);
  }

  .shell {
    --f8-bg: #141210;
    --f8-fg: #f7f3ea;
    --f8-muted: #cfc7b8;
    --f8-border: rgb(247 243 234 / 14%);
    --f8-accent: #c8a86a;
    --f8-overlay-bg: rgb(20 18 16 / 86%);
    --f8-shadow: 0 30px 100px rgb(0 0 0 / 36%);
    --f8-radius: 22px;
    --f8-gap: clamp(0.85rem, 2vw, 1.35rem);
    box-sizing: border-box;
    min-height: 100svh;
    padding: clamp(2rem, 6vw, 5rem);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
    gap: clamp(2rem, 6vw, 6rem);
    align-items: end;
    max-width: 1180px;
    margin: 0 auto clamp(4rem, 9vw, 7rem);
  }

  .hero__copy {
    max-width: 780px;
  }

  .eyebrow {
    margin: 0 0 1rem;
    color: var(--f8-accent);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
    letter-spacing: -0.06em;
  }

  h1 {
    max-width: 11ch;
    font-size: clamp(3.4rem, 11vw, 9rem);
    line-height: 0.86;
  }

  h2 {
    max-width: 13ch;
    font-size: clamp(2rem, 6vw, 4.25rem);
    line-height: 0.95;
  }

  .lede {
    max-width: 42rem;
    margin: 1.5rem 0 0;
    color: var(--f8-muted);
    font-size: clamp(1.05rem, 2vw, 1.3rem);
    line-height: 1.7;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    margin-top: 1.7rem;
  }

  .actions span,
  .status,
  kbd {
    border: 1px solid var(--f8-border);
    background: rgb(255 255 255 / 6%);
    box-shadow: 0 18px 70px rgb(0 0 0 / 18%);
    backdrop-filter: blur(18px);
  }

  .actions span {
    padding: 0.62rem 0.86rem;
    border-radius: 999px;
    color: #eee2d0;
    font-size: 0.9rem;
  }

  .status {
    padding: 1.2rem;
    border-radius: var(--f8-radius);
  }

  .status strong {
    display: block;
    margin-bottom: 0.9rem;
    color: #fff8ed;
    font-size: 0.82rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .status ul {
    display: grid;
    gap: 0.75rem;
    padding: 0;
    margin: 0;
    color: var(--f8-muted);
    list-style: none;
  }

  .status li {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }

  .status span {
    color: var(--f8-accent);
  }

  .demo {
    display: grid;
    grid-template-columns: minmax(16rem, 24rem) minmax(0, 1fr);
    gap: clamp(1.75rem, 5vw, 4rem);
    align-items: start;
    max-width: 1180px;
    margin: 0 auto;
  }

  .demo__intro {
    position: sticky;
    top: 2rem;
  }

  .demo__intro p:last-child {
    color: var(--f8-muted);
    line-height: 1.7;
  }

  kbd {
    padding: 0.12rem 0.35rem;
    border-radius: 0.35rem;
    color: #fff8ed;
    font: 0.85em
      var(--f8-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  }

  @media (width <= 900px) {
    .hero,
    .demo {
      grid-template-columns: 1fr;
    }

    .demo__intro {
      position: static;
    }
  }
</style>
