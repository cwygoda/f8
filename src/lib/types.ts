export type F8ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png';

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

export interface F8ImageMetadata {
  id: string;
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
  sidecar?: {
    path: string;
    content?: string;
  };
}
