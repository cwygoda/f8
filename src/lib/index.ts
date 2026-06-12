export { loadConfig, f8ConfigSchema } from './config/index.js';
export {
  createImageMetadataIndex,
  createImageResolver,
  f8RemarkImages,
  parseMarkdownBlocks,
  renderFigure,
  renderGallery,
  renderMarkdown,
  renderMarkdownBlock,
  renderMarkdownToHtml,
  renderResponsiveImage
} from './markdown/index.js';
export type {
  F8MarkdownBlock,
  F8MarkdownImageBlock,
  F8MarkdownImageNode,
  F8MarkdownProseBlock,
  F8MarkdownRenderOptions,
  F8MarkdownRenderResult
} from './markdown/index.js';
export type {
  F8Config,
  F8GalleryConfig,
  F8ImageConfig,
  F8ViewerConfig
} from './config/index.js';
export type {
  F8Exif,
  F8ImageFormat,
  F8ImageMetadata,
  F8ImageVariant,
  F8Location
} from './types.js';
