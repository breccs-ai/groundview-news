export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

export function generateUniqueSlug(title: string): string {
  const base = generateSlug(title) || 'article';
  // Using slice(-4) to reliably take the last 4 chars.
  const timestamp = Date.now().toString(36).slice(-4);
  return `${base}-${timestamp}`;
}

