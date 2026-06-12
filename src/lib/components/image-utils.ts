import type {
  F8ImageFormat,
  F8ImageMetadata,
  F8ImageVariant
} from '../types.js';

export const DEFAULT_IMAGE_SIZES = '(min-width: 72rem) 72rem, 100vw';

export interface F8SourceSet {
  format: F8ImageFormat;
  type: string;
  srcset: string;
}

export function imageAlt(image: F8ImageMetadata, override?: string): string {
  return (
    firstNonEmpty(override, image.alt, image.title, image.description) ?? ''
  );
}

export function imageCaption(image: F8ImageMetadata): {
  title?: string;
  description?: string;
} {
  const title = firstNonEmpty(image.title);
  const description = firstNonEmpty(image.description, image.sidecar?.content);

  return {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description })
  };
}

export function placeholderColor(image: F8ImageMetadata): string | undefined {
  return image.dominantColors[0];
}

export function sourceSets(variants: F8ImageVariant[]): F8SourceSet[] {
  const byFormat = new Map<F8ImageFormat, F8ImageVariant[]>();

  for (const variant of variants) {
    byFormat.set(variant.format, [
      ...(byFormat.get(variant.format) ?? []),
      variant
    ]);
  }

  return [...byFormat.entries()].map(([format, formatVariants]) => ({
    format,
    type: mimeType(format),
    srcset: formatVariants
      .toSorted((left, right) => left.width - right.width)
      .map((variant) => `${variant.src} ${variant.width}w`)
      .join(', ')
  }));
}

export function fallbackVariant(
  image: F8ImageMetadata
): F8ImageVariant | undefined {
  const variants = image.variants.toSorted(
    (left, right) => left.width - right.width
  );

  return (
    variants.find((variant) => variant.format === 'jpeg') ??
    variants.find((variant) => variant.format === 'webp') ??
    variants[0]
  );
}

export function largestVariant(
  image: F8ImageMetadata
): F8ImageVariant | undefined {
  return image.variants.toSorted((left, right) => right.width - left.width)[0];
}

export function aspectRatioStyle(image: F8ImageMetadata): string {
  const ratio =
    image.aspectRatio > 0 ? image.aspectRatio : image.width / image.height;
  return `${ratio}`;
}

export function hasLocation(image: F8ImageMetadata): boolean {
  return (
    typeof image.location?.lat === 'number' &&
    typeof image.location.lng === 'number'
  );
}

function mimeType(format: F8ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}
