import { mdsvex, type MdsvexOptions } from 'mdsvex';
import type { Plugin, Settings } from 'unified';

import {
  f8RemarkImages,
  type F8MarkdownRenderOptions
} from '../markdown/index.js';
import type { F8ImageMetadata } from '../types.js';

export {
  createPageSeo,
  getF8PageEntries,
  listMarkdownPages,
  loadF8Page,
  materializeStaticImageAssets,
  parseMarkdownFrontmatter,
  processF8MarkdownImages,
  type F8MarkdownImageProcessOptions,
  type F8PageEntry,
  type F8PageFrontmatter,
  type F8PageSeo,
  type F8RenderedPage,
  type F8StaticSiteOptions
} from './content.js';
export {
  DEFAULT_F8_ASSET_BASE,
  f8AssetUrl,
  listCachedF8Assets,
  normalizeF8AssetBase,
  serveF8CachedAsset,
  withF8AssetUrls,
  type F8AssetUrlOptions,
  type F8CachedAsset
} from './assets.js';
export {
  f8SvelteKitVite,
  f8Vite,
  processAllF8MarkdownImages,
  type F8VitePluginOptions
} from './vite.js';

export interface F8SvelteKitOptions {
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
}

export function f8SvelteKit(
  options: F8SvelteKitOptions = {}
): F8SvelteKitIntegration {
  const extensions = options.extensions ?? ['.md'];
  const images = options.images ?? [];
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
    images
  };
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
