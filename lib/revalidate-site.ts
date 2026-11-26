import { revalidatePath } from 'next/cache';

/**
 * Refreshes the cached home page, category pages and (when given) one article after
 * content changes. Server code calls this directly. /api/revalidate wraps it for the
 * admin screens and requires an admin session, so anonymous visitors cannot use it
 * to purge the page cache.
 */
export function revalidateSite(slug?: string | null) {
  revalidatePath('/');
  revalidatePath('/category/africa-diaspora');
  revalidatePath('/category/world-politics');
  revalidatePath('/category/human-rights');
  revalidatePath('/category/economy');
  revalidatePath('/category/commentary');
  if (slug) revalidatePath(`/articles/${slug}`);
}
