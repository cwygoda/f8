#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { F8ConfigError, loadConfig } from '../lib/config/index.js';

const HELP_TEXT = `f8 — image-first publishing toolkit for SvelteKit

Usage:
  f8 [command] [options]

Commands:
  init          Create starter f8 project files
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
  created: string[];
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
      const result = initProject({ cwd, force: args.includes('--force') });
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
  force
}: {
  cwd: string;
  force: boolean;
}): InitResult {
  const created: string[] = [];
  const skipped: string[] = [];

  ensureDirectory(join(cwd, 'content'), created);
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
