export const ARTICLE_IMAGE_BUCKET = 'article-images';

export const ARTICLE_IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp';

export const ARTICLE_IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const ARTICLE_IMAGE_UPLOAD_MAX_MB = ARTICLE_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);

export const ARTICLE_IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ArticleImageContentType = (typeof ARTICLE_IMAGE_ALLOWED_TYPES)[number];
