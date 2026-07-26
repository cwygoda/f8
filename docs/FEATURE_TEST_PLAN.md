# f8 supported feature test plan

This plan captures the supported product features visible in the current README/source and maps each to an executable acceptance test. Scenarios are written in Gherkin style; UI scenarios are implemented with Playwright, CLI scenarios with Vitest.

## CLI features

### Feature: CLI help and command discovery

```gherkin
Scenario: User asks for help
  Given a terminal in an f8 workspace
  When the user runs f8 --help
  Then the CLI prints usage, supported commands, and starter-project guidance
```

Implemented by `tests/cli.test.ts`.

### Feature: Starter project scaffolding

```gherkin
Scenario: User initializes a new site
  Given an empty directory
  When the user runs f8 init
  Then f8 writes a buildable SvelteKit starter, f8 config, content index, and route files
```

Implemented by `tests/cli.test.ts`.

### Feature: Named project initialization

```gherkin
Scenario: User initializes a named project directory
  Given a parent directory
  When the user runs f8 init my-site
  Then f8 creates my-site with a normalized package name and starter config
```

Implemented by `tests/cli.test.ts`.

### Feature: Import existing content during init

```gherkin
Scenario: User initializes over a folder of images and Markdown
  Given a folder containing photos and notes
  When the user runs f8 init photos
  Then f8 moves existing content into content/ and appends missing Markdown image references
```

Implemented by `tests/cli.test.ts`.

### Feature: Safe overwrite behavior

```gherkin
Scenario: User re-runs init without force
  Given an existing f8 starter project
  When the user runs f8 init again
  Then f8 skips existing starter files instead of overwriting them
```

Implemented by `tests/cli.test.ts`.

### Feature: Forced overwrite behavior

```gherkin
Scenario: User opts into overwriting starter files
  Given an existing starter file with local edits
  When the user runs f8 init --force
  Then f8 restores the starter file contents and reports the file as written
```

Implemented by `tests/cli.test.ts`.

### Feature: Configuration inspection

```gherkin
Scenario: User validates project configuration
  Given a project with .f8.toml
  When the user runs f8 config
  Then f8 prints the resolved configuration and source path as JSON
```

Implemented by `tests/cli.test.ts`.

### Feature: CLI error handling

```gherkin
Scenario: User runs an unknown command or invalid config
  Given a terminal in an f8 workspace
  When the command cannot be resolved or config cannot be parsed
  Then f8 exits non-zero and prints an actionable error
```

Implemented by `tests/cli.test.ts`.

## Library, pipeline, and integration features

### Feature: Configuration loading and precedence

```gherkin
Scenario: App resolves project configuration
  Given defaults, .f8.toml, environment variables, and optional overrides
  When f8 loads configuration
  Then higher-precedence values win and invalid unknown keys fail clearly
```

Implemented by `tests/config.test.ts`.

### Feature: Image pipeline processing

```gherkin
Scenario: App processes a local image
  Given a supported image and f8 image settings
  When f8 processes the image
  Then responsive variants, EXIF artifacts, blurhash, dominant colors, and metadata are written without unsafe upscaling
```

Implemented by `tests/pipeline.test.ts`.

### Feature: Cache-aware image builds

```gherkin
Scenario: Source, sidecar, or config changes
  Given a previously processed image
  When source data is unchanged or changed
  Then f8 reuses valid cache entries and invalidates stale ones
```

Implemented by `tests/pipeline.test.ts`.

### Feature: Sidecar metadata and privacy controls

```gherkin
Scenario: User supplies sidecar metadata and privacy settings
  Given image sidecar frontmatter includes title, EXIF, and GPS location
  When f8 processes the image
  Then public metadata reflects sidecar overrides and omits GPS unless configured
```

Implemented by `tests/pipeline.test.ts`.

### Feature: Markdown image rendering

```gherkin
Scenario: Renderer receives prose and image references
  Given Markdown containing isolated images, consecutive image groups, unsafe URLs, and code blocks
  When f8 renders Markdown
  Then figures, galleries, sanitized links, blocked unprocessed images, and prose order are correct
```

Implemented by `tests/markdown.test.ts`.

### Feature: SvelteKit content loading and asset wiring

```gherkin
Scenario: SvelteKit loads Markdown content
  Given content/index.md or nested Markdown with colocated images
  When f8 loads the page
  Then SEO metadata, /@f8/ URLs, page entries, and cached asset manifests are produced
```

Implemented by `tests/sveltekit.test.ts`.

### Feature: Mdsvex +page.md integration

```gherkin
Scenario: SvelteKit preprocesses Markdown routes
  Given f8 image metadata and a +page.md file
  When the mdsvex preprocessor runs
  Then Markdown image groups become f8 gallery markup in SvelteKit routes
```

Implemented by `tests/sveltekit.test.ts`.

### Feature: SSR-compatible Svelte components

```gherkin
Scenario: App renders f8 components on the server
  Given F8Image, F8Gallery, and F8Viewer props
  When Svelte renders them in SSR
  Then markup is produced without browser-only crashes
```

Implemented by `tests/components.ssr.test.ts`.

### Feature: Accessible interactive components

```gherkin
Scenario: User interacts with gallery and viewer components
  Given rendered gallery and viewer components
  When the user opens images, navigates with keyboard, toggles info, or tabs through controls
  Then viewer state, focus management, EXIF overlay, and map placeholder behavior are correct
```

Implemented by `tests/components.browser.test.ts`, `tests/accessibility.browser.test.ts`, and `tests/viewer-map.browser.test.ts`.

## UI features

### Feature: Static starter editorial shell

```gherkin
Scenario: Reader opens the homepage
  Given the starter site has been built
  When the reader visits /
  Then they see the accessible editorial shell, page heading, and SEO description
```

Implemented by `tests/e2e/site.spec.ts`.

### Feature: Protected processed image URLs

```gherkin
Scenario: Reader views rendered pages
  Given Markdown references colocated images
  When the page is rendered
  Then original image-directory URLs are not exposed in rendered image links
```

Implemented by `tests/e2e/site.spec.ts`.

### Feature: Responsive Markdown galleries

```gherkin
Scenario: Reader opens the demo story
  Given Markdown contains consecutive image lines
  When the reader visits /demo
  Then f8 renders them as accessible gallery blocks with optimized /@f8/ assets
```

Implemented by `tests/e2e/site.spec.ts`.

### Feature: Immersive image viewer

```gherkin
Scenario: Reader opens a gallery image
  Given a rendered image gallery
  When the reader activates an image
  Then an accessible fullscreen viewer opens with image information controls
```

Implemented by `tests/e2e/site.spec.ts`.

### Feature: SEO frontmatter rendering

```gherkin
Scenario: Crawler reads page metadata
  Given Markdown frontmatter defines title and description
  When the page is rendered
  Then title, description, Open Graph, and Twitter metadata match the page
```

Implemented by `tests/e2e/site.spec.ts`.

### Feature: Visual regression protection

```gherkin
Scenario: Automated dependency update changes UI dependencies
  Given approved desktop and mobile screenshots exist
  When Playwright runs visual assertions
  Then page and viewer screenshots must match their baselines within tolerance
```

Implemented by `tests/e2e/site.spec.ts` snapshots.
