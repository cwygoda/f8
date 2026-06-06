# f8 Project Specification

**Status:** Draft 1  
**Product:** `f8` — image-first publishing toolkit for SvelteKit  
**Primary audience:** photographers, designers, artists, visual storytellers, and developers building portfolio/editorial sites  
**Core promise:** turn a folder of images and Markdown into a fast, beautiful, metadata-rich SvelteKit site and reusable image publishing system.

---

## 1. Vision

`f8` is a modern web publishing library for image-heavy stories, portfolios, travel journals, lookbooks, and visual essays.

It combines:

- a **CLI** that indexes images and prepares content,
- an **image processing pipeline** that generates responsive assets and metadata,
- a **Markdown renderer** that understands image sequences,
- a polished **Svelte/SvelteKit UI** for galleries and immersive viewing,
- and embeddable primitives for use inside other Svelte or SvelteKit projects.

The result should feel less like a generic gallery and more like a premium editorial photo experience: fast, tactile, typographically refined, and delightful on mobile and desktop.

---

## 2. Product Goals

### 2.1 User Goals

Users should be able to:

1. Drop images into a directory.
2. Run one command to generate or update a Markdown index (updating image references while keeping other content)
3. Add prose, captions, titles, descriptions, and metadata overrides.
4. Build a static SvelteKit site with responsive, optimized images.
5. Render consecutive image groups as beautiful masonry layouts.
6. Open images in an immersive full-viewport viewer.
7. Reuse the renderer, components, and image pipeline in other SvelteKit apps.

### 2.2 Business / Project Goals

`f8` should become a high-quality open-source toolkit for image publishing with:

- excellent developer experience,
- strong defaults,
- extensible configuration,
- reliable caching,
- modern design quality,
- automated quality gates suitable for LLM-assisted development.

---

## 3. Non-Goals

The first version does **not** aim to provide:

- a hosted CMS,
- multi-user auth,
- online image editing,
- comments/social features,
- DAM-style asset management,
- AI image generation,
- full Lightroom replacement workflows.

`f8` should stay focused: local files, Markdown, image processing, and excellent presentation.

---

## 4. Guiding Principles

1. **Static-first, dynamic-feeling**  
   Output should work beautifully as a static SvelteKit site while feeling fluid and interactive.

2. **Content belongs to the user**  
   Images, Markdown, sidecars, and config are plain files.

3. **Design is a feature**  
   Defaults must look intentional: spacing, typography, motion, color, overlays, and icons should feel premium.

4. **Fast by default**  
   Responsive variants, blurhash placeholders, cache-aware processing, lazy loading, and good HTML output are required.

5. **Composable internals**  
   The CLI, image pipeline, Markdown renderer, and UI components should be usable independently.

6. **LLM-friendly engineering**  
   The project should have explicit quality gates, simple commands, strong tests, and clear architectural boundaries.

---

## 5. Target Users

### 5.1 Photographer / Visual Artist

Wants a beautiful portfolio or photo journal without building custom gallery infrastructure.

Needs:

- beautiful galleries,
- rich EXIF display,
- captions and descriptions,
- responsive performance,
- simple local workflow.

### 5.2 Developer / Designer

Wants image publishing primitives inside a custom SvelteKit project.

Needs:

- reusable image processing API,
- Svelte components,
- Markdown rendering utilities,
- themeable UI,
- predictable cache behavior.

### 5.3 Travel / Editorial Blogger

Wants prose and image sequences interleaved naturally.

Needs:

- Markdown-first writing,
- image blocks and galleries,
- map previews for geotagged images,
- strong mobile reading experience.

---

## 6. Core Product Scope

## 6.1 CLI

The CLI provides local content and asset workflow commands.

### Required Commands

#### `f8 init`

Creates starter project files.

Outputs may include:

```txt
f8.config.toml
content/
  index.md
images/
.cache/f8/
```

#### `f8 index <image-dir> [output-md]`

Scans a directory of images and creates or updates a Markdown index listing all images.

Example:

```bash
f8 index ./images ./content/index.md
```

Expected behavior:

- recursively discovers supported image files,
- sorts by configurable strategy,
- preserves existing prose where possible,
- emits image Markdown entries,
- supports dry run,
- supports watch mode.

#### `f8 build-images`

Runs the image pipeline for all referenced images.

Expected behavior:

- generates responsive variants,
- extracts EXIF JSON,
- computes blurhash,
- extracts dominant colors,
- applies sidecar metadata overrides,
- writes cache artifacts.

#### `f8 dev`

Optional convenience command that wraps the SvelteKit dev server and watches images/content.

#### `f8 doctor`

Checks local tooling and configuration.

Validates:

- Node version,
- package manager,
- native image dependencies,
- SvelteKit setup,
- config validity,
- cache directory writability.

---

## 6.2 Image Input

Supported source formats for v1:

- JPEG / JPG,
- PNG,
- WebP,
- AVIF,
- TIFF if feasible through the selected processing backend.

HEIC/HEIF support is desirable but optional depending on platform support.

---

## 6.3 Image Pipeline

For every source image, `f8` generates a structured set of outputs.

### Responsive Variants

Default widths:

```ts
[480, 768, 1024, 1440, 1920, 2560]
```

Defaults:

- high-quality resize,
- linear-space processing by default,
- MKS interpolation where supported,
- output formats: AVIF, WebP, and JPEG fallback,
- configurable quality per format,
- no upscaling unless explicitly enabled.

### Metadata Artifacts

For each image, generate:

- `exif.json` with normalized camera/lens/settings data,
- `blurhash` string,
- dominant color palette,
- dimensions and aspect ratio,
- GPS coordinates when present,
- creation date when available,
- sidecar-applied title/description/overrides.

### Cache Behavior

Cache keys must be based on:

- relative image path,
- source file content hash or mtime+size strategy,
- pipeline config hash,
- sidecar metadata hash,
- package/pipeline version.

Generated file names must preserve the original base filename for readability and SEO.

Example output:

```txt
.f8/cache/
  photos/paris/eiffel/
    eiffel-1024.avif
    eiffel-1024.webp
    eiffel-1024.jpg
    eiffel.metadata.json
```

---

## 6.4 Sidecar Metadata

Images may have sidecar Markdown files with YAML frontmatter.

Example:

```md
---
title: Morning fog over the ridge
description: A quiet sunrise after the storm cleared.
date: 2026-01-14
camera: Leica Q3
lens: Summilux 28mm
location:
  label: Dolomites, Italy
  lat: 46.4102
  lng: 11.8440
exif:
  aperture: f/5.6
  shutter: 1/250
  iso: 100
---

Optional longer story or caption text.
```

Sidecar priority:

1. sidecar frontmatter overrides,
2. source EXIF,
3. generated defaults.

---

## 6.5 Markdown Rendering

`f8` renders Markdown pages with special handling for image nodes.

### Single Image

A single image separated by blank lines renders as a figure with caption/title.

```md
![Alt text](./images/photo.jpg)
```

Rendered as:

- responsive image,
- blurhash placeholder,
- title/caption if available,
- click target for viewer.

### Consecutive Image Group

Images with no empty line between them are treated as one block.

```md
![](./images/a.jpg)
![](./images/b.jpg)
![](./images/c.jpg)
```

Rendered as:

- one masonry gallery block,
- responsive columns,
- consistent gutters,
- keyboard-accessible items,
- unified viewer navigation order.

### Prose + Image Flow

Markdown should support natural editorial composition:

```md
# Kyoto in Rain

The first storm arrived just before dawn.

![](./images/street.jpg)
![](./images/lantern.jpg)

By evening, the streets turned gold.

![](./images/night.jpg)
```

---

## 6.6 SvelteKit Static Site

The included SvelteKit site should:

- render Markdown pages,
- prebuild static routes,
- serve optimized image assets,
- provide excellent SEO metadata,
- support Open Graph images,
- support dark/light themes,
- work with SvelteKit static adapter.

Required routes:

```txt
/                 Home or index page
/[...slug]         Markdown-rendered pages
/assets/f8/*       Generated image assets, depending on deployment strategy
```

---

## 6.7 Image Viewer

Clicking an image opens a full-viewport viewer.

### Viewer Requirements

- full-screen immersive presentation,
- next/previous navigation within the current page,
- keyboard controls,
- swipe gestures on touch devices,
- pinch/zoom desirable after v1,
- close via Escape, click backdrop, or close button,
- browser history integration desirable,
- focus trapping and restoration,
- reduced-motion support.

### Info Overlay

The viewer includes an info button that toggles a semi-transparent overlay.

Overlay content:

- title,
- description,
- camera body,
- lens,
- aperture,
- shutter speed,
- ISO,
- focal length,
- capture date,
- location label,
- map preview when coordinates exist.

The EXIF presentation should use elegant iconography and careful spacing.

### Map Preview

Use MapLibre for location previews.

Requirements:

- minimal, tasteful style,
- marker at image location,
- lazy-load map only when overlay opens,
- avoid blocking initial page load,
- allow maps to be disabled for privacy.

---

## 6.8 Embeddable Library

`f8` should expose reusable modules.

### Package Exports

Potential exports:

```ts
import { processImage, processImageDirectory } from 'f8/pipeline';
import { renderMarkdown } from 'f8/markdown';
import { F8Image, F8Gallery, F8Viewer, F8Page } from 'f8/svelte';
import type { F8Config, F8ImageMetadata } from 'f8/types';
```

### Component Requirements

Components must be:

- themeable with CSS variables,
- accessible by default,
- SSR-compatible,
- tree-shakeable where possible,
- usable in existing SvelteKit apps.

---

## 7. Design Specification

## 7.1 Design Direction

The default visual style should feel like a premium editorial photography publication:

- spacious layouts,
- refined typography,
- calm motion,
- strong image presence,
- minimal chrome,
- subtle depth,
- beautiful dark mode,
- no generic dashboard aesthetic.

Keywords:

- cinematic,
- tactile,
- quiet luxury,
- magazine-like,
- fast,
- immersive.

## 7.2 Layout

### Page Layout

- Max prose width: `680–760px`.
- Image blocks may break out wider than prose.
- Full-bleed option for hero images.
- Generous vertical rhythm.
- Responsive gutters based on viewport size.

### Masonry Layout

Desktop:

- 2–4 columns depending on available width,
- balanced visual rhythm,
- gap: `12–24px`, configurable.

Mobile:

- 1–2 columns,
- preserve tap target size,
- avoid layout shift.

## 7.3 Typography

Default stack:

```css
--f8-font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
--f8-font-serif: ui-serif, Georgia, Cambria, serif;
--f8-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
```

Typography goals:

- elegant headings,
- comfortable reading line length,
- subtle captions,
- compact but legible metadata.

## 7.4 Color System

Use CSS variables.

Required tokens:

```css
--f8-bg;
--f8-fg;
--f8-muted;
--f8-border;
--f8-accent;
--f8-overlay-bg;
--f8-shadow;
--f8-radius;
--f8-gap;
```

Dark mode should be first-class, not an afterthought.

## 7.5 Motion

Motion should communicate continuity and polish.

Examples:

- image hover lift or gentle brightness shift,
- viewer open crossfade/scale,
- overlay slide/fade,
- navigation transitions.

Requirements:

- respect `prefers-reduced-motion`,
- avoid long or distracting animations,
- maintain 60fps where possible.

---

## 8. Configuration

Configuration sources, in order of precedence:

1. CLI flags,
2. environment variables,
3. `f8.config.toml`,
4. defaults.

`f8.config.toml` is the canonical project configuration format. It should be simple to read, easy to edit without TypeScript knowledge, and validated against the same internal schema used by the CLI and library APIs.

Example:

```toml
contentDir = "content"
imageDir = "images"
outputDir = ".f8"
cacheDir = ".f8/cache"

[image]
widths = [480, 768, 1024, 1440, 1920, 2560]
formats = ["avif", "webp", "jpeg"]
allowUpscale = false
linearResize = true
interpolation = "mks"

[image.quality]
avif = 72
webp = 82
jpeg = 88

[gallery]
layout = "masonry"
gap = "clamp(0.75rem, 2vw, 1.5rem)"
maxColumns = 4

[viewer]
enableMap = true
enableExifOverlay = true
```

For embedders that need programmatic configuration, `f8` may additionally expose TypeScript helpers, but file-based project configuration should default to TOML.

Environment variable examples:

```txt
F8_IMAGE_DIR=images
F8_CACHE_DIR=.f8/cache
F8_ENABLE_MAP=false
```

---

## 9. Data Model

### `F8ImageMetadata`

```ts
export interface F8ImageMetadata {
  id: string;
  sourcePath: string;
  relativePath: string;
  alt?: string;
  title?: string;
  description?: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurhash?: string;
  dominantColors: string[];
  variants: F8ImageVariant[];
  exif?: F8Exif;
  location?: F8Location;
  sidecar?: {
    path: string;
    content?: string;
  };
}
```

### `F8ImageVariant`

```ts
export interface F8ImageVariant {
  width: number;
  height: number;
  format: 'avif' | 'webp' | 'jpeg' | 'png';
  src: string;
  sizeBytes: number;
}
```

### `F8Exif`

```ts
export interface F8Exif {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
  capturedAt?: string;
}
```

### `F8Location`

```ts
export interface F8Location {
  label?: string;
  lat?: number;
  lng?: number;
}
```

---

## 10. Accessibility Requirements

`f8` must be accessible by default.

Requirements:

- valid semantic HTML,
- `figure` / `figcaption` for captioned images,
- meaningful `alt` text support,
- keyboard navigation in galleries and viewer,
- focus trap in viewer,
- restored focus on close,
- ARIA labels for icon buttons,
- no keyboard traps,
- sufficient contrast,
- reduced-motion support,
- captions and metadata readable by screen readers.

---

## 11. Performance Requirements

Target outcomes:

- no large original images served accidentally,
- responsive `srcset`/`sizes`,
- lazy loading for below-the-fold images,
- eager loading for likely LCP hero image,
- blurhash or dominant-color placeholders,
- minimal JS for initial render,
- lazy-load viewer/map code where possible,
- avoid cumulative layout shift by reserving aspect-ratio boxes.

Suggested targets for demo site:

- Lighthouse Performance: 90+
- Lighthouse Accessibility: 95+
- Lighthouse Best Practices: 95+
- Lighthouse SEO: 95+

---

## 12. SEO and Metadata

Generated pages should support:

- title and description frontmatter,
- Open Graph tags,
- Twitter card metadata,
- image alt text,
- canonical URLs,
- structured data where useful,
- readable asset filenames.

---

## 13. Security and Privacy

Requirements:

- avoid leaking GPS data unless enabled,
- provide config to strip or hide sensitive EXIF fields,
- sanitize Markdown/HTML output,
- avoid arbitrary code execution from content files,
- validate config files and CLI inputs,
- never overwrite user prose silently during indexing.

Privacy defaults should be conservative around location metadata.

---

## 14. Developer Experience

Tooling stack:

- SvelteKit,
- TypeScript,
- pnpm,
- mise,
- Taskfile,
- Vite,
- Vitest,
- Playwright,
- ESLint,
- Prettier,
- Commitlint or equivalent Conventional Commits validation,
- automated release tooling driven by Conventional Commits,
- package exports suitable for library use.

Expected commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
task check
task quality
```

Project should be easy for humans and coding agents to modify safely.

---

## 15. Quality Gates

Quality gates act as backpressure for LLM-assisted development.

Required gates:

1. **Formatting** — Prettier or equivalent.
2. **Linting** — ESLint/Svelte checks.
3. **Type checking** — strict TypeScript.
4. **Unit tests** — pipeline, config, Markdown grouping, cache keys.
5. **Browser tests** — gallery rendering, viewer navigation, overlay behavior.
6. **Accessibility checks** — basic automated a11y validation.
7. **Complexity checks** — prevent overly complex modules/functions.
8. **Conventional Commits** — commit messages must follow the Conventional Commits spec so changelogs and semantic releases can be automated.
9. **Build verification** — static SvelteKit build must pass.

Suggested single command:

```bash
task check
```

Commit message validation should run locally via Git hooks and in CI. Release automation should infer version bumps and changelog entries from commit types such as `feat:`, `fix:`, `perf:`, and breaking-change markers.

---

## 16. Testing Strategy

### Unit Tests

Cover:

- config resolution and precedence,
- image discovery,
- Markdown image grouping,
- sidecar parsing,
- cache key generation,
- metadata normalization,
- variant naming,
- privacy stripping.

### Integration Tests

Cover:

- CLI indexing a fixture image directory,
- pipeline output generation,
- Markdown page render to SvelteKit route,
- embedding components in a fixture app.

### Browser Tests

Cover:

- masonry layout appears correctly,
- image click opens viewer,
- Escape closes viewer,
- next/previous navigation works,
- info overlay toggles,
- map preview loads only when needed,
- mobile viewport behavior.

---

## 17. Milestones

The implementation milestones are tracked as an actionable checklist in [`MILESTONES.md`](./MILESTONES.md). The checklist expands each milestone into deliverables, exit criteria, and links back to the relevant PRD sections.

Summary:

1. **Foundation** — repository, SvelteKit/library structure, tooling, config, and quality gates.
2. **Image Pipeline** — discovery, variants, metadata, blurhash, colors, caching, and sidecars.
3. **Markdown Renderer** — Markdown rendering, image detection, image grouping, figures, and metadata connection.
4. **UI Components** — `F8Image`, `F8Gallery`, `F8Viewer`, captions, EXIF overlay, maps, and theming.
5. **Static Site Experience** — starter site, routes, SEO, responsive layouts, dark/light themes, and polished design.
6. **Hardening and Release Readiness** — tests, accessibility, performance, privacy, documentation, Conventional Commits release automation, and packaging.

---

## 18. Acceptance Criteria for v1

`f8` v1 is ready when:

- a user can initialize a project and build a static image site,
- a directory of images can be indexed into Markdown,
- referenced images are processed into responsive variants,
- metadata artifacts are generated and cached,
- sidecar metadata overrides work,
- single images render as captioned figures,
- consecutive images render as masonry galleries,
- clicking an image opens a full-viewport viewer,
- viewer previous/next navigation works,
- info overlay displays title, description, EXIF, and optional map,
- components can be imported into another SvelteKit project,
- quality gates pass consistently,
- default design looks production-ready without customization.

---

## 19. Open Questions

1. Which image processing backend should be used initially: Sharp, Squoosh, native codecs, or another option?
2. Should the package be a single package or a monorepo with `cli`, `core`, `svelte`, and `create-f8` packages?
3. How should generated assets be referenced in static deployments with custom base paths?
4. Should GPS metadata be hidden by default even when present?
5. What is the desired first-party starter theme: minimal portfolio, editorial journal, or both?
6. Should Markdown support custom directives for explicit gallery options?

---

## 20. Future Enhancements

- explicit gallery directives,
- contact sheets,
- album pages,
- search/filter by EXIF fields,
- tags and collections,
- animated route transitions,
- pinch-to-zoom viewer,
- offline/PWA support,
- RSS/Atom feeds,
- visual diffing for generated designs,
- optional AI-assisted caption drafting,
- optional deployment adapters.

---

## 21. Example End-to-End Workflow

```bash
pnpm create f8 my-photo-site
cd my-photo-site
cp ~/Pictures/trip/*.jpg images/trip/
f8 index images/trip content/kyoto.md
pnpm dev
```

Then edit Markdown:

```md
---
title: Kyoto in Rain
description: A quiet walk through wet streets and lantern light.
---

# Kyoto in Rain

The first storm arrived before dawn.

![](../images/trip/street.jpg)
![](../images/trip/lantern.jpg)
![](../images/trip/market.jpg)

By evening, the city felt made of reflections.
```

Build:

```bash
pnpm build
```

Output: a fast, static, beautifully designed photo essay with responsive images, metadata, masonry galleries, and an immersive viewer.
