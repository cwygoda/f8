#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { F8ConfigError, loadConfig } from '../lib/config/index.js';

const HELP_TEXT = `f8 — image-first publishing toolkit for SvelteKit

Usage:
  f8 [command] [options]

Commands:
  init [dir]    Create a complete buildable f8 SvelteKit project
  config        Validate and print the resolved configuration
  help          Show this help message

Options:
  -h, --help    Show this help message
  --force       Overwrite files when used with init
`;

export interface CliIO {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export interface CliOptions extends CliIO {
  cwd?: string;
}

interface InitResult {
  projectRoot: string;
  projectPath: string;
  created: string[];
  moved: string[];
  updated: string[];
  skipped: string[];
}

export async function main(
  argv = process.argv.slice(2),
  options: CliOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const [command, ...args] = argv;

  try {
    if (
      command === undefined ||
      command === 'help' ||
      command === '--help' ||
      command === '-h'
    ) {
      stdout(HELP_TEXT);
      return 0;
    }

    if (command === 'init') {
      const projectDir = getInitProjectDirArg(args);
      const result = initProject({
        cwd,
        force: args.includes('--force'),
        ...(projectDir === undefined ? {} : { projectDir })
      });
      stdout(formatInitResult(result));
      return 0;
    }

    if (command === 'config') {
      const { config, path } = loadConfig({ cwd });
      stdout(JSON.stringify({ path, config }, null, 2));
      return 0;
    }

    stderr(`Unknown command: ${command}\n\n${HELP_TEXT}`);
    return 1;
  } catch (error) {
    stderr(formatError(error));
    return 1;
  }
}

export function initProject({
  cwd,
  force,
  projectDir
}: {
  cwd: string;
  force: boolean;
  projectDir?: string;
}): InitResult {
  const created: string[] = [];
  const moved: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const projectRoot = resolve(cwd, projectDir ?? '.');
  const projectPath = relative(cwd, projectRoot) || '.';
  const projectName = packageNameFromProjectRoot(projectRoot);
  const projectRootExists = existsSync(projectRoot);

  ensureDirectory(projectRoot, created);

  if (projectDir !== undefined && projectRootExists) {
    moveExistingContentToContentDir(projectRoot, force, created, moved);
  }

  for (const file of starterProjectFiles(projectName)) {
    writeStarterFile(
      join(projectRoot, file.path),
      file.content,
      force,
      created,
      skipped
    );
  }

  updateIndexMarkdownWithImageReferences(join(projectRoot, 'content'), updated);

  return { projectRoot, projectPath, created, moved, updated, skipped };
}

function ensureDirectory(path: string, created: string[]): void {
  if (existsSync(path)) {
    if (!statSync(path).isDirectory()) {
      throw new Error(`Project path exists and is not a directory: ${path}`);
    }

    return;
  }

  mkdirSync(path, { recursive: true });
  created.push(path);
}

function getInitProjectDirArg(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith('-'));
}

function moveExistingContentToContentDir(
  projectRoot: string,
  force: boolean,
  created: string[],
  moved: string[]
): void {
  if (hasProjectScaffold(projectRoot)) {
    return;
  }

  const entries = readdirSync(projectRoot).filter(
    (entry) => entry !== 'content'
  );

  if (entries.length === 0) {
    return;
  }

  const contentRoot = join(projectRoot, 'content');
  ensureDirectory(contentRoot, created);

  for (const entry of entries) {
    const from = join(projectRoot, entry);
    const to = join(contentRoot, entry);

    if (existsSync(to) && !force) {
      throw new Error(
        `Cannot move ${from} to ${to}: destination already exists; use --force to overwrite`
      );
    }

    renameSync(from, to);
    moved.push(to);
  }
}

function hasProjectScaffold(projectRoot: string): boolean {
  return [
    'package.json',
    'svelte.config.js',
    'vite.config.ts',
    '.f8.toml',
    'src',
    '.git'
  ].some((entry) => existsSync(join(projectRoot, entry)));
}

const MARKDOWN_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp'
]);

function updateIndexMarkdownWithImageReferences(
  contentRoot: string,
  updated: string[]
): void {
  const indexPath = join(contentRoot, 'index.md');

  if (!existsSync(indexPath)) {
    return;
  }

  const imageReferences = listImageFiles(contentRoot)
    .map((imagePath) => imageReferenceForMarkdown(contentRoot, imagePath))
    .sort((left, right) => left.url.localeCompare(right.url));

  if (imageReferences.length === 0) {
    return;
  }

  const existingMarkdown = readFileSync(indexPath, 'utf8');
  const missingReferences = imageReferences.filter(
    (reference) => !markdownReferencesImage(existingMarkdown, reference.url)
  );

  if (missingReferences.length === 0) {
    return;
  }

  const imageSection = missingReferences
    .map((reference) => `![${reference.alt}](${reference.url})`)
    .join('\n\n');
  const nextMarkdown = `${existingMarkdown.trimEnd()}\n\n## Images\n\n${imageSection}\n`;

  writeFileSync(indexPath, nextMarkdown, 'utf8');
  updated.push(indexPath);
}

function listImageFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const images: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      images.push(...listImageFiles(path));
      continue;
    }

    if (MARKDOWN_IMAGE_EXTENSIONS.has(extname(entry).toLowerCase())) {
      images.push(path);
    }
  }

  return images;
}

function imageReferenceForMarkdown(
  contentRoot: string,
  imagePath: string
): { alt: string; url: string } {
  const relativePath = relative(contentRoot, imagePath).replaceAll('\\', '/');
  const url = `./${encodeURI(relativePath).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
  const alt = basename(relativePath, extname(relativePath))
    .replace(/[-_]+/g, ' ')
    .trim();

  return { alt: alt.length > 0 ? alt : 'Image', url };
}

function markdownReferencesImage(markdown: string, imageUrl: string): boolean {
  const withoutDotSlash = imageUrl.startsWith('./')
    ? imageUrl.slice(2)
    : imageUrl;

  return (
    markdown.includes(`](${imageUrl})`) ||
    markdown.includes(`](${withoutDotSlash})`)
  );
}

function writeStarterFile(
  path: string,
  content: string,
  force: boolean,
  created: string[],
  skipped: string[]
): void {
  if (existsSync(path) && !force) {
    skipped.push(path);
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  created.push(path);
}

function formatInitResult(result: InitResult): string {
  const lines = [`Initialized f8 project in ${result.projectRoot}.`];

  for (const path of result.created) {
    lines.push(`created ${path}`);
  }

  for (const path of result.moved) {
    lines.push(`moved ${path}`);
  }

  for (const path of result.updated) {
    lines.push(`updated ${path}`);
  }

  for (const path of result.skipped) {
    lines.push(`skipped ${path} (already exists; use --force to overwrite)`);
  }

  lines.push(
    '',
    'Next steps:',
    `  cd ${result.projectPath}`,
    '  pnpm install',
    '  pnpm build'
  );

  return lines.join('\n');
}

function formatError(error: unknown): string {
  if (error instanceof F8ConfigError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createStarterConfig(contentDir = 'content'): string {
  return starterConfig.replace(
    'contentDir = "content"',
    () => `contentDir = ${toTomlString(contentDir)}`
  );
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function packageNameFromProjectRoot(projectRoot: string): string {
  const normalized = basename(projectRoot)
    .toLowerCase()
    .replace(/^[._-]+/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');

  return normalized.length > 0 ? normalized : 'f8-site';
}

interface StarterProjectFile {
  path: string;
  content: string;
}

function starterProjectFiles(projectName: string): StarterProjectFile[] {
  return [
    { path: 'package.json', content: createStarterPackageJson(projectName) },
    { path: '.gitignore', content: starterGitignore },
    { path: '.f8.toml', content: createStarterConfig() },
    { path: 'svelte.config.js', content: starterSvelteConfig },
    { path: 'vite.config.ts', content: starterViteConfig },
    { path: 'tsconfig.json', content: starterTsconfig },
    { path: 'src/app.d.ts', content: starterAppTypes },
    { path: 'src/app.html', content: starterAppHtml },
    { path: 'src/routes/+layout.ts', content: starterLayout },
    {
      path: 'src/routes/[...slug]/+page.server.ts',
      content: starterPageServer
    },
    { path: 'src/routes/[...slug]/+page.svelte', content: starterPageSvelte },
    { path: 'content/index.md', content: starterMarkdown }
  ];
}

function createStarterPackageJson(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite dev',
        build: 'svelte-kit sync && vite build',
        preview: 'vite preview',
        check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json'
      },
      devDependencies: {
        '@cwygoda/f8': 'latest',
        '@sveltejs/adapter-static': '^3.0.10',
        '@sveltejs/kit': '^2.65.0',
        '@sveltejs/vite-plugin-svelte': '^7.1.2',
        svelte: '^5.56.3',
        'svelte-check': '^4.6.0',
        typescript: '^6.0.3',
        vite: '^8.0.16'
      },
      engines: {
        node: '>=24.0.0',
        pnpm: '>=11.0.0'
      }
    },
    null,
    2
  )}\n`;
}

export const starterConfig = `contentDir = "content"
outputDir = ".f8"
cacheDir = ".f8/cache"

[site]
title = "f8 starter"
description = "An image-first static site."
# url = "https://example.com"

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

[privacy]
includeGpsMetadata = false
includeExifMetadata = true
stripOutputMetadata = true

[security]
allowUnprocessedImages = false
sanitizeMarkdown = true
`;

const starterGitignore = `.DS_Store
node_modules
.svelte-kit
build
.f8
.env
.env.*
!.env.example
`;

const starterSvelteConfig = `import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
};

export default config;
`;

const starterViteConfig = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { f8Vite } from '@cwygoda/f8/sveltekit';

export default defineConfig({
  plugins: [f8Vite(), sveltekit()]
});
`;

const starterTsconfig = `{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
`;

const starterAppTypes = `/// <reference types="geojson" />

declare global {
  namespace App {}
}

export {};
`;

const starterAppHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`;

const starterLayout = `export const prerender = true;
`;

const starterPageServer = `import { error } from '@sveltejs/kit';
import { getF8PageEntries, loadF8Page } from '@cwygoda/f8/sveltekit';

import type { EntryGenerator, PageServerLoad } from './$types.js';

export const entries: EntryGenerator = () => [
  { slug: '' },
  ...getF8PageEntries()
];

export const load: PageServerLoad = async ({ params, url }) => {
  const page = await loadF8Page({
    slug: params.slug ?? '',
    origin: url.origin
  });

  if (page === undefined) {
    error(404, 'Page not found');
  }

  return { page };
};
`;

const starterPageSvelte = `<script lang="ts">
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
    --f8-shadow: 0 28px 90px rgb(45 30 12 / 16%);
    --f8-radius: 24px;
    --f8-gap: clamp(0.85rem, 2vw, 1.5rem);
  }

  :global(body) {
    margin: 0;
    font-family: var(--f8-font-sans);
    color: var(--f8-fg);
    background: var(--f8-bg);
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --f8-bg: #12100e;
      --f8-fg: #f7f1e8;
      --f8-muted: #c8bcad;
      --f8-border: rgb(247 241 232 / 15%);
      --f8-accent: #d1a45f;
      --f8-shadow: 0 30px 100px rgb(0 0 0 / 42%);
    }
  }

  .site-shell {
    box-sizing: border-box;
    min-height: 100svh;
    padding: clamp(1.25rem, 4vw, 4rem);
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

  .f8-page :global(a) {
    color: var(--f8-accent);
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
</style>
`;

export const starterMarkdown = `---
title: Welcome to f8
description: Your first image-first story.
---

# Welcome to f8

Drop images next to this Markdown file and reference them with relative paths:

\`\`\`md
![A local image](./photo.jpg)
\`\`\`

Then run:

\`\`\`bash
pnpm dev
\`\`\`
`;

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectRun) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
