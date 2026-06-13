import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { F8Config } from '../config/index.js';
import type { F8ImageMetadata, F8ImageVariant } from '../types.js';

export const DEFAULT_F8_ASSET_BASE = '/@f8';

const CACHE_RECORD_EXTENSION = '.cache.json';
const SERVED_EXTENSIONS = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

export interface F8AssetUrlOptions {
  cacheDir: string;
  assetBase?: string;
}

export interface F8CachedAsset {
  cacheKey: string;
  cachePath: string;
  relativePath: string;
  urlPath: string;
  outputFileName: string;
}

interface CacheRecord {
  cacheKey?: string;
}

export function withF8AssetUrls(
  images: F8ImageMetadata[],
  options: F8AssetUrlOptions
): F8ImageMetadata[] {
  return images.map((image) => ({
    ...image,
    variants: image.variants.map((variant) => ({
      ...variant,
      src: f8AssetUrl({
        variant,
        cacheKey: image.cacheKey ?? image.id,
        cacheDir: options.cacheDir,
        ...optionalString('assetBase', options.assetBase)
      })
    }))
  }));
}

export function f8AssetUrl(input: {
  variant: F8ImageVariant;
  cacheKey: string;
  cacheDir: string;
  assetBase?: string;
}): string {
  const assetBase = normalizeF8AssetBase(input.assetBase);
  const relativeAssetPath = relativeCacheAssetPath(
    input.variant.src,
    input.cacheDir
  );

  return `${assetBase}/${encodeURIComponent(input.cacheKey)}/${relativeAssetPath}`;
}

export function listCachedF8Assets(input: {
  cwd: string;
  config: F8Config;
  assetBase?: string;
}): F8CachedAsset[] {
  const cacheRoot = resolve(input.cwd, input.config.cacheDir);

  if (!existsSync(cacheRoot)) {
    return [];
  }

  const records = walkFiles(cacheRoot).filter((filePath) =>
    filePath.endsWith(CACHE_RECORD_EXTENSION)
  );
  const assets: F8CachedAsset[] = [];

  for (const recordPath of records) {
    const record = readCacheRecord(recordPath);
    if (record.cacheKey === undefined) {
      continue;
    }

    const recordDir = dirname(recordPath);
    for (const assetPath of readdirSync(recordDir).map((entry) =>
      join(recordDir, entry)
    )) {
      if (!statSync(assetPath).isFile() || !isServedAsset(assetPath)) {
        continue;
      }

      const relativePath = toPosixPath(relative(cacheRoot, assetPath));
      const urlPath = f8CachedAssetUrl({
        cacheKey: record.cacheKey,
        relativePath,
        ...optionalString('assetBase', input.assetBase)
      });
      assets.push({
        cacheKey: record.cacheKey,
        cachePath: assetPath,
        relativePath,
        urlPath,
        outputFileName: urlPath.replace(/^\//, '')
      });
    }
  }

  return assets;
}

export function serveF8CachedAsset(input: {
  cwd: string;
  config: F8Config;
  assetBase?: string;
  request: IncomingMessage;
  response: ServerResponse;
}): boolean {
  const asset = resolveF8AssetRequest(input);

  if (asset === undefined || !existsSync(asset.cachePath)) {
    return false;
  }

  const stats = statSync(asset.cachePath);
  if (!stats.isFile()) {
    return false;
  }

  input.response.statusCode = 200;
  input.response.setHeader('Content-Type', contentType(asset.cachePath));
  input.response.setHeader('Content-Length', String(stats.size));
  input.response.setHeader(
    'Cache-Control',
    'public, max-age=31536000, immutable'
  );
  createReadStream(asset.cachePath).pipe(input.response);
  return true;
}

export function normalizeF8AssetBase(assetBase?: string): string {
  const normalized = (assetBase ?? DEFAULT_F8_ASSET_BASE).replace(
    /^\/+|\/+$/g,
    ''
  );
  return `/${normalized}`;
}

function f8CachedAssetUrl(input: {
  cacheKey: string;
  relativePath: string;
  assetBase?: string;
}): string {
  return `${normalizeF8AssetBase(input.assetBase)}/${encodeURIComponent(
    input.cacheKey
  )}/${toPosixPath(input.relativePath)}`;
}

function resolveF8AssetRequest(input: {
  cwd: string;
  config: F8Config;
  assetBase?: string;
  request: IncomingMessage;
}): { cachePath: string } | undefined {
  const url = new URL(input.request.url ?? '/', 'http://f8.local');
  const assetBase = normalizeF8AssetBase(input.assetBase);

  if (!url.pathname.startsWith(`${assetBase}/`)) {
    return undefined;
  }

  const parts = url.pathname.slice(assetBase.length + 1).split('/');
  if (parts.length < 2) {
    return undefined;
  }

  const relativePath = decodeUriPath(parts.slice(1).join('/'));
  if (isUnsafeRelativePath(relativePath) || !isServedAsset(relativePath)) {
    return undefined;
  }

  return {
    cachePath: resolve(input.cwd, input.config.cacheDir, relativePath)
  };
}

function relativeCacheAssetPath(src: string, cacheDir: string): string {
  const normalizedSrc = toPosixPath(src)
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
  const normalizedCacheDir = toPosixPath(cacheDir)
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');

  if (normalizedSrc.startsWith(`${normalizedCacheDir}/`)) {
    return normalizedSrc.slice(normalizedCacheDir.length + 1);
  }

  return normalizedSrc;
}

function readCacheRecord(recordPath: string): CacheRecord {
  const parsed = JSON.parse(readFileSync(recordPath, 'utf8')) as unknown;

  return typeof parsed === 'object' && parsed !== null
    ? (parsed as CacheRecord)
    : {};
}

function walkFiles(root: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (stats.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function isServedAsset(filePath: string): boolean {
  return SERVED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function isUnsafeRelativePath(relativePath: string): boolean {
  return (
    relativePath.length === 0 ||
    relativePath.startsWith('/') ||
    relativePath.split('/').includes('..')
  );
}

function decodeUriPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

function contentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.avif':
      return 'image/avif';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function optionalString<T extends string>(
  key: T,
  value: string | undefined
): Partial<Record<T, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<T, string>);
}

function toPosixPath(filePath: string): string {
  return filePath.split('\\').join('/');
}
