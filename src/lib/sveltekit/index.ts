import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { mdsvex, type MdsvexOptions } from 'mdsvex';
import type { Plugin, Settings } from 'unified';

import { loadConfig } from '../config/index.js';
import {
  f8RemarkImages,
  type F8MarkdownRenderOptions
} from '../markdown/index.js';
import {
  IMAGE_MANIFEST_FILENAME,
  type F8ImageManifest
} from '../pipeline/index.js';
import type { F8ImageMetadata } from '../types.js';

export {
  createPageSeo,
  getF8PageEntries,
  listMarkdownPages,
  loadF8Page,
  materializeStaticImageAssets,
  parseMarkdownFrontmatter,
  type F8PageEntry,
  type F8PageFrontmatter,
  type F8PageSeo,
  type F8RenderedPage,
  type F8StaticSiteOptions
} from './content.js';

export interface F8SvelteKitOptions {
  cwd?: string;
  manifestPath?: string;
  images?: F8ImageMetadata[];
  imageBasePaths?: string[];
  imageSizes?: string;
  extensions?: string[];
  mdsvex?: MdsvexOptions;
}

export interface F8SvelteKitIntegration {
  extensions: string[];
  preprocess: ReturnType<typeof mdsvex>;
  images: F8ImageMetadata[];
  manifestPath: string;
}

export function f8SvelteKit(
  options: F8SvelteKitOptions = {}
): F8SvelteKitIntegration {
  const extensions = options.extensions ?? ['.md'];
  const manifestPath = resolveManifestPath(options);
  const images = options.images ?? loadImageManifest({ manifestPath }).images;
  const mdsvexOptions = options.mdsvex ?? {};
  const remarkPlugins = withF8RemarkPlugin(mdsvexOptions.remarkPlugins, {
    images,
    ...(options.imageBasePaths === undefined
      ? {}
      : { imageBasePaths: options.imageBasePaths }),
    ...(options.imageSizes === undefined
      ? {}
      : { imageSizes: options.imageSizes })
  });

  return {
    extensions: ['.svelte', ...extensions],
    preprocess: mdsvex({
      ...mdsvexOptions,
      extensions,
      remarkPlugins
    }),
    images,
    manifestPath
  };
}

export function loadImageManifest(
  options: {
    cwd?: string;
    manifestPath?: string;
  } = {}
): F8ImageManifest {
  const manifestPath = options.manifestPath ?? resolveManifestPath(options);

  if (!existsSync(manifestPath)) {
    return emptyManifest();
  }

  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  return normalizeManifest(parsed, manifestPath);
}

function resolveManifestPath(options: {
  cwd?: string;
  manifestPath?: string;
}): string {
  if (options.manifestPath !== undefined) {
    return resolve(options.cwd ?? process.cwd(), options.manifestPath);
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  const { config } = loadConfig({ cwd });
  return join(cwd, config.cacheDir, IMAGE_MANIFEST_FILENAME);
}

function withF8RemarkPlugin(
  remarkPlugins: MdsvexOptions['remarkPlugins'],
  options: F8MarkdownRenderOptions
): NonNullable<MdsvexOptions['remarkPlugins']> {
  return [
    ...(remarkPlugins ?? []),
    [f8RemarkImages as Plugin, options as Settings]
  ];
}

function emptyManifest(): F8ImageManifest {
  return {
    pipelineVersion: 'unknown',
    generatedAt: new Date(0).toISOString(),
    imageDir: 'images',
    cacheDir: '.f8/cache',
    images: []
  };
}

function normalizeManifest(
  value: unknown,
  manifestPath: string
): F8ImageManifest {
  if (!isRecord(value) || !Array.isArray(value.images)) {
    throw new Error(`Invalid f8 image manifest: ${manifestPath}`);
  }

  return {
    pipelineVersion: stringField(value, 'pipelineVersion') ?? 'unknown',
    generatedAt: stringField(value, 'generatedAt') ?? new Date(0).toISOString(),
    imageDir: stringField(value, 'imageDir') ?? 'images',
    cacheDir: stringField(value, 'cacheDir') ?? '.f8/cache',
    images: value.images as F8ImageMetadata[]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}
