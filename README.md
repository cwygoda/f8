# f8

`f8` is an image-first publishing toolkit for SvelteKit. It will turn folders of images and Markdown into fast, responsive, metadata-rich visual stories.

This repository has completed **Milestone 3 — Markdown Renderer** from [`notes/MILESTONES.md`](./notes/MILESTONES.md).

## Current foundation

- Single-package SvelteKit app/library scaffold
- Strict TypeScript and Svelte checking
- pnpm workspace setup
- mise tool configuration
- Taskfile quality gates
- TOML configuration loading with schema validation
- `f8` CLI with `init`, `config`, and `build-images` commands
- Image discovery, sidecar metadata parsing, responsive variant generation, EXIF artifacts, blurhash/dominant color metadata, and cache-aware processing
- Markdown renderer utilities that turn isolated images into captioned figures and consecutive image runs into gallery blocks
- Vitest unit tests
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
pnpm f8 build-images
```

After `pnpm build`, the package binary is emitted at `dist/cli/index.js`.

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
