const MAX_SLUG_LENGTH = 96;

function trimSlugToWordBoundary(slug: string, maxLength = MAX_SLUG_LENGTH): string {
  if (slug.length <= maxLength) return slug;

  const truncated = slug.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf('-');
  if (lastDash > 0) {
    return truncated.slice(0, lastDash);
  }
  return slug;
}

export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return trimSlugToWordBoundary(slug);
}

export function generateUniqueSlug(title: string): string {
  const base = generateSlug(title) || 'article';
  // Using slice(-4) to reliably take the last 4 chars.
  const timestamp = Date.now().toString(36).slice(-4);
  return `${base}-${timestamp}`;
}

