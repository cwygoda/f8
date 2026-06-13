import path from 'node:path';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type Plugin } from 'unified';
import type {
  Element as HastElement,
  ElementContent as HastElementContent,
  Properties as HastProperties,
  Root as HastRoot,
  RootContent as HastRootContent
} from 'hast';
import type {
  Content as MdastContent,
  Image as MdastImage,
  Paragraph as MdastParagraph,
  Parent as MdastParent,
  Root as MdastRoot
} from 'mdast';

import type {
  F8ImageFormat,
  F8ImageMetadata,
  F8ImageVariant
} from '../types.js';

export type F8MarkdownBlock = F8MarkdownProseBlock | F8MarkdownImageBlock;

export interface F8MarkdownProseBlock {
  type: 'prose';
  markdown: string;
}

export interface F8MarkdownImageBlock {
  type: 'images';
  kind: 'figure' | 'gallery';
  images: F8MarkdownImageNode[];
}

export interface F8MarkdownImageNode {
  alt: string;
  src: string;
  title?: string;
  metadata?: F8ImageMetadata;
}

export interface F8MarkdownRenderOptions {
  images?: F8ImageMetadata[] | Record<string, F8ImageMetadata>;
  resolveImage?: (src: string) => F8ImageMetadata | undefined;
  imageBasePaths?: string[];
  imageSizes?: string;
  allowUnprocessedImages?: boolean;
  sanitize?: boolean;
}

export interface F8MarkdownRenderResult {
  html: string;
  blocks: F8MarkdownBlock[];
  images: F8MarkdownImageNode[];
}

const DEFAULT_IMAGE_BASE_PATHS = ['images'];
const DEFAULT_IMAGE_SIZES = '(min-width: 72rem) 72rem, 100vw';

export function renderMarkdown(
  markdown: string,
  options: F8MarkdownRenderOptions = {}
): F8MarkdownRenderResult {
  const blocks = parseMarkdownBlocks(markdown, options);
  const file = unified()
    .use(remarkParse)
    .use(f8RemarkImages, options)
    .use(remarkRehype)
    .use(options.sanitize === false ? identityRehypePlugin : f8RehypeSanitize)
    .use(rehypeStringify)
    .processSync(markdown);

  return {
    html: String(file),
    blocks,
    images: blocks.flatMap((block) =>
      block.type === 'images' ? block.images : []
    )
  };
}

export function renderMarkdownToHtml(
  markdown: string,
  options: F8MarkdownRenderOptions = {}
): string {
  return renderMarkdown(markdown, options).html;
}

export function parseMarkdownBlocks(
  markdown: string,
  options: F8MarkdownRenderOptions = {}
): F8MarkdownBlock[] {
  const tree = unified().use(remarkParse).parse(markdown) as MdastRoot;
  const resolver = createImageResolver(options);

  return tree.children.map((node): F8MarkdownBlock => {
    const imageNodes = isParagraph(node)
      ? parseImageParagraph(node, resolver)
      : undefined;

    if (imageNodes !== undefined) {
      return {
        type: 'images',
        kind: imageNodes.length > 1 ? 'gallery' : 'figure',
        images: imageNodes
      };
    }

    return { type: 'prose', markdown: sourceForNode(markdown, node) };
  });
}

export function createImageResolver(
  options: F8MarkdownRenderOptions = {}
): (src: string) => F8ImageMetadata | undefined {
  const metadataIndex = createImageMetadataIndex(
    options.images,
    options.imageBasePaths === undefined
      ? {}
      : { imageBasePaths: options.imageBasePaths }
  );

  return (src: string): F8ImageMetadata | undefined => {
    const resolved = options.resolveImage?.(src);
    if (resolved !== undefined) {
      return resolved;
    }

    for (const candidate of imageLookupCandidates(
      src,
      options.imageBasePaths
    )) {
      const metadata = metadataIndex.get(candidate);
      if (metadata !== undefined) {
        return metadata;
      }
    }

    return undefined;
  };
}

export function createImageMetadataIndex(
  images: F8MarkdownRenderOptions['images'],
  options: { imageBasePaths?: string[] } = {}
): Map<string, F8ImageMetadata> {
  const index = new Map<string, F8ImageMetadata>();
  const add = (key: string, metadata: F8ImageMetadata): void => {
    for (const candidate of imageLookupCandidates(
      key,
      options.imageBasePaths
    )) {
      index.set(candidate, metadata);
    }
  };

  if (Array.isArray(images)) {
    for (const metadata of images) {
      add(metadata.relativePath, metadata);
      add(metadata.sourcePath, metadata);
      for (const basePath of normalizedBasePaths(options.imageBasePaths)) {
        add(`${basePath}/${metadata.relativePath}`, metadata);
      }
    }
  } else if (images !== undefined) {
    for (const [key, metadata] of Object.entries(images)) {
      add(key, metadata);
    }
  }

  return index;
}

export function renderMarkdownBlock(
  block: F8MarkdownBlock,
  options: F8MarkdownRenderOptions = {}
): string {
  if (block.type === 'images') {
    return block.kind === 'gallery'
      ? renderGallery(block.images, options)
      : renderFigure(block.images[0], options);
  }

  return renderMarkdownToHtml(block.markdown, options);
}

export function renderFigure(
  image: F8MarkdownImageNode | undefined,
  options: F8MarkdownRenderOptions = {}
): string {
  return image === undefined
    ? ''
    : stringifyHast([figureElement(image, options)]);
}

export function renderGallery(
  images: F8MarkdownImageNode[],
  options: F8MarkdownRenderOptions = {}
): string {
  return stringifyHast([galleryElement(images, options)]);
}

export function renderResponsiveImage(
  image: F8MarkdownImageNode,
  options: F8MarkdownRenderOptions = {}
): string {
  return stringifyHast([responsiveImageElement(image, options)]);
}

export const f8RemarkImages: Plugin<[F8MarkdownRenderOptions?], MdastRoot> =
  (options = {}) =>
  (tree) => {
    const resolver = createImageResolver(options);
    transformImageParagraphs(tree, resolver, options);
  };

export const f8RehypeSanitize: Plugin<[], HastRoot> = () => (tree) => {
  sanitizeChildren(tree.children);
};

const identityRehypePlugin: Plugin<[], HastRoot> = () => () => undefined;

function transformImageParagraphs(
  parent: MdastParent,
  resolveImage: (src: string) => F8ImageMetadata | undefined,
  options: F8MarkdownRenderOptions
): void {
  for (const child of parent.children) {
    if (isParent(child)) {
      transformImageParagraphs(child, resolveImage, options);
    }

    if (!isParagraph(child)) {
      continue;
    }

    const images = parseImageParagraph(child, resolveImage);
    if (images === undefined) {
      continue;
    }

    const element =
      images.length > 1
        ? galleryElement(images, options)
        : figureElement(images[0], options);

    child.data = {
      ...child.data,
      hName: element.tagName,
      hProperties: element.properties,
      hChildren: element.children
    };
    child.children = [];
  }
}

function parseImageParagraph(
  paragraph: MdastParagraph,
  resolveImage: (src: string) => F8ImageMetadata | undefined
): F8MarkdownImageNode[] | undefined {
  const images: F8MarkdownImageNode[] = [];

  for (const child of paragraph.children) {
    if (child.type === 'image') {
      images.push(markdownImageToNode(child, resolveImage));
    } else if (!isWhitespaceText(child)) {
      return undefined;
    }
  }

  return images.length > 0 ? images : undefined;
}

function markdownImageToNode(
  image: MdastImage,
  resolveImage: (src: string) => F8ImageMetadata | undefined
): F8MarkdownImageNode {
  const metadata = resolveImage(image.url);

  return {
    alt: image.alt ?? '',
    src: image.url,
    ...(image.title !== null && image.title !== undefined
      ? { title: image.title }
      : {}),
    ...(metadata !== undefined ? { metadata } : {})
  };
}

function figureElement(
  image: F8MarkdownImageNode | undefined,
  options: F8MarkdownRenderOptions
): HastElement {
  if (image === undefined) {
    return element('figure', { className: ['f8-figure'] });
  }

  const children: HastElementContent[] = [imageLinkElement(image, options)];
  const caption = captionElement(imageCaption(image), 'f8-figure__caption');
  if (caption !== undefined) {
    children.push(caption);
  }

  return element(
    'figure',
    {
      className: ['f8-figure'],
      'data-f8-block': 'figure',
      ...imageIdProperties(image.metadata)
    },
    children
  );
}

function galleryElement(
  images: F8MarkdownImageNode[],
  options: F8MarkdownRenderOptions
): HastElement {
  return element(
    'section',
    {
      className: ['f8-gallery'],
      'data-f8-block': 'gallery',
      role: 'group',
      ariaLabel: `Image gallery with ${images.length} images`
    },
    [
      element(
        'div',
        { className: ['f8-gallery__grid'], role: 'list' },
        images.map((image) => galleryItemElement(image, options))
      )
    ]
  );
}

function galleryItemElement(
  image: F8MarkdownImageNode,
  options: F8MarkdownRenderOptions
): HastElement {
  const children: HastElementContent[] = [imageLinkElement(image, options)];
  const caption = captionElement(imageCaption(image), 'f8-gallery__caption');
  if (caption !== undefined) {
    children.push(caption);
  }

  return element(
    'figure',
    {
      className: ['f8-gallery__item'],
      role: 'listitem',
      ...imageIdProperties(image.metadata)
    },
    children
  );
}

function imageLinkElement(
  image: F8MarkdownImageNode,
  options: F8MarkdownRenderOptions
): HastElement {
  if (image.metadata === undefined && options.allowUnprocessedImages !== true) {
    return responsiveImageElement(image, options);
  }

  const href = safeUrl(largestVariant(image.metadata)?.src ?? image.src) ?? '#';
  const label = imageLabel(image);
  const ariaLabel = label.length > 0 ? `Open image: ${label}` : 'Open image';

  return element(
    'a',
    {
      className: ['f8-image__trigger'],
      href,
      'data-f8-viewer-trigger': '',
      ...imageIdProperties(image.metadata),
      ariaLabel
    },
    [responsiveImageElement(image, options)]
  );
}

function responsiveImageElement(
  image: F8MarkdownImageNode,
  options: F8MarkdownRenderOptions = {}
): HastElement {
  const metadata = image.metadata;
  const alt = imageAlt(image);

  if (metadata === undefined || metadata.variants.length === 0) {
    if (options.allowUnprocessedImages !== true) {
      return element(
        'span',
        {
          className: ['f8-image', 'f8-image--unprocessed'],
          role: 'img',
          ariaLabel: alt.length > 0 ? alt : 'Image unavailable'
        },
        [text(alt.length > 0 ? alt : 'Image unavailable')]
      );
    }

    return element('img', {
      src: safeUrl(image.src) ?? '',
      alt,
      loading: 'lazy',
      decoding: 'async'
    });
  }

  const dominantColor = metadata.dominantColors[0];
  const properties: HastProperties = {
    className: ['f8-image'],
    ...(dominantColor === undefined
      ? {}
      : { style: `background-color: ${dominantColor}` })
  };

  return element('picture', properties, [
    ...sourceElements(metadata.variants, options.imageSizes),
    element('img', {
      src: preferredFallbackVariant(metadata.variants).src,
      alt,
      width: metadata.width,
      height: metadata.height,
      loading: 'lazy',
      decoding: 'async',
      'data-f8-image-id': metadata.id
    })
  ]);
}

function sourceElements(
  variants: F8ImageVariant[],
  imageSizes?: string
): HastElement[] {
  const sizes = imageSizes ?? DEFAULT_IMAGE_SIZES;
  const variantsByFormat = new Map<F8ImageFormat, F8ImageVariant[]>();

  for (const variant of variants) {
    const existing = variantsByFormat.get(variant.format) ?? [];
    existing.push(variant);
    variantsByFormat.set(variant.format, existing);
  }

  return [...variantsByFormat.entries()].map(([format, formatVariants]) => {
    const srcSet = formatVariants
      .toSorted((left, right) => left.width - right.width)
      .map((variant) => `${variant.src} ${variant.width}w`)
      .join(', ');

    return element('source', {
      type: mimeType(format),
      srcSet,
      sizes
    });
  });
}

function captionElement(
  caption: { title?: string; description?: string },
  className: string
): HastElement | undefined {
  const children: HastElementContent[] = [];

  if (caption.title !== undefined) {
    children.push(
      element('strong', { className: [`${className}-title`] }, [
        text(caption.title)
      ])
    );
  }

  if (caption.description !== undefined) {
    if (children.length > 0) {
      children.push(text(' '));
    }

    children.push(
      element('span', { className: [`${className}-description`] }, [
        text(caption.description)
      ])
    );
  }

  return children.length > 0
    ? element('figcaption', { className: [className] }, children)
    : undefined;
}

function imageAlt(image: F8MarkdownImageNode): string {
  return (
    firstNonEmpty(image.alt, image.metadata?.alt, image.metadata?.title) ?? ''
  );
}

function imageLabel(image: F8MarkdownImageNode): string {
  return (
    firstNonEmpty(
      image.metadata?.title,
      image.title,
      image.metadata?.description,
      image.alt,
      image.metadata?.alt
    ) ?? ''
  );
}

function imageCaption(image: F8MarkdownImageNode): {
  title?: string;
  description?: string;
} {
  const title = firstNonEmpty(image.metadata?.title, image.title);
  const description = firstNonEmpty(
    image.metadata?.description,
    image.metadata?.sidecar?.content
  );

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {})
  };
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}

function preferredFallbackVariant(variants: F8ImageVariant[]): F8ImageVariant {
  const sorted = variants.toSorted((left, right) => left.width - right.width);
  return (sorted.find((variant) => variant.format === 'jpeg') ??
    sorted.find((variant) => variant.format === 'webp') ??
    sorted[0]) as F8ImageVariant;
}

function largestVariant(
  metadata: F8ImageMetadata | undefined
): F8ImageVariant | undefined {
  return metadata?.variants.toSorted(
    (left, right) => right.width - left.width
  )[0];
}

function mimeType(format: F8ImageFormat): string {
  if (format === 'jpeg') {
    return 'image/jpeg';
  }

  return `image/${format}`;
}

function imageIdProperties(
  metadata: F8ImageMetadata | undefined
): HastProperties {
  return metadata === undefined ? {} : { 'data-f8-image-id': metadata.id };
}

function element(
  tagName: string,
  properties: HastProperties = {},
  children: HastElementContent[] = []
): HastElement {
  return { type: 'element', tagName, properties, children };
}

function text(value: string): HastElementContent {
  return { type: 'text', value };
}

function stringifyHast(children: HastElementContent[]): string {
  const tree: HastRoot = { type: 'root', children };
  return unified().use(rehypeStringify).stringify(tree);
}

function sanitizeChildren(children: HastRootContent[]): void {
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];

    if (child?.type !== 'element') {
      continue;
    }

    if (isUnsafeElement(child.tagName)) {
      children.splice(index, 1);
      continue;
    }

    sanitizeElement(child);
    sanitizeChildren(child.children as HastRootContent[]);
  }
}

function sanitizeElement(node: HastElement): void {
  const properties: HastProperties = {};

  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (/^on/i.test(key)) {
      continue;
    }

    if (isUrlProperty(key)) {
      const sanitized =
        key.toLowerCase() === 'srcset' ? safeSrcSet(value) : safeUrl(value);
      if (sanitized !== undefined) {
        properties[key] = sanitized;
      }
      continue;
    }

    if (key === 'style' && typeof value !== 'string') {
      continue;
    }

    properties[key] = value;
  }

  node.properties = properties;
}

function isUnsafeElement(tagName: string): boolean {
  return new Set([
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'link',
    'meta'
  ]).has(tagName.toLowerCase());
}

function isUrlProperty(key: string): boolean {
  return new Set([
    'href',
    'src',
    'srcset',
    'srcSet',
    'poster',
    'xlinkHref'
  ]).has(key);
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (/^(#|\/|\.\/|\.\.\/)/.test(trimmed)) {
    return trimmed;
  }

  if (!/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : undefined;
}

function safeSrcSet(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [url, ...descriptors] = entry.split(/\s+/);
      const safe = safeUrl(url);
      return safe === undefined ? undefined : [safe, ...descriptors].join(' ');
    })
    .filter((entry): entry is string => entry !== undefined);

  return entries.length > 0 ? entries.join(', ') : undefined;
}

function isParagraph(node: MdastContent): node is MdastParagraph {
  return node.type === 'paragraph';
}

function isParent(node: MdastContent): node is MdastContent & MdastParent {
  return 'children' in node && Array.isArray(node.children);
}

function isWhitespaceText(node: MdastContent): boolean {
  return (
    (node.type === 'text' && /^\s*$/.test(node.value)) || node.type === 'break'
  );
}

function sourceForNode(markdown: string, node: MdastContent): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  return typeof start === 'number' && typeof end === 'number'
    ? markdown.slice(start, end)
    : '';
}

function imageLookupCandidates(
  src: string,
  imageBasePaths?: string[]
): string[] {
  const normalized = normalizeLookupPath(src);
  const candidates = new Set<string>([normalized]);

  for (const basePath of normalizedBasePaths(imageBasePaths)) {
    if (normalized.startsWith(`${basePath}/`)) {
      candidates.add(normalized.slice(basePath.length + 1));
    } else {
      candidates.add(`${basePath}/${normalized}`);
    }
  }

  return [...candidates].filter((candidate) => candidate.length > 0);
}

function normalizedBasePaths(imageBasePaths?: string[]): string[] {
  return (imageBasePaths ?? DEFAULT_IMAGE_BASE_PATHS)
    .map((basePath) => normalizeLookupPath(basePath))
    .filter((basePath) => basePath.length > 0);
}

function normalizeLookupPath(src: string): string {
  const withoutHash = src.split('#')[0] ?? src;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  const normalized = withoutQuery
    .replace(/^file:\/\//, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');

  return path.posix.normalize(normalized.split(path.sep).join(path.posix.sep));
}
