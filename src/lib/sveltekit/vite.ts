import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { PluginOption, ResolvedConfig } from 'vite';

import { loadConfig, type F8Config } from '../config/index.js';
import { isSupportedImagePath, processImage } from '../pipeline/index.js';
import type { F8ImageMetadata } from '../types.js';
import {
  listCachedF8Assets,
  normalizeF8AssetBase,
  serveF8CachedAsset,
  withF8AssetUrls
} from './assets.js';
import {
  listMarkdownPages,
  parseMarkdownFrontmatter,
  processF8MarkdownImages
} from './content.js';

export interface F8VitePluginOptions {
  cwd?: string;
  assetBase?: string;
}

export function f8Vite(options: F8VitePluginOptions = {}): PluginOption {
  let resolvedConfig: ResolvedConfig | undefined;
  const activeCacheKeys = new Set<string>();

  const context = (): { cwd: string; config: F8Config; assetBase: string } => {
    const cwd = options.cwd ?? resolvedConfig?.root ?? process.cwd();
    return {
      cwd,
      config: loadConfig({ cwd }).config,
      assetBase: normalizeF8AssetBase(options.assetBase)
    };
  };

  return {
    name: 'f8:vite',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const { cwd, config, assetBase } = context();
        const served = serveF8CachedAsset({
          cwd,
          config,
          assetBase,
          request,
          response
        });

        if (!served) {
          next();
        }
      });
    },
    async load(id) {
      const importRequest = parseF8ImportRequest(id);
      if (importRequest === undefined) {
        return undefined;
      }

      const { cwd, config, assetBase } = context();
      const metadata = await loadF8ImportedImage({
        cwd,
        config,
        filePath: importRequest.filePath
      });
      trackActiveImages(activeCacheKeys, [metadata]);
      const serialized = JSON.stringify(
        withF8AssetUrls([metadata], {
          cacheDir: config.cacheDir,
          assetBase
        })[0]
      );

      return `export const metadata = ${serialized};\nexport default metadata;\n`;
    },
    async buildStart() {
      const { cwd, config } = context();

      trackActiveImages(
        activeCacheKeys,
        await processF8MarkdownImages({ cwd, config })
      );
    },
    generateBundle() {
      const { cwd, config, assetBase } = context();

      for (const asset of listCachedF8Assets({ cwd, config, assetBase })) {
        if (!activeCacheKeys.has(asset.cacheKey)) {
          continue;
        }

        this.emitFile({
          type: 'asset',
          fileName: asset.outputFileName,
          source: readFileSync(asset.cachePath)
        });
      }
    }
  };
}

export function f8SvelteKitVite(
  options: F8VitePluginOptions = {}
): PluginOption {
  return f8Vite(options);
}

export async function processAllF8MarkdownImages(
  options: F8VitePluginOptions = {}
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig({ cwd }).config;

  for (const page of listMarkdownPages({ cwd, config })) {
    const parsed = parseMarkdownFrontmatter(readFileSync(page.path, 'utf8'));
    await processF8MarkdownImages({
      cwd,
      config,
      pagePath: page.path,
      markdown: parsed.content
    });
  }
}

async function loadF8ImportedImage(input: {
  cwd: string;
  config: F8Config;
  filePath: string;
}): Promise<F8ImageMetadata> {
  if (!existsSync(input.filePath) || !isSupportedImagePath(input.filePath)) {
    throw new Error(`Cannot import unsupported f8 image: ${input.filePath}`);
  }

  const contentRoot = resolve(input.cwd, input.config.contentDir);
  const configuredImageRoot = resolve(input.cwd, input.config.imageDir);
  const imageRoot = isInsidePath(input.filePath, contentRoot)
    ? contentRoot
    : isInsidePath(input.filePath, configuredImageRoot)
      ? configuredImageRoot
      : dirname(input.filePath);
  const result = await processImage(input.filePath, {
    cwd: input.cwd,
    config: input.config,
    imageRoot
  });

  return result.metadata;
}

function trackActiveImages(
  activeCacheKeys: Set<string>,
  images: F8ImageMetadata[]
): void {
  for (const image of images) {
    if (image.cacheKey !== undefined) {
      activeCacheKeys.add(image.cacheKey);
    }
  }
}

function parseF8ImportRequest(id: string): { filePath: string } | undefined {
  const [filePath, query = ''] = id.split('?', 2);
  const params = new URLSearchParams(query);

  return params.has('f8') && filePath !== undefined && filePath.length > 0
    ? { filePath }
    : undefined;
}

function isInsidePath(childPath: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith('..') && !relativePath.startsWith('/'))
  );
}
