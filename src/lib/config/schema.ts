import { z } from 'zod';

export const DEFAULT_IMAGE_WIDTHS = [480, 768, 1024, 1440, 1920, 2560] as const;
export const DEFAULT_IMAGE_FORMATS = ['avif', 'webp', 'jpeg'] as const;

export const f8ImageFormatSchema = z.enum(['avif', 'webp', 'jpeg', 'png']);

export const f8ImageConfigSchema = z
  .object({
    widths: z
      .array(z.number().int().positive())
      .min(1)
      .default([...DEFAULT_IMAGE_WIDTHS]),
    formats: z
      .array(f8ImageFormatSchema)
      .min(1)
      .default([...DEFAULT_IMAGE_FORMATS]),
    sortBy: z.enum(['path', 'name', 'mtime']).default('path'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
    allowUpscale: z.boolean().default(false),
    linearResize: z.boolean().default(true),
    interpolation: z
      .enum(['mks', 'lanczos3', 'cubic', 'nearest'])
      .default('mks'),
    quality: z
      .object({
        avif: z.number().int().min(1).max(100).default(72),
        webp: z.number().int().min(1).max(100).default(82),
        jpeg: z.number().int().min(1).max(100).default(88),
        png: z.number().int().min(1).max(100).default(90)
      })
      .prefault({})
  })
  .prefault({});

export const f8GalleryConfigSchema = z
  .object({
    layout: z.enum(['masonry']).default('masonry'),
    gap: z.string().min(1).default('clamp(0.75rem, 2vw, 1.5rem)'),
    maxColumns: z.number().int().min(1).max(8).default(4)
  })
  .prefault({});

export const f8ViewerConfigSchema = z
  .object({
    enableMap: z.boolean().default(true),
    enableExifOverlay: z.boolean().default(true)
  })
  .prefault({});

export const f8PrivacyConfigSchema = z
  .object({
    includeGpsMetadata: z.boolean().default(false),
    includeExifMetadata: z.boolean().default(true),
    stripOutputMetadata: z.boolean().default(true)
  })
  .prefault({});

export const f8SecurityConfigSchema = z
  .object({
    allowUnprocessedImages: z.boolean().default(false),
    sanitizeMarkdown: z.boolean().default(true)
  })
  .prefault({});

export const f8SiteConfigSchema = z
  .object({
    title: z.string().min(1).default('f8'),
    description: z
      .string()
      .min(1)
      .default('Image-first publishing for SvelteKit.'),
    url: z.string().url().optional(),
    lang: z.string().min(1).default('en')
  })
  .prefault({});

export const f8ConfigSchema = z
  .object({
    contentDir: z.string().min(1).default('content'),
    imageDir: z.string().min(1).default('images'),
    outputDir: z.string().min(1).default('.f8'),
    cacheDir: z.string().min(1).default('.f8/cache'),
    site: f8SiteConfigSchema,
    image: f8ImageConfigSchema,
    gallery: f8GalleryConfigSchema,
    viewer: f8ViewerConfigSchema,
    privacy: f8PrivacyConfigSchema,
    security: f8SecurityConfigSchema
  })
  .strict()
  .superRefine((config, context) => {
    for (const [key, value] of Object.entries({
      contentDir: config.contentDir,
      imageDir: config.imageDir,
      outputDir: config.outputDir,
      cacheDir: config.cacheDir
    })) {
      if (value.includes('\0')) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'must not contain null bytes'
        });
      }
    }

    if (new Set(config.image.widths).size !== config.image.widths.length) {
      context.addIssue({
        code: 'custom',
        path: ['image', 'widths'],
        message: 'must not contain duplicate widths'
      });
    }
  });

export type F8Config = z.infer<typeof f8ConfigSchema>;
export type F8ImageConfig = z.infer<typeof f8ImageConfigSchema>;
export type F8GalleryConfig = z.infer<typeof f8GalleryConfigSchema>;
export type F8ViewerConfig = z.infer<typeof f8ViewerConfigSchema>;
export type F8PrivacyConfig = z.infer<typeof f8PrivacyConfigSchema>;
export type F8SecurityConfig = z.infer<typeof f8SecurityConfigSchema>;
export type F8SiteConfig = z.infer<typeof f8SiteConfigSchema>;
