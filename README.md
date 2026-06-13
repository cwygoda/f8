# f8

`f8` is an image-first publishing toolkit for SvelteKit. It will turn folders of images and Markdown into fast, responsive, metadata-rich visual stories.

This repository has completed **Milestone 5 — Static Site Experience** from [`notes/MILESTONES.md`](./notes/MILESTONES.md).

## Current foundation

- Single-package SvelteKit app/library scaffold
- Strict TypeScript and Svelte checking
- pnpm workspace setup
- mise tool configuration
- Taskfile quality gates
- TOML configuration loading with schema validation
- `f8` CLI with `init`, `config`, `index`, and `build-images` commands
- Image discovery, sidecar metadata parsing, responsive variant generation, EXIF artifacts, blurhash/dominant color metadata, and cache-aware processing
- Markdown renderer utilities that turn isolated images into captioned figures and consecutive image runs into gallery blocks
- First-party static SvelteKit starter routes for `content/index.md` and nested Markdown slugs
- SEO frontmatter, canonical URLs, Open Graph, Twitter cards, and `/assets/f8/` static asset wiring
- SSR-compatible Svelte components: `F8Image`, `F8Gallery`, and `F8Viewer`
- Vitest unit and browser-style component tests
- ESLint, Prettier, Commitlint, Husky, and CI workflow

## Requirements

- Node.js 24+
- pnpm 11+
- Optional: [`mise`](https://mise.jdx.dev/) and [`task`](https://taskfile.dev/)

With mise:

```bash
mise install
```

## Setup

```bash
pnpm install
```

## Development commands

```bash
pnpm dev      # start SvelteKit dev server
pnpm lint     # ESLint + Prettier checks
pnpm test     # Vitest unit tests
pnpm build    # SvelteKit build + package artifacts + CLI build
pnpm check    # Svelte/TypeScript check
```

Task aliases:

```bash
pnpm exec task check
pnpm exec task quality
```

If `mise` has activated the local toolchain, the shorthand `task check` and `task quality` are also available.

## CLI

Run the source CLI during development:

```bash
pnpm f8 --help
pnpm f8 init
pnpm f8 config
pnpm f8 index images content/index.md
pnpm f8 build-images
```

After `pnpm build`, the package binary is emitted at `dist/cli/index.js`.

`f8 index <image-dir> [output-md]` recursively discovers supported images, sorts them using config, and inserts or refreshes a protected `<!-- f8:index:start -->` block while preserving the prose around it. Use `--dry-run` to preview the generated Markdown.

## Configuration

`f8.config.toml` is the canonical project configuration file. Configuration precedence is:

1. CLI/programmatic overrides
2. Environment variables
3. `f8.config.toml`
4. Defaults

Image pipeline configuration supports widths, formats, sorting, quality, no-upscale behavior, linear resize, and interpolation settings.

Supported environment variables in the current foundation:

- `F8_CONTENT_DIR`
- `F8_IMAGE_DIR`
- `F8_OUTPUT_DIR`
- `F8_CACHE_DIR`
- `F8_SITE_TITLE`
- `F8_SITE_URL`
- `F8_ENABLE_MAP`
- `F8_ENABLE_EXIF_OVERLAY`

## Markdown rendering

```ts
import { renderMarkdown } from 'f8/markdown';

const rendered = renderMarkdown(markdown, {
  images: processedImages.map((result) => result.metadata)
});

console.log(rendered.html);
```

The renderer is powered by `remark`/`rehype`. It resolves Markdown image nodes to processed `F8ImageMetadata`, emits semantic captioned figures for isolated images, groups consecutive image lines into gallery blocks, and preserves prose order around image blocks.

## Svelte components

```svelte
<script lang="ts">
  import { F8Gallery } from 'f8/svelte';

  export let images;
</script>

<F8Gallery {images} />
```

Components render responsive `picture` markup from `F8ImageMetadata`, use dominant-color placeholders, support CSS-variable theming, and include an accessible fullscreen viewer with keyboard, swipe, EXIF overlay, and lazy MapLibre preview support.

## Static starter workflow

The first-party starter site reads Markdown from `content/`, pre-renders with `@sveltejs/adapter-static`, and maps generated image variants into `static/assets/f8/` during page loading so the final build serves optimized assets.

```bash
pnpm f8 init
cp ~/Pictures/trip/*.jpg images/trip/
pnpm f8 index images content/index.md
pnpm f8 build-images
pnpm dev
pnpm build
```

Frontmatter fields such as `title`, `description`, `canonical`, `image`, `ogImage`, `twitterImage`, and `theme` drive page metadata and presentation. `content/index.md` renders at `/`; nested files such as `content/travel/kyoto.md` render at `/travel/kyoto`.

Lighthouse targets from the PRD are not automated in this milestone; the documented exception is that verification is currently limited to static build output and existing unit/browser-style tests. Full automated Lighthouse/a11y reporting remains part of hardening.

## SvelteKit `+page.md` routes

Run the image pipeline first so `.f8/cache/manifest.json` exists:

```bash
pnpm f8 build-images
```

Then wire f8 into `svelte.config.js` with mdsvex:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { f8SvelteKit } from 'f8/sveltekit';

const f8 = f8SvelteKit();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: f8.extensions,
  preprocess: [vitePreprocess(), f8.preprocess],
  kit: {
    adapter: adapter()
  }
};

export default config;
```

After that, SvelteKit can route Markdown pages such as `src/routes/+page.md` and `src/routes/travel/+page.md`, with f8 image figures/galleries applied during mdsvex compilation.

## Commit messages

Commit messages are validated with Conventional Commits locally through Husky and in CI with Commitlint.

Examples:

```txt
feat: add image discovery
fix: preserve captions during indexing
chore: update dependencies
```
