/** Matches Supabase `articles.editorial_category` allowed values (default DB: general). */

export const EDITORIAL_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: 'General Content' },
  { value: 'human-rights-reporting', label: 'Human Rights Reporting' },
  { value: 'conflict-reporting', label: 'Conflict Reporting' },
  { value: 'political-commentary', label: 'Political Commentary' },
  { value: 'culture', label: 'Culture' },
  { value: 'economy', label: 'Economy' },
];

export const EDITORIAL_CATEGORY_VALUES: readonly string[] = EDITORIAL_CATEGORY_OPTIONS.map((o) => o.value);

/** Human editorial queue — skip automated OpenAI/Claude moderation. */
export const SKIP_AUTO_MODERATION_CATEGORIES = [
  'human-rights-reporting',
  'conflict-reporting',
  'political-commentary',
] as const;

export function normalizeEditorialCategory(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s && EDITORIAL_CATEGORY_VALUES.includes(s)) return s;
  return 'general';
}

export function requiresHumanEditorialReview(editorialCategory: string): boolean {
  return (SKIP_AUTO_MODERATION_CATEGORIES as readonly string[]).includes(editorialCategory);
}
