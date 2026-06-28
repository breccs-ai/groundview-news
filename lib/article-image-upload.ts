import {
  ARTICLE_IMAGE_UPLOAD_ACCEPT,
  ARTICLE_IMAGE_UPLOAD_MAX_BYTES,
  ARTICLE_IMAGE_UPLOAD_MAX_MB,
} from '@/lib/article-image-constraints';
import { generateSlug } from '@/lib/slug';

export type ArticleImageUploadResult = {
  urls: string[];
  slotUrls: Array<string | null>;
  hadFailure: boolean;
};

export function validateArticleImage(file: File): string | null {
  if (!ARTICLE_IMAGE_UPLOAD_ACCEPT.split(',').includes(file.type)) {
    return 'Use JPEG, PNG, or WebP only.';
  }
  if (file.size > ARTICLE_IMAGE_UPLOAD_MAX_BYTES) {
    return `Image must be ${ARTICLE_IMAGE_UPLOAD_MAX_MB}MB or smaller.`;
  }
  return null;
}

export async function uploadArticleImages(options: {
  title: string;
  files: Array<File | null>;
  existingUrls: Array<string | null>;
  authorization?: string;
}): Promise<ArticleImageUploadResult> {
  const { title, files, existingUrls, authorization } = options;
  const slug = generateSlug(title) || 'article';
  const resolved: Array<string | null> = existingUrls.slice(0, 3);
  let hadFailure = false;

  while (resolved.length < 3) resolved.push(null);

  for (let index = 0; index < 3; index += 1) {
    const file = files[index];
    if (!file) continue;

    const validationError = validateArticleImage(file);
    if (validationError) {
      console.error(`[article-images] Image ${index + 1}: ${validationError}`);
      hadFailure = true;
      continue;
    }

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('slug', slug);
      body.append('index', String(index + 1));

      const response = await fetch('/api/articles/upload-image', {
        method: 'POST',
        ...(authorization
          ? { headers: { Authorization: `Bearer ${authorization}` } }
          : { credentials: 'include' as const }),
        body,
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || typeof json.imageUrl !== 'string') {
        console.error(
          `[article-images] Image ${index + 1} upload failed:`,
          json.error || response.status
        );
        hadFailure = true;
        continue;
      }

      resolved[index] = json.imageUrl;
    } catch (error) {
      console.error(`[article-images] Image ${index + 1} upload failed:`, error);
      hadFailure = true;
    }
  }

  return {
    urls: resolved.filter((url): url is string => typeof url === 'string' && url.length > 0),
    slotUrls: resolved.slice(0, 3),
    hadFailure,
  };
}
