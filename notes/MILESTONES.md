# f8 Milestone Checklist

This checklist tracks delivery against the project requirements in [`PRD.md`](./PRD.md). Each milestone references the relevant PRD sections and should be considered complete only when its checklist items and quality gates pass.

---

## Milestone 1 — Foundation

**PRD references:** [§6.1 CLI](./PRD.md#61-cli), [§8 Configuration](./PRD.md#8-configuration), [§14 Developer Experience](./PRD.md#14-developer-experience), [§15 Quality Gates](./PRD.md#15-quality-gates)

- [x] Set up repository structure.
- [x] Set up SvelteKit app/library structure.
- [x] Configure strict TypeScript.
- [x] Add pnpm workspace/project setup.
- [x] Add mise configuration.
- [x] Add Taskfile commands.
- [x] Add `f8.config.toml` loading and schema validation foundation.
- [x] Add initial CLI entrypoint.
- [x] Add basic `f8 init` command.
- [x] Add lint command.
- [x] Add test command.
- [x] Add build command.
- [x] Add `task check` quality gate command.
- [x] Add Conventional Commits validation for local hooks and CI.
- [x] Add initial README/docs.

**Exit criteria**

- [x] `pnpm install` works from a clean checkout.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `task check` passes.
- [x] Invalid commit messages are rejected by the commit quality gate.

---

## Milestone 2 — Image Pipeline

**PRD references:** [§6.2 Image Input](./PRD.md#62-image-input), [§6.3 Image Pipeline](./PRD.md#63-image-pipeline), [§6.4 Sidecar Metadata](./PRD.md#64-sidecar-metadata), [§8 Configuration](./PRD.md#8-configuration), [§9 Data Model](./PRD.md#9-data-model)

- [x] Implement image discovery for supported formats.
- [x] Implement recursive directory scanning.
- [x] Implement configurable image sorting.
- [x] Generate responsive variants.
- [x] Preserve original base filename in generated asset names.
- [x] Implement configured widths/formats/quality from `f8.config.toml`.
- [x] Prevent upscaling by default.
- [x] Implement high-quality resizing defaults, including linear resize/MKS interpolation where supported.
- [x] Extract normalized EXIF metadata.
- [x] Generate basic `exif.json` artifacts.
- [x] Generate blurhash placeholders.
- [x] Extract dominant colors.
- [x] Parse sidecar Markdown + YAML frontmatter.
- [x] Apply sidecar metadata override precedence.
- [x] Implement cache key generation from relative path, source hash/mtime, config hash, sidecar hash, and pipeline version.
- [x] Write metadata artifacts matching `F8ImageMetadata`.
- [x] Add `f8 build-images` command.

**Exit criteria**

- [x] Fixture image directory produces expected responsive variants.
- [x] Fixture image directory produces expected metadata artifacts.
- [x] Re-running unchanged pipeline uses cache.
- [x] Changing config invalidates affected cache entries.
- [x] Changing sidecar metadata invalidates affected cache entries.
- [x] Unit tests cover discovery, cache keys, sidecars, variant naming, and metadata normalization.

---

## Milestone 3 — Markdown Renderer

**PRD references:** [§6.5 Markdown Rendering](./PRD.md#65-markdown-rendering), [§6.8 Embeddable Library](./PRD.md#68-embeddable-library), [§9 Data Model](./PRD.md#9-data-model), [§10 Accessibility Requirements](./PRD.md#10-accessibility-requirements)

- [ ] Implement Markdown page rendering pipeline.
- [ ] Detect Markdown image nodes.
- [ ] Resolve image nodes to processed `F8ImageMetadata`.
- [ ] Render isolated images as semantic `figure`/`figcaption` blocks.
- [ ] Render image title/caption metadata for single images.
- [ ] Detect consecutive images with no empty lines.
- [ ] Group consecutive images into gallery blocks.
- [ ] Preserve natural prose/image ordering.
- [ ] Expose renderer utilities for embedders.
- [ ] Add tests for image grouping rules.
- [ ] Add tests for metadata connection.

**Exit criteria**

- [ ] Single image Markdown renders as a captioned figure.
- [ ] Consecutive image Markdown renders as one gallery block.
- [ ] Prose before/between/after images is preserved.
- [ ] Renderer output is accessible and semantic.
- [ ] Unit tests cover single-image and grouped-image cases.

---

## Milestone 4 — UI Components

**PRD references:** [§6.7 Image Viewer](./PRD.md#67-image-viewer), [§6.8 Embeddable Library](./PRD.md#68-embeddable-library), [§7 Design Specification](./PRD.md#7-design-specification), [§10 Accessibility Requirements](./PRD.md#10-accessibility-requirements)

- [ ] Build `F8Image` component.
- [ ] Build `F8Gallery` component.
- [ ] Build `F8Viewer` component.
- [ ] Support responsive `srcset`/`sizes` rendering.
- [ ] Support blurhash or dominant-color placeholders.
- [ ] Support masonry gallery layout.
- [ ] Support image captions.
- [ ] Support viewer open/close interactions.
- [ ] Support viewer previous/next navigation.
- [ ] Support keyboard controls.
- [ ] Support swipe navigation on touch devices.
- [ ] Implement info overlay toggle.
- [ ] Display title and description in overlay.
- [ ] Display EXIF metadata with polished icons.
- [ ] Lazy-load MapLibre map preview when location exists and maps are enabled.
- [ ] Implement CSS variable theming.
- [ ] Implement dark/light theme support.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Export Svelte components for external SvelteKit projects.

**Exit criteria**

- [ ] Components are SSR-compatible.
- [ ] Components are keyboard-accessible.
- [ ] Viewer traps and restores focus correctly.
- [ ] Map code is not loaded before overlay/map use.
- [ ] Components can be imported from package exports.
- [ ] Browser tests cover gallery rendering, viewer navigation, and overlay behavior.

---

## Milestone 5 — Static Site Experience

**PRD references:** [§6.6 SvelteKit Static Site](./PRD.md#66-sveltekit-static-site), [§7 Design Specification](./PRD.md#7-design-specification), [§11 Performance Requirements](./PRD.md#11-performance-requirements), [§12 SEO and Metadata](./PRD.md#12-seo-and-metadata), [§21 Example End-to-End Workflow](./PRD.md#21-example-end-to-end-workflow)

- [ ] Build first-party starter site.
- [ ] Implement home/index page route.
- [ ] Implement Markdown slug routes.
- [ ] Wire generated image assets into static output.
- [ ] Support SvelteKit static adapter.
- [ ] Add page frontmatter title/description support.
- [ ] Add Open Graph metadata support.
- [ ] Add Twitter card metadata support.
- [ ] Add canonical URL support.
- [ ] Implement responsive editorial page layout.
- [ ] Allow image blocks to break wider than prose.
- [ ] Implement polished default design.
- [ ] Implement first-class dark mode.
- [ ] Add `f8 index <image-dir> [output-md]` workflow to starter docs.
- [ ] Verify example end-to-end workflow.

**Exit criteria**

- [ ] A clean starter can be initialized and run.
- [ ] A directory of images can be indexed into Markdown.
- [ ] The static site renders processed images from Markdown.
- [ ] Static build passes.
- [ ] Demo Lighthouse targets are met or documented with known exceptions.
- [ ] Default design looks production-ready without customization.

---

## Milestone 6 — Hardening and Release Readiness

**PRD references:** [§10 Accessibility Requirements](./PRD.md#10-accessibility-requirements), [§11 Performance Requirements](./PRD.md#11-performance-requirements), [§13 Security and Privacy](./PRD.md#13-security-and-privacy), [§15 Quality Gates](./PRD.md#15-quality-gates), [§16 Testing Strategy](./PRD.md#16-testing-strategy), [§18 Acceptance Criteria for v1](./PRD.md#18-acceptance-criteria-for-v1)

- [ ] Add full Playwright test suite.
- [ ] Add automated accessibility checks.
- [ ] Improve keyboard and screen-reader behavior.
- [ ] Tune image loading and lazy-loading behavior.
- [ ] Prevent accidental serving of original full-size images.
- [ ] Add privacy controls for GPS metadata.
- [ ] Add EXIF strip/hide controls.
- [ ] Sanitize Markdown/HTML output.
- [ ] Validate CLI inputs.
- [ ] Validate config files.
- [ ] Ensure indexing never overwrites user prose silently.
- [ ] Add complexity checks.
- [ ] Add release automation from Conventional Commits.
- [ ] Add changelog generation.
- [ ] Finish package export definitions.
- [ ] Finish public documentation.
- [ ] Prepare release packaging.

**Exit criteria**

- [ ] All v1 acceptance criteria in [PRD §18](./PRD.md#18-acceptance-criteria-for-v1) are satisfied.
- [ ] `task check` passes consistently.
- [ ] Browser tests pass across required viewports.
- [ ] Accessibility checks pass or have explicit documented exceptions.
- [ ] Release automation can produce a version bump and changelog from Conventional Commits.
- [ ] Package can be consumed by a separate fixture SvelteKit app.
