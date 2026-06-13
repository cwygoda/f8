import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path, {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve
} from 'node:path';

import { encode as encodeBlurhash } from 'blurhash';
import exifr from 'exifr';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

import { f8ConfigSchema, type F8Config } from '../config/index.js';
import type {
  F8Exif,
  F8ImageFormat,
  F8ImageMetadata,
  F8ImageVariant,
  F8Location
} from '../types.js';

export const PIPELINE_VERSION = '2.0.0';
export const IMAGE_MANIFEST_FILENAME = 'manifest.json';
export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff'
] as const;

const FRONTMATTER_BOUNDARY = '---';

export interface ImageDiscoveryOptions {
  rootDir: string;
  sortBy?: F8Config['image']['sortBy'];
  sortDirection?: F8Config['image']['sortDirection'];
}

export interface ParsedSidecar {
  path: string;
  frontmatter: Record<string, unknown>;
  content?: string;
  hash: string;
}

export interface ProcessImageOptions {
  cwd?: string;
  config?: F8Config;
  imageRoot?: string;
  force?: boolean;
}

export interface ProcessImageResult {
  metadata: F8ImageMetadata;
  cacheKey: string;
  cached: boolean;
  metadataPath: string;
  exifPath: string;
}

export interface ProcessImageDirectoryOptions extends ProcessImageOptions {
  imageDir?: string;
}

export interface ProcessImageDirectoryResult {
  images: ProcessImageResult[];
  discovered: string[];
  generated: number;
  cached: number;
  manifestPath: string;
}

export interface F8ImageManifest {
  pipelineVersion: string;
  generatedAt: string;
  imageDir: string;
  cacheDir: string;
  images: F8ImageMetadata[];
}

interface OutputPaths {
  imageOutputRelativeDir: string;
  imageOutputDir: string;
  metadataPath: string;
  exifPath: string;
  cacheRecordPath: string;
  baseName: string;
}

interface CacheRecord {
  cacheKey: string;
  metadataPath: string;
  exifPath: string;
  pipelineVersion: string;
}

interface SharpRawImage {
  data: Buffer;
  info: {
    width: number;
    height: number;
    channels: number;
  };
}

export function discoverImages(options: ImageDiscoveryOptions): string[] {
  if (!existsSync(options.rootDir)) {
    return [];
  }

  const images = walkImages(resolve(options.rootDir));
  return sortDiscoveredImages(
    images,
    options.sortBy ?? 'path',
    options.sortDirection ?? 'asc'
  );
}

export function isSupportedImagePath(filePath: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(
    extname(
      filePath
    ).toLowerCase() as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]
  );
}

export function findSidecarPath(sourcePath: string): string | undefined {
  const extension = extname(sourcePath);
  const withoutExtension = sourcePath.slice(0, -extension.length);
  const candidates = [`${withoutExtension}.md`, `${sourcePath}.md`];
  return candidates.find((candidate) => existsSync(candidate));
}

export function parseSidecar(sourcePath: string): ParsedSidecar | undefined {
  const sidecarPath = findSidecarPath(sourcePath);
  if (sidecarPath === undefined) {
    return undefined;
  }

  const raw = readFileSync(sidecarPath, 'utf8');
  const parsed = parseMarkdownFrontmatter(raw);

  return {
    path: sidecarPath,
    frontmatter: parsed.frontmatter,
    ...(parsed.content.length > 0 ? { content: parsed.content } : {}),
    hash: hashString(raw)
  };
}

export function createImageCacheKey(input: {
  relativePath: string;
  sourceHash: string;
  configHash: string;
  sidecarHash?: string;
  pipelineVersion?: string;
}): string {
  return hashJson({
    relativePath: input.relativePath,
    sourceHash: input.sourceHash,
    configHash: input.configHash,
    sidecarHash: input.sidecarHash ?? null,
    pipelineVersion: input.pipelineVersion ?? PIPELINE_VERSION
  });
}

export async function processImage(
  sourcePath: string,
  options: ProcessImageOptions = {}
): Promise<ProcessImageResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config = options.config ?? f8ConfigSchema.parse({});
  const imageRoot = resolve(cwd, options.imageRoot ?? config.imageDir);
  const absoluteSourcePath = resolve(cwd, sourcePath);
  const nativeRelativePath = relative(imageRoot, absoluteSourcePath);

  if (isOutsidePath(nativeRelativePath)) {
    throw new Error(`${sourcePath} is outside image root ${imageRoot}`);
  }

  const relativePath = toPosixPath(nativeRelativePath);

  const sidecar = parseSidecar(absoluteSourcePath);
  const sourceHash = hashFile(absoluteSourcePath);
  const configHash = hashJson(config.image);
  const cacheKey = createImageCacheKey({
    relativePath,
    sourceHash,
    configHash,
    ...(sidecar?.hash !== undefined ? { sidecarHash: sidecar.hash } : {})
  });
  const outputPaths = getOutputPaths(cwd, config, relativePath);
  const cached = readCachedResult(outputPaths, cacheKey);

  if (cached !== undefined && !options.force) {
    return cached;
  }

  mkdirSync(outputPaths.imageOutputDir, { recursive: true });

  const sourceMetadata = await sharp(absoluteSourcePath, {
    failOn: 'warning'
  }).metadata();
  const { width, height } = normalizedDimensions(sourceMetadata);

  const exifRecord = await parseExifRecord(absoluteSourcePath);
  const exifFromSource = normalizeExif(exifRecord);
  const locationFromSource = normalizeLocation(exifRecord);
  const sidecarOverrides = sidecarToOverrides(sidecar);
  const exif = config.privacy.includeExifMetadata
    ? mergeExif(exifFromSource, sidecarOverrides.exif)
    : {};
  const location = config.privacy.includeGpsMetadata
    ? mergeLocation(locationFromSource, sidecarOverrides.location)
    : {};
  const variants = await generateVariants({
    sourcePath: absoluteSourcePath,
    width,
    height,
    config,
    outputPaths
  });
  const dominantColors = await extractDominantColors(absoluteSourcePath);
  const blurhash = await createBlurhash(absoluteSourcePath);

  const metadata: F8ImageMetadata = {
    id: stableImageId(relativePath),
    sourcePath: absoluteSourcePath,
    relativePath,
    ...(sidecarOverrides.alt !== undefined
      ? { alt: sidecarOverrides.alt }
      : {}),
    ...(sidecarOverrides.title !== undefined
      ? { title: sidecarOverrides.title }
      : {}),
    ...(sidecarOverrides.description !== undefined
      ? { description: sidecarOverrides.description }
      : {}),
    width,
    height,
    aspectRatio: width / height,
    ...(blurhash !== undefined ? { blurhash } : {}),
    dominantColors,
    variants,
    ...(hasExif(exif) ? { exif } : {}),
    ...(hasLocation(location) ? { location } : {}),
    ...(sidecar !== undefined
      ? {
          sidecar: {
            path: sidecar.path,
            ...(sidecar.content !== undefined
              ? { content: sidecar.content }
              : {})
          }
        }
      : {})
  };

  writeJson(outputPaths.metadataPath, metadata);
  writeJson(outputPaths.exifPath, exif);
  writeJson(outputPaths.cacheRecordPath, {
    cacheKey,
    metadataPath: outputPaths.metadataPath,
    exifPath: outputPaths.exifPath,
    pipelineVersion: PIPELINE_VERSION
  } satisfies CacheRecord);

  return {
    metadata,
    cacheKey,
    cached: false,
    metadataPath: outputPaths.metadataPath,
    exifPath: outputPaths.exifPath
  };
}

export async function processImageDirectory(
  options: ProcessImageDirectoryOptions = {}
): Promise<ProcessImageDirectoryResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config = options.config ?? f8ConfigSchema.parse({});
  const imageRoot = resolve(cwd, options.imageDir ?? config.imageDir);
  const discovered = discoverImages({
    rootDir: imageRoot,
    sortBy: config.image.sortBy,
    sortDirection: config.image.sortDirection
  });
  const images: ProcessImageResult[] = [];

  for (const imagePath of discovered) {
    images.push(
      await processImage(imagePath, {
        cwd,
        config,
        imageRoot,
        ...(options.force !== undefined ? { force: options.force } : {})
      })
    );
  }

  const manifestPath = writeImageManifest({ cwd, config, images });

  return {
    images,
    discovered,
    generated: images.filter((imageResult) => !imageResult.cached).length,
    cached: images.filter((imageResult) => imageResult.cached).length,
    manifestPath
  };
}

function writeImageManifest(input: {
  cwd: string;
  config: F8Config;
  images: ProcessImageResult[];
}): string {
  const manifestPath = join(
    input.cwd,
    input.config.cacheDir,
    IMAGE_MANIFEST_FILENAME
  );
  const manifest: F8ImageManifest = {
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    imageDir: input.config.imageDir,
    cacheDir: input.config.cacheDir,
    images: input.images.map((image) => image.metadata)
  };

  writeJson(manifestPath, manifest);
  return manifestPath;
}

function normalizedDimensions(metadata: sharp.Metadata): {
  width: number;
  height: number;
} {
  const width = metadata.width;
  const height = metadata.height;

  if (width === undefined || height === undefined) {
    throw new Error('Unable to read image dimensions.');
  }

  if (
    metadata.orientation !== undefined &&
    [5, 6, 7, 8].includes(metadata.orientation)
  ) {
    return { width: height, height: width };
  }

  return { width, height };
}

function walkImages(rootDir: string): string[] {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const images: string[] = [];

  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      images.push(...walkImages(entryPath));
    } else if (entry.isFile() && isSupportedImagePath(entry.name)) {
      images.push(entryPath);
    }
  }

  return images;
}

function sortDiscoveredImages(
  images: string[],
  sortBy: F8Config['image']['sortBy'],
  sortDirection: F8Config['image']['sortDirection']
): string[] {
  const direction = sortDirection === 'desc' ? -1 : 1;
  const sorted = [...images].sort((left, right) => {
    if (sortBy === 'mtime') {
      return (statSync(left).mtimeMs - statSync(right).mtimeMs) * direction;
    }

    if (sortBy === 'name') {
      return basename(left).localeCompare(basename(right)) * direction;
    }

    return toPosixPath(left).localeCompare(toPosixPath(right)) * direction;
  });

  return sorted;
}

function parseMarkdownFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  if (!raw.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return { frontmatter: {}, content: raw.trim() };
  }

  const closingIndex = raw.indexOf(
    `\n${FRONTMATTER_BOUNDARY}`,
    FRONTMATTER_BOUNDARY.length + 1
  );
  if (closingIndex === -1) {
    return { frontmatter: {}, content: raw.trim() };
  }

  const frontmatter = raw.slice(FRONTMATTER_BOUNDARY.length + 1, closingIndex);
  const content = raw
    .slice(closingIndex + FRONTMATTER_BOUNDARY.length + 2)
    .trim();

  return {
    frontmatter: parseYamlFrontmatter(frontmatter),
    content
  };
}

function parseYamlFrontmatter(source: string): Record<string, unknown> {
  const parsed = parseYaml(source) as unknown;
  return asRecord(parsed);
}

function sidecarToOverrides(sidecar: ParsedSidecar | undefined): {
  alt?: string;
  title?: string;
  description?: string;
  exif?: F8Exif;
  location?: F8Location;
} {
  if (sidecar === undefined) {
    return {};
  }

  const source = sidecar.frontmatter;
  const exifSource = asRecord(source.exif);
  const locationSource = asRecord(source.location);
  const exif: F8Exif = {
    ...stringField(source, 'camera', 'camera'),
    ...stringField(source, 'lens', 'lens'),
    ...stringField(source, 'aperture', 'aperture'),
    ...stringField(source, 'shutter', 'shutter'),
    ...numberField(source, 'iso', 'iso'),
    ...stringField(source, 'focalLength', 'focalLength'),
    ...stringField(source, 'date', 'capturedAt'),
    ...stringField(source, 'capturedAt', 'capturedAt'),
    ...stringField(exifSource, 'camera', 'camera'),
    ...stringField(exifSource, 'lens', 'lens'),
    ...stringField(exifSource, 'aperture', 'aperture'),
    ...stringField(exifSource, 'shutter', 'shutter'),
    ...numberField(exifSource, 'iso', 'iso'),
    ...stringField(exifSource, 'focalLength', 'focalLength'),
    ...stringField(exifSource, 'capturedAt', 'capturedAt')
  };
  const location: F8Location = {
    ...stringField(locationSource, 'label', 'label'),
    ...numberField(locationSource, 'lat', 'lat'),
    ...numberField(locationSource, 'lng', 'lng')
  };

  return {
    ...stringField(source, 'alt', 'alt'),
    ...stringField(source, 'title', 'title'),
    ...stringField(source, 'description', 'description'),
    ...(hasExif(exif) ? { exif } : {}),
    ...(hasLocation(location) ? { location } : {})
  };
}

function normalizeExif(parsed: Record<string, unknown>): F8Exif {
  const camera = [toStringValue(parsed.Make), toStringValue(parsed.Model)]
    .filter((value) => value !== undefined && value.length > 0)
    .join(' ')
    .trim();

  return {
    ...(camera.length > 0 ? { camera } : {}),
    ...stringField(parsed, 'LensModel', 'lens'),
    ...formatAperture(parsed.FNumber),
    ...formatShutter(parsed.ExposureTime),
    ...numberField(parsed, 'ISO', 'iso'),
    ...formatFocalLength(parsed.FocalLength),
    ...formatCapturedAt(parsed.DateTimeOriginal ?? parsed.CreateDate)
  };
}

async function parseExifRecord(
  sourcePath: string
): Promise<Record<string, unknown>> {
  try {
    const parsed = (await exifr.parse(sourcePath)) as unknown;

    return asRecord(parsed);
  } catch {
    return {};
  }
}

function normalizeLocation(parsed: Record<string, unknown>): F8Location {
  return {
    ...numberField(parsed, 'GPSLatitude', 'lat'),
    ...numberField(parsed, 'GPSLongitude', 'lng')
  };
}

function mergeExif(source: F8Exif, overrides: F8Exif | undefined): F8Exif {
  return { ...source, ...(overrides ?? {}) };
}

function mergeLocation(
  source: F8Location,
  overrides: F8Location | undefined
): F8Location {
  return { ...source, ...(overrides ?? {}) };
}

async function generateVariants(input: {
  sourcePath: string;
  width: number;
  height: number;
  config: F8Config;
  outputPaths: OutputPaths;
}): Promise<F8ImageVariant[]> {
  const targetWidths = getTargetWidths(
    input.config.image.widths,
    input.width,
    input.config.image.allowUpscale
  );
  const variants: F8ImageVariant[] = [];

  for (const targetWidth of targetWidths) {
    for (const format of input.config.image.formats) {
      const fileName = variantFileName(
        input.outputPaths.baseName,
        targetWidth,
        format
      );
      const outputPath = join(input.outputPaths.imageOutputDir, fileName);
      const variant = await buildVariant({
        sourcePath: input.sourcePath,
        outputPath,
        sourceWidth: input.width,
        sourceHeight: input.height,
        targetWidth,
        format,
        config: input.config
      });
      variants.push({
        ...variant,
        src: toPosixPath(
          join(
            input.config.cacheDir,
            input.outputPaths.imageOutputRelativeDir,
            fileName
          )
        )
      });
    }
  }

  return variants;
}

function getTargetWidths(
  configuredWidths: number[],
  sourceWidth: number,
  allowUpscale: boolean
): number[] {
  const widths = configuredWidths
    .filter((width) => allowUpscale || width <= sourceWidth)
    .sort((left, right) => left - right);

  if (widths.length > 0) {
    return [...new Set(widths)];
  }

  return [sourceWidth];
}

async function buildVariant(input: {
  sourcePath: string;
  outputPath: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  format: F8ImageFormat;
  config: F8Config;
}): Promise<Omit<F8ImageVariant, 'src'>> {
  const targetHeight = Math.round(
    (input.sourceHeight / input.sourceWidth) * input.targetWidth
  );
  const kernel = interpolationToKernel(input.config.image.interpolation);
  let transformer = sharp(input.sourcePath, { failOn: 'warning' }).rotate();

  if (input.config.image.linearResize) {
    transformer = transformer.gamma();
  }

  transformer = transformer.resize({
    width: input.targetWidth,
    withoutEnlargement: !input.config.image.allowUpscale,
    kernel
  });

  if (input.config.image.linearResize) {
    transformer = transformer.gamma();
  }

  if (!input.config.privacy.stripOutputMetadata) {
    transformer = transformer.withMetadata();
  }

  transformer = applyFormat(
    transformer,
    input.format,
    input.config.image.quality[input.format]
  );
  await transformer.toFile(input.outputPath);

  return {
    width: input.targetWidth,
    height: targetHeight,
    format: input.format,
    sizeBytes: statSync(input.outputPath).size
  };
}

function interpolationToKernel(
  interpolation: F8Config['image']['interpolation']
): keyof sharp.KernelEnum {
  if (interpolation === 'mks') {
    return 'mks2021';
  }

  return interpolation;
}

function applyFormat(
  transformer: sharp.Sharp,
  format: F8ImageFormat,
  quality: number
): sharp.Sharp {
  if (format === 'avif') {
    return transformer.avif({ quality });
  }

  if (format === 'webp') {
    return transformer.webp({ quality });
  }

  if (format === 'png') {
    return transformer.png({ quality });
  }

  return transformer.jpeg({ quality, mozjpeg: true });
}

async function createBlurhash(sourcePath: string): Promise<string | undefined> {
  try {
    const raw = await readSmallRawImage(sourcePath, 32, true);
    return encodeBlurhash(
      new Uint8ClampedArray(raw.data),
      raw.info.width,
      raw.info.height,
      4,
      3
    );
  } catch {
    return undefined;
  }
}

async function extractDominantColors(sourcePath: string): Promise<string[]> {
  try {
    const raw = await readSmallRawImage(sourcePath, 64, false);
    const buckets = new Map<string, number>();
    const channels = raw.info.channels;

    for (let index = 0; index < raw.data.length; index += channels) {
      const color = rgbToHex(
        quantize(raw.data[index] ?? 0),
        quantize(raw.data[index + 1] ?? 0),
        quantize(raw.data[index + 2] ?? 0)
      );
      buckets.set(color, (buckets.get(color) ?? 0) + 1);
    }

    return [...buckets.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([color]) => color);
  } catch {
    return [];
  }
}

async function readSmallRawImage(
  sourcePath: string,
  size: number,
  alpha: boolean
): Promise<SharpRawImage> {
  const transformer = sharp(sourcePath, { failOn: 'warning' })
    .rotate()
    .resize({
      width: size,
      height: size,
      fit: 'inside',
      withoutEnlargement: true
    })
    .toColorspace('srgb');
  const rawTransformer = alpha
    ? transformer.ensureAlpha()
    : transformer.removeAlpha();
  const { data, info } = await rawTransformer
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, info };
}

function getOutputPaths(
  cwd: string,
  config: F8Config,
  relativePath: string
): OutputPaths {
  const parsed = path.posix.parse(relativePath);
  const baseName = parsed.name;
  const imageOutputRelativeDir = path.posix.join(parsed.dir, baseName);
  const imageOutputDir = join(cwd, config.cacheDir, imageOutputRelativeDir);

  return {
    imageOutputRelativeDir,
    imageOutputDir,
    metadataPath: join(imageOutputDir, `${baseName}.metadata.json`),
    exifPath: join(imageOutputDir, `${baseName}.exif.json`),
    cacheRecordPath: join(imageOutputDir, `${baseName}.cache.json`),
    baseName
  };
}

function readCachedResult(
  outputPaths: OutputPaths,
  cacheKey: string
): ProcessImageResult | undefined {
  if (
    !existsSync(outputPaths.cacheRecordPath) ||
    !existsSync(outputPaths.metadataPath)
  ) {
    return undefined;
  }

  const record = readJson<CacheRecord>(outputPaths.cacheRecordPath);
  if (record.cacheKey !== cacheKey || !existsSync(outputPaths.exifPath)) {
    return undefined;
  }

  const metadata = readJson<F8ImageMetadata>(outputPaths.metadataPath);
  if (
    !metadata.variants.every((variant) => variantExists(outputPaths, variant))
  ) {
    return undefined;
  }

  return {
    metadata,
    cacheKey,
    cached: true,
    metadataPath: outputPaths.metadataPath,
    exifPath: outputPaths.exifPath
  };
}

function variantExists(
  outputPaths: OutputPaths,
  variant: F8ImageVariant
): boolean {
  const variantPath = join(outputPaths.imageOutputDir, basename(variant.src));
  return (
    existsSync(variantPath) && statSync(variantPath).size === variant.sizeBytes
  );
}

function variantFileName(
  baseName: string,
  width: number,
  format: F8ImageFormat
): string {
  return `${baseName}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
}

function stableImageId(relativePath: string): string {
  return hashString(relativePath).slice(0, 16);
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashJson(value: unknown): string {
  return hashString(JSON.stringify(stableJson(value)));
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableJson(entry));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJson(entry)])
    );
  }

  return value;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

function isOutsidePath(relativePath: string): boolean {
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField<T extends string>(
  source: Record<string, unknown>,
  key: string,
  target: T
): Partial<Record<T, string>> {
  const value = toStringValue(source[key]);
  return value !== undefined
    ? ({ [target]: value } as Partial<Record<T, string>>)
    : {};
}

function numberField<T extends string>(
  source: Record<string, unknown>,
  key: string,
  target: T
): Partial<Record<T, number>> {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { [target]: value } as Partial<Record<T, number>>;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return { [target]: numeric } as Partial<Record<T, number>>;
    }
  }

  return {};
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || value instanceof Date) {
    return String(value);
  }

  return undefined;
}

function formatAperture(value: unknown): Partial<F8Exif> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { aperture: `f/${trimNumber(value)}` };
  }

  return stringField({ value }, 'value', 'aperture');
}

function formatShutter(value: unknown): Partial<F8Exif> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0 && value < 1) {
      return { shutter: `1/${Math.round(1 / value)}` };
    }

    return { shutter: `${trimNumber(value)}s` };
  }

  return stringField({ value }, 'value', 'shutter');
}

function formatFocalLength(value: unknown): Partial<F8Exif> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { focalLength: `${trimNumber(value)}mm` };
  }

  return stringField({ value }, 'value', 'focalLength');
}

function formatCapturedAt(value: unknown): Partial<F8Exif> {
  if (value instanceof Date) {
    return { capturedAt: value.toISOString() };
  }

  return stringField({ value }, 'value', 'capturedAt');
}

function trimNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function hasExif(exif: F8Exif): boolean {
  return Object.values(exif).some((value) => value !== undefined);
}

function hasLocation(location: F8Location): boolean {
  return Object.values(location).some((value) => value !== undefined);
}

function quantize(value: number): number {
  return Math.min(255, Math.round(value / 16) * 16);
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

function hex(value: number): string {
  return value.toString(16).padStart(2, '0');
}
