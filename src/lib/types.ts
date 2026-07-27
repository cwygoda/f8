export const F8_CAPTION_ALIGNS = ['left', 'center', 'right'] as const;

export type F8CaptionAlign = (typeof F8_CAPTION_ALIGNS)[number];
export type F8ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png';

export function isF8CaptionAlign(value: unknown): value is F8CaptionAlign {
  return (
    typeof value === 'string' &&
    (F8_CAPTION_ALIGNS as readonly string[]).includes(value)
  );
}

export interface F8ImageVariant {
  width: number;
  height: number;
  format: F8ImageFormat;
  src: string;
  sizeBytes: number;
}

export interface F8Exif {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
  capturedAt?: string;
}

export interface F8Location {
  label?: string;
  lat?: number;
  lng?: number;
}

export interface F8ImageViewerOptions {
  showCaption?: boolean;
  captionAlign?: F8CaptionAlign;
}

export interface F8ImageMetadata {
  id: string;
  cacheKey?: string;
  sourcePath: string;
  relativePath: string;
  alt?: string;
  title?: string;
  description?: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurhash?: string;
  dominantColors: string[];
  variants: F8ImageVariant[];
  exif?: F8Exif;
  location?: F8Location;
  viewer?: F8ImageViewerOptions;
  sidecar?: {
    path: string;
    content?: string;
  };
}
