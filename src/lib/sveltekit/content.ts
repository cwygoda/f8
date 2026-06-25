import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync
} from 'node:fs';
import path, { dirname, extname, join, relative, resolve } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { loadConfig, type F8Config } from '../config/index.js';
import { listMarkdownImageSources, renderMarkdown } from '../markdown/index.js';
import { isSupportedImagePath, processImage } from '../pipeline/index.js';
import { DEFAULT_F8_ASSET_BASE, withF8AssetUrls } from './assets.js';
import type { F8ImageMetadata, F8ImageVariant } from '../types.js';

const FRONTMATTER_BOUNDARY = '---';
const MARKDOWN_EXTENSION = '.md';
const DEFAULT_ASSET_BASE = '/assets/f8';
const DEFAULT_STATIC_ASSET_DIR = 'static/assets/f8';

export interface F8PageFrontmatter {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  theme?: 'dark' | 'light' | 'system';
  [key: string]: unknown;
}

export interface ParsedMarkdownFrontmatter {
  frontmatter: F8PageFrontmatter;
  content: string;
}

export interface F8PageEntry {
  slug: string;
  path: string;
  urlPath: string;
}

export interface F8RenderedPage extends F8PageEntry {
  frontmatter: F8PageFrontmatter;
  markdown: string;
  html: string;
  images: F8ImageMetadata[];
  seo: F8PageSeo;
}

export interface F8PageSeo {
  title: string;
  description?: string;
  canonical?: string;
  openGraph: {
    title: string;
    description?: string;
    image?: string;
    type: 'article' | 'website';
    url?: string;
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description?: string;
    image?: string;
  };
}

export interface F8StaticSiteOptions {
  cwd?: string;
  config?: F8Config;
  copyAssets?: boolean;
  assetBase?: string;
  staticAssetDir?: string;
}

export interface F8PageLoadOptions extends F8StaticSiteOptions {
  slug?: string;
  origin?: string;
  processImages?: boolean;
}

export interface F8MarkdownImageProcessOptions extends F8StaticSiteOptions {
  pagePath?: string;
  markdown?: string;
}

export function parseMarkdownFrontmatter(
  markdown: string
): ParsedMarkdownFrontmatter {
  if (!markdown.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return { frontmatter: {}, content: markdown };
  }

  const closeIndex = markdown.indexOf(`\n${FRONTMATTER_BOUNDARY}\n`, 4);
  if (closeIndex === -1) {
    return { frontmatter: {}, content: markdown };
  }

  const rawFrontmatter = markdown.slice(4, closeIndex);
  const content = markdown.slice(closeIndex + FRONTMATTER_BOUNDARY.length + 2);
  const parsed = parseYaml(rawFrontmatter) as unknown;

  return {
    frontmatter: isRecord(parsed) ? normalizeFrontmatter(parsed) : {},
    content: content.trimStart()
  };
}

export function listMarkdownPages(
  options: F8StaticSiteOptions = {}
): F8PageEntry[] {
  const { cwd, config } = resolveSiteContext(options);
  const contentRoot = resolve(cwd, config.contentDir);

  if (!existsSync(contentRoot)) {
    return [];
  }

  return walkMarkdownFiles(contentRoot)
    .map((filePath) => pageEntryFromPath(contentRoot, filePath))
    .toSorted((left, right) => left.slug.localeCompare(right.slug));
}

export function getF8PageEntries(
  options: F8StaticSiteOptions = {}
): Array<{ slug: string }> {
  return listMarkdownPages(options)
    .filter((entry) => entry.slug.length > 0)
    .map((entry) => ({ slug: entry.slug }));
}

export async function loadF8Page(
  options: F8PageLoadOptions = {}
): Promise<F8RenderedPage | undefined> {
  const { cwd, config } = resolveSiteContext(options);
  const slug = normalizeSlug(options.slug ?? '');
  const entry = listMarkdownPages({ cwd, config }).find(
    (candidate) => candidate.slug === slug
  );

  if (entry === undefined) {
    return undefined;
  }

  const parsed = parseMarkdownFrontmatter(readFileSync(entry.path, 'utf8'));
  const referencedImages =
    options.processImages === false
      ? []
      : await processReferencedMarkdownImages({
          cwd,
          config,
          markdown: parsed.content,
          pagePath: entry.path
        });
  const images =
    options.copyAssets === false
      ? referencedImages
      : withF8AssetUrls(referencedImages, {
          cacheDir: config.cacheDir,
          assetBase: options.assetBase ?? DEFAULT_F8_ASSET_BASE
        });
  const rendered = renderMarkdown(parsed.content, {
    images,
    resolveImage: createContentImageResolver(images, {
      cwd,
      pagePath: entry.path
    }),
    allowUnprocessedImages: config.security.allowUnprocessedImages,
    sanitize: config.security.sanitizeMarkdown
  });
  const pageImages = rendered.images
    .map((image) => image.metadata)
    .filter((image): image is F8ImageMetadata => image !== undefined);

  return {
    ...entry,
    frontmatter: parsed.frontmatter,
    markdown: parsed.content,
    html: rendered.html,
    images: pageImages,
    seo: createPageSeo({
      frontmatter: parsed.frontmatter,
      slug: entry.slug,
      urlPath: entry.urlPath,
      images: pageImages,
      ...optionalString('origin', options.origin ?? config.site.url),
      siteTitle: config.site.title,
      siteDescription: config.site.description
    })
  };
}

export async function processF8MarkdownImages(
  options: F8MarkdownImageProcessOptions = {}
): Promise<F8ImageMetadata[]> {
  const { cwd, config } = resolveSiteContext(options);

  if (options.pagePath !== undefined && options.markdown !== undefined) {
    return processReferencedMarkdownImages({
      cwd,
      config,
      markdown: options.markdown,
      pagePath: options.pagePath
    });
  }

  const processed = new Map<string, F8ImageMetadata>();
  for (const entry of listMarkdownPages({ cwd, config })) {
    const parsed = parseMarkdownFrontmatter(readFileSync(entry.path, 'utf8'));
    const images = await processReferencedMarkdownImages({
      cwd,
      config,
      markdown: parsed.content,
      pagePath: entry.path
    });

    for (const image of images) {
      processed.set(image.sourcePath, image);
    }
  }

  return [...processed.values()];
}

export function materializeStaticImageAssets(
  images: F8ImageMetadata[],
  options: F8StaticSiteOptions = {}
): F8ImageMetadata[] {
  const { cwd, config } = resolveSiteContext(options);
  const assetBase = normalizeAssetBase(options.assetBase ?? DEFAULT_ASSET_BASE);
  const staticAssetRoot = resolve(
    cwd,
    options.staticAssetDir ?? DEFAULT_STATIC_ASSET_DIR
  );

  return images.map((image) => {
    const variants = image.variants.map((variant) =>
      materializeVariant(variant, {
        cwd,
        cacheDir: config.cacheDir,
        assetBase,
        staticAssetRoot
      })
    );
    return {
      ...image,
      variants
    };
  });
}

export function createPageSeo(input: {
  frontmatter: F8PageFrontmatter;
  slug: string;
  urlPath: string;
  images?: F8ImageMetadata[];
  origin?: string;
  siteTitle?: string;
  siteDescription?: string;
}): F8PageSeo {
  const siteTitle = input.siteTitle ?? 'f8';
  const title = stringFrontmatter(input.frontmatter.title) ?? siteTitle;
  const description =
    stringFrontmatter(input.frontmatter.description) ??
    (input.slug.length === 0 ? input.siteDescription : undefined);
  const image = absoluteUrl(
    firstString(
      input.frontmatter.ogImage,
      input.frontmatter.image,
      largestVariant(input.images?.[0])?.src
    ),
    input.origin
  );
  const canonical = firstString(
    input.frontmatter.canonical,
    input.origin === undefined
      ? undefined
      : new URL(input.urlPath, input.origin).href
  );
  const openGraphDescription =
    stringFrontmatter(input.frontmatter.ogDescription) ?? description;
  const twitterImage = absoluteUrl(
    firstString(input.frontmatter.twitterImage, image),
    input.origin
  );
  const twitterDescription =
    stringFrontmatter(input.frontmatter.twitterDescription) ?? description;

  return {
    title,
    ...(description === undefined ? {} : { description }),
    ...(canonical === undefined ? {} : { canonical }),
    openGraph: {
      title: stringFrontmatter(input.frontmatter.ogTitle) ?? title,
      ...(openGraphDescription === undefined
        ? {}
        : { description: openGraphDescription }),
      ...(image === undefined ? {} : { image }),
      type: input.slug.length === 0 ? 'website' : 'article',
      ...(canonical === undefined ? {} : { url: canonical })
    },
    twitter: {
      card: image === undefined ? 'summary' : 'summary_large_image',
      title: stringFrontmatter(input.frontmatter.twitterTitle) ?? title,
      ...(twitterDescription === undefined
        ? {}
        : { description: twitterDescription }),
      ...(twitterImage === undefined ? {} : { image: twitterImage })
    }
  };
}

function resolveSiteContext(options: F8StaticSiteOptions): {
  cwd: string;
  config: F8Config;
} {
  const cwd = resolve(options.cwd ?? process.cwd());
  return { cwd, config: options.config ?? loadConfig({ cwd }).config };
}

function normalizeFrontmatter(
  value: Record<string, unknown>
): F8PageFrontmatter {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as F8PageFrontmatter;
}

function walkMarkdownFiles(root: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
    } else if (
      stats.isFile() &&
      extname(fullPath).toLowerCase() === MARKDOWN_EXTENSION
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function pageEntryFromPath(contentRoot: string, filePath: string): F8PageEntry {
  const relativePath = toPosixPath(relative(contentRoot, filePath));
  const withoutExtension = relativePath.slice(0, -MARKDOWN_EXTENSION.length);
  const slug = withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension === 'index'
      ? ''
      : withoutExtension;
  const normalizedSlug = normalizeSlug(slug);

  return {
    slug: normalizedSlug,
    path: filePath,
    urlPath: normalizedSlug.length === 0 ? '/' : `/${normalizedSlug}`
  };
}

async function processReferencedMarkdownImages(input: {
  cwd: string;
  config: F8Config;
  markdown: string;
  pagePath: string;
}): Promise<F8ImageMetadata[]> {
  const contentRoot = resolve(input.cwd, input.config.contentDir);
  const processed = new Map<string, F8ImageMetadata>();

  for (const src of listMarkdownImageSources(input.markdown)) {
    const sourcePath = resolveLocalMarkdownImagePath(src, {
      cwd: input.cwd,
      pagePath: input.pagePath
    });

    if (
      sourcePath === undefined ||
      processed.has(sourcePath) ||
      !existsSync(sourcePath) ||
      !isSupportedImagePath(sourcePath)
    ) {
      continue;
    }

    if (!isInsidePath(sourcePath, contentRoot)) {
      continue;
    }

    const result = await processImage(sourcePath, {
      cwd: input.cwd,
      config: input.config,
      imageRoot: contentRoot
    });
    processed.set(sourcePath, result.metadata);
  }

  return [...processed.values()];
}

function createContentImageResolver(
  images: F8ImageMetadata[],
  options: { cwd: string; pagePath: string }
): (src: string) => F8ImageMetadata | undefined {
  const sourceIndex = new Map(
    images.map((image) => [resolve(options.cwd, image.sourcePath), image])
  );

  return (src) => {
    const sourcePath = resolveLocalMarkdownImagePath(src, options);
    return sourcePath === undefined ? undefined : sourceIndex.get(sourcePath);
  };
}

function materializeVariant(
  variant: F8ImageVariant,
  options: {
    cwd: string;
    cacheDir: string;
    assetBase: string;
    staticAssetRoot: string;
  }
): F8ImageVariant {
  const relativeAssetPath = relativeVariantAssetPath(
    variant.src,
    options.cacheDir
  );

  if (relativeAssetPath === undefined) {
    return variant;
  }

  const sourcePath = resolve(options.cwd, options.cacheDir, relativeAssetPath);
  const targetPath = join(options.staticAssetRoot, relativeAssetPath);

  if (existsSync(sourcePath)) {
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }

  return {
    ...variant,
    src: `${options.assetBase}/${relativeAssetPath}`
  };
}

function relativeVariantAssetPath(
  src: string,
  cacheDir: string
): string | undefined {
  const normalizedSrc = toPosixPath(src)
    .replace(/^\.\//, '')
    .replace(/^\//, '');
  const normalizedCacheDir = toPosixPath(cacheDir)
    .replace(/^\.\//, '')
    .replace(/^\//, '');

  if (!normalizedSrc.startsWith(`${normalizedCacheDir}/`)) {
    return undefined;
  }

  return normalizedSrc.slice(normalizedCacheDir.length + 1);
}

function resolveLocalMarkdownImagePath(
  src: string,
  options: { cwd: string; pagePath: string }
): string | undefined {
  if (isRemoteOrSpecialUrl(src)) {
    return undefined;
  }

  const withoutHash = src.split('#')[0] ?? src;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const decoded = decodeUriPath(withoutQuery);

  if (decoded.length === 0) {
    return undefined;
  }

  return decoded.startsWith('/')
    ? resolve(options.cwd, decoded.slice(1))
    : resolve(dirname(options.pagePath), decoded);
}

function isRemoteOrSpecialUrl(src: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(src);
}

function decodeUriPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

function isInsidePath(childPath: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function normalizeAssetBase(assetBase: string): string {
  return `/${assetBase.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeSlug(slug: string): string {
  return toPosixPath(slug).replace(/^\/+|\/+$/g, '');
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function largestVariant(
  image: F8ImageMetadata | undefined
): F8ImageVariant | undefined {
  return image?.variants.toSorted((left, right) => right.width - left.width)[0];
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
}

function stringFrontmatter(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function optionalString<K extends string>(
  key: K,
  value: string | undefined
): Record<K, string> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function absoluteUrl(
  value: string | undefined,
  origin: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (origin === undefined || /^[a-z][a-z\d+.-]*:/i.test(value)) {
    return value;
  }

  return new URL(value, origin).href;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
