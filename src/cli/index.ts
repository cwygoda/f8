#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { F8ConfigError, loadConfig } from '../lib/config/index.js';
import {
  discoverImages,
  processImageDirectory
} from '../lib/pipeline/index.js';
import type { F8Config } from '../lib/config/index.js';

const HELP_TEXT = `f8 — image-first publishing toolkit for SvelteKit

Usage:
  f8 [command] [options]

Commands:
  init          Create starter f8 project files
  config        Validate and print the resolved configuration
  build-images  Generate responsive image variants and metadata artifacts
  index <image-dir> [output-md]
                Create or update a Markdown index for an image directory
  help          Show this help message

Options:
  -h, --help    Show this help message
  --force       Overwrite files when used with init or build-images
  --dry-run     Print generated Markdown when used with index
`;

export interface CliIO {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export interface CliOptions extends CliIO {
  cwd?: string;
}

interface InitResult {
  created: string[];
  skipped: string[];
}

export interface IndexImagesResult {
  imageDir: string;
  outputPath: string;
  images: string[];
  markdown: string;
  written: boolean;
}

const INDEX_START = '<!-- f8:index:start -->';
const INDEX_END = '<!-- f8:index:end -->';

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
      const result = initProject({ cwd, force: args.includes('--force') });
      stdout(formatInitResult(result));
      return 0;
    }

    if (command === 'config') {
      const { config, path } = loadConfig({ cwd });
      stdout(JSON.stringify({ path, config }, null, 2));
      return 0;
    }

    if (command === 'build-images') {
      const { config } = loadConfig({ cwd });
      const result = await processImageDirectory({
        cwd,
        config,
        force: args.includes('--force')
      });
      stdout(formatBuildImagesResult(result));
      return 0;
    }

    if (command === 'index') {
      const { config } = loadConfig({ cwd });
      const positionalArgs = args.filter((arg) => !arg.startsWith('-'));
      const result = indexImages({
        cwd,
        config,
        ...optionalCliArg('imageDir', positionalArgs[0]),
        ...optionalCliArg('outputPath', positionalArgs[1]),
        dryRun: args.includes('--dry-run')
      });
      stdout(formatIndexImagesResult(result));
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
  force
}: {
  cwd: string;
  force: boolean;
}): InitResult {
  const created: string[] = [];
  const skipped: string[] = [];

  ensureDirectory(join(cwd, 'content'), created);
  ensureDirectory(join(cwd, 'images'), created);
  ensureDirectory(join(cwd, '.f8', 'cache'), created);
  writeStarterFile(
    join(cwd, 'f8.config.toml'),
    starterConfig,
    force,
    created,
    skipped
  );
  writeStarterFile(
    join(cwd, 'content', 'index.md'),
    starterMarkdown,
    force,
    created,
    skipped
  );

  return { created, skipped };
}

export function indexImages({
  cwd,
  config,
  imageDir,
  outputPath,
  dryRun = false
}: {
  cwd: string;
  config?: F8Config;
  imageDir?: string;
  outputPath?: string;
  dryRun?: boolean;
}): IndexImagesResult {
  const resolvedConfig = config ?? loadConfig({ cwd }).config;
  const requestedImageDir = imageDir ?? resolvedConfig.imageDir;
  const requestedOutputPath =
    outputPath ?? join(resolvedConfig.contentDir, 'index.md');
  const absoluteImageDir = resolve(cwd, requestedImageDir);
  const absoluteOutputPath = resolve(cwd, requestedOutputPath);
  const images = discoverImages({
    rootDir: absoluteImageDir,
    sortBy: resolvedConfig.image.sortBy,
    sortDirection: resolvedConfig.image.sortDirection
  });
  const block = renderIndexBlock(images, absoluteOutputPath);
  const markdown = mergeIndexBlock(
    existsSync(absoluteOutputPath)
      ? readFileSync(absoluteOutputPath, 'utf8')
      : starterMarkdown,
    block
  );

  if (!dryRun) {
    mkdirSync(dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, markdown, 'utf8');
  }

  return {
    imageDir: absoluteImageDir,
    outputPath: absoluteOutputPath,
    images,
    markdown,
    written: !dryRun
  };
}

function ensureDirectory(path: string, created: string[]): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    created.push(path);
  }
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
  const lines = ['Initialized f8 project.'];

  for (const path of result.created) {
    lines.push(`created ${path}`);
  }

  for (const path of result.skipped) {
    lines.push(`skipped ${path} (already exists; use --force to overwrite)`);
  }

  return lines.join('\n');
}

function formatBuildImagesResult(
  result: Awaited<ReturnType<typeof processImageDirectory>>
): string {
  return [
    `Processed ${result.images.length} image(s).`,
    `generated ${result.generated}`,
    `cached ${result.cached}`,
    `manifest ${result.manifestPath}`
  ].join('\n');
}

function formatIndexImagesResult(result: IndexImagesResult): string {
  return [
    `${result.written ? 'Indexed' : 'Generated'} ${result.images.length} image(s).`,
    `imageDir ${result.imageDir}`,
    `markdown ${result.outputPath}`,
    ...(result.written ? [] : ['', result.markdown])
  ].join('\n');
}

function renderIndexBlock(images: string[], outputPath: string): string {
  const lines = images.map((imagePath) => {
    const relativePath = toPosixPath(relative(dirname(outputPath), imagePath));
    const href = relativePath.startsWith('.')
      ? relativePath
      : `./${relativePath}`;
    return `![](${href})`;
  });

  return [INDEX_START, ...lines, INDEX_END].join('\n');
}

function mergeIndexBlock(markdown: string, block: string): string {
  const start = markdown.indexOf(INDEX_START);
  const end = markdown.indexOf(INDEX_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = markdown.slice(0, start).trimEnd();
    const after = markdown.slice(end + INDEX_END.length).trimStart();
    return (
      [before, block, after].filter((part) => part.length > 0).join('\n\n') +
      '\n'
    );
  }

  return `${markdown.trimEnd()}\n\n${block}\n`;
}

function toPosixPath(value: string): string {
  return value.split('\\').join('/');
}

function optionalCliArg<K extends string>(
  key: K,
  value: string | undefined
): Record<K, string> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
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

export const starterConfig = `contentDir = "content"
imageDir = "images"
outputDir = ".f8"
cacheDir = ".f8/cache"

[site]
title = "f8 starter"
description = "An image-first static site."
# url = "https://example.com"

[image]
widths = [480, 768, 1024, 1440, 1920, 2560]
formats = ["avif", "webp", "jpeg"]
sortBy = "path"
sortDirection = "asc"
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
`;

export const starterMarkdown = `---
title: Welcome to f8
description: Your first image-first story.
---

# Welcome to f8

Drop images into \`images/\`, then run:

\`\`\`bash
f8 index images content/index.md
f8 build-images
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
