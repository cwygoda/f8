# f8

`f8` is an image-first publishing toolkit for SvelteKit. It will turn folders of images and Markdown into fast, responsive, metadata-rich visual stories.

This repository has completed **Milestone 6 — Hardening and Release Readiness** from [`notes/MILESTONES.md`](./notes/MILESTONES.md).

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
- SEO frontmatter, canonical URLs, Open Graph, Twitter cards, and `/@f8/` Vite-served image asset wiring
- SSR-compatible Svelte components: `F8Image`, `F8Gallery`, and `F8Viewer`
- Vitest unit/browser-style component tests plus Playwright viewport coverage
- Automated accessibility smoke checks for rendered components
- Privacy controls for GPS/EXIF metadata and output metadata stripping
- Markdown URL sanitization and unprocessed-image safeguards
- Release preparation scripts for Conventional Commit changelogs and version bumps
- ESLint, complexity checks, Prettier, Commitlint, Husky, and CI workflow

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
pnpm test     # Vitest unit, browser, and accessibility tests
pnpm test:e2e # Playwright tests across configured viewports
pnpm build    # SvelteKit build + package artifacts + CLI build
pnpm check    # Svelte/TypeScript check
pnpm release:dry-run # preview Conventional Commit version/changelog output
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

`f8 index <image-dir> [output-md]` recursively discovers supported images, sorts them using config, validates paths, and inserts or refreshes a protected `<!-- f8:index:start -->` block while preserving the prose around it. Existing Markdown is backed up to `<output>.bak` before a changed generated block is written; use `--dry-run` to preview or `--no-backup` to opt out.

## Configuration

`f8.config.toml` is the canonical project configuration file. Configuration precedence is:

1. CLI/programmatic overrides
2. Environment variables
3. `f8.config.toml`
4. Defaults

Image pipeline configuration supports widths, formats, sorting, quality, no-upscale behavior, linear resize, and interpolation settings. Privacy defaults avoid publishing GPS metadata (`privacy.includeGpsMetadata = false`) and strip metadata from generated variants (`privacy.stripOutputMetadata = true`). Set `privacy.includeExifMetadata = false` to hide camera settings from generated metadata and overlays.

Supported environment variables in the current foundation:

- `F8_CONTENT_DIR`
- `F8_IMAGE_DIR`
- `F8_OUTPUT_DIR`
- `F8_CACHE_DIR`
- `F8_SITE_TITLE`
- `F8_SITE_URL`
- `F8_ENABLE_MAP`
- `F8_ENABLE_EXIF_OVERLAY`
- `F8_INCLUDE_GPS_METADATA`
- `F8_INCLUDE_EXIF_METADATA`
- `F8_STRIP_OUTPUT_METADATA`
- `F8_ALLOW_UNPROCESSED_IMAGES`

## Markdown rendering

```ts
import { renderMarkdown } from 'f8/markdown';

const rendered = renderMarkdown(markdown, {
  images: processedImages.map((result) => result.metadata)
});

console.log(rendered.html);
```

The renderer is powered by `remark`/`rehype`. It resolves Markdown image nodes to processed `F8ImageMetadata`, emits semantic captioned figures for isolated images, groups consecutive image lines into gallery blocks, sanitizes unsafe URLs by default, and preserves prose order around image blocks. Static rendering blocks unresolved image sources unless `security.allowUnprocessedImages = true` is explicitly configured.

## Svelte components

```svelte
<script lang="ts">
  import { F8Gallery } from 'f8/svelte';

  export let images;
</script>

<F8Gallery {images} />
```

Components render responsive `picture` markup from `F8ImageMetadata`, use dominant-color placeholders, support CSS-variable theming, and include an accessible fullscreen viewer with keyboard, swipe, EXIF overlay, and lazy MapLibre preview support. Public exports include `f8/svelte`, `f8/components/F8Image.svelte`, `f8/components/F8Gallery.svelte`, `f8/components/F8Viewer.svelte`, and `f8/components/image-utils`.

## Static starter workflow

The first-party starter site reads Markdown from `content/`, pre-renders with `@sveltejs/adapter-static`, and serves optimized image variants through the f8 Vite plugin. In dev, `/@f8/` URLs are resolved directly from `.f8/cache`; during production builds, the plugin emits those cached assets into the static output.

```bash
pnpm f8 init
cp ~/Pictures/trip/*.jpg images/trip/
pnpm f8 index images content/index.md
pnpm f8 build-images
pnpm dev
pnpm build
```

Frontmatter fields such as `title`, `description`, `canonical`, `image`, `ogImage`, `twitterImage`, and `theme` drive page metadata and presentation. `content/index.md` renders at `/`; nested files such as `content/travel/kyoto.md` render at `/travel/kyoto`.

Images can also be colocated with Markdown content and referenced with Markdown-relative paths. When a page is loaded during dev or prerender, f8 processes supported local image references on demand, caches the responsive variants, and rewrites image metadata URLs to `/@f8/<cache-key>/<cache-path>`:

```txt
content/travel/kyoto.md
content/travel/rain.png
```

```md
![Rain over Kyoto](./rain.png)
```

Wire the Vite plugin into `vite.config.ts` so those `/@f8/` URLs resolve in dev and are emitted for static production builds. The plugin also supports explicit image metadata imports with `?f8` for component-level usage; importing an image this way processes it into `.f8/cache` if needed and returns f8 metadata with `/@f8/` variant URLs.

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { f8Vite } from 'f8/sveltekit';

export default defineConfig({
  plugins: [f8Vite(), sveltekit()]
});
```

```ts
import hero from './hero.jpg?f8';

console.log(hero.variants[0]?.src); // /@f8/<cache-key>/hero/hero-480.avif
```

Hardening checks include Vitest accessibility smoke tests, Playwright desktop/mobile viewport coverage (`pnpm test:e2e` after installing browsers with `pnpm test:e2e:install`), and a static build/package quality gate.

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
