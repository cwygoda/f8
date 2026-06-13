# Security and privacy defaults

- Generated image variants strip embedded metadata by default (`privacy.stripOutputMetadata = true`).
- GPS metadata is not included in generated manifests unless explicitly enabled with `privacy.includeGpsMetadata = true` or `F8_INCLUDE_GPS_METADATA=true`.
- EXIF display metadata can be hidden with `privacy.includeExifMetadata = false` or `F8_INCLUDE_EXIF_METADATA=false`.
- Static Markdown rendering sanitizes unsafe URL protocols by default (`security.sanitizeMarkdown = true`).
- Static pages do not emit unresolved original image sources by default. Set `security.allowUnprocessedImages = true` only for trusted workflows where original files are intentionally public.
- `f8 index` validates input paths, refuses incomplete generated-block markers, and writes a `.bak` file before changing existing Markdown unless `--no-backup` is passed.
