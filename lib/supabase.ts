import { createClient } from '@supabase/supabase-js';

/**
 * Article stats columns — run in Supabase SQL Editor if not already applied:
 *
 * ```sql
 * ALTER TABLE articles ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
 * ALTER TABLE articles ADD COLUMN IF NOT EXISTS shares jsonb DEFAULT '{"twitter": 0, "facebook": 0, "linkedin": 0, "whatsapp": 0, "total": 0}'::jsonb;
 * ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_images jsonb DEFAULT '[]'::jsonb;
 * ```
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Article = {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  author_name: string;
  category: string;
  /** Editorial submission type (review routing); DB default `general`. */
  editorial_category?: string;
  label: string;
  body: ArticleBody;
  excerpt: string;
  featured_image_url: string;
  /** Up to three uploaded article images with optional captions. Apply the article_images Supabase migration before use. */
  article_images?: unknown;
  /** Page-view counter; increment via RPC from client once per session. */
  views?: number | null;
  /** Per-platform share counts + total; see `parseArticleShares` in lib/article-shares.ts */
  shares?: unknown;
  published_at: string;
  /**
   * Subscriber early-access threshold. When `publish_at > now`, free readers
   * see a soft "Subscribers are reading this now" banner on the article page
   * but are never blocked from reading. When NULL or in the past, no banner.
   */
  publish_at?: string | null;
  created_at: string;
};

export type ArticleImage = {
  url: string;
  caption: string;
};

/** Legacy block-based body (pre–full Markdown). Still supported for rendering migration. */
export type ArticleBodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level?: number; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: string; text?: string; level?: number; items?: string[]; url?: string; caption?: string };

/** jsonb body: standard storage is `{ markdown: string }`; legacy `{ content: [...] }` remains readable. */
export type ArticleBody =
  | string
  | null
  | {
      markdown?: string;
      content?: ArticleBodyBlock[];
      [key: string]: unknown;
    };

export type Category = {
  slug: string;
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
};

/**
 * Article routing categories.
 *
 * The order here drives the public navbar and the article submission dropdown.
 * Keep this list aligned with the writer-facing category list (see /write-for-us page tiles
 * and /write-for-us/apply checkboxes). "Other" is intentionally NOT a routing slug — articles
 * tagged "Other" by writers should be filed under the most appropriate concrete category by
 * the editor when approving.
 *
 * Legacy slugs like `human-rights` are preserved so existing articles stay routable.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'world-politics',
    label: 'World Politics',
    color: '#1E40AF',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-400',
  },
  {
    slug: 'business-economy',
    label: 'Business & Economy',
    color: '#15803D',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-400',
  },
  {
    slug: 'financial-news-banking',
    label: 'Financial News & Banking',
    color: '#0F766E',
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    border: 'border-teal-400',
  },
  {
    slug: 'sports',
    label: 'Sports',
    color: '#C2410C',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-400',
  },
  {
    slug: 'africa-diaspora',
    label: 'Africa & Diaspora',
    color: '#B8860B',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-400',
  },
  {
    slug: 'science-technology',
    label: 'Science & Technology',
    color: '#4338CA',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-400',
  },
  {
    slug: 'culture-society',
    label: 'Culture & Society',
    color: '#BE185D',
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    border: 'border-pink-400',
  },
  {
    slug: 'human-interest',
    label: 'Human Interest',
    color: '#BE123C',
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-400',
  },
  {
    slug: 'environment-climate',
    label: 'Environment & Climate',
    color: '#047857',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-400',
  },
  {
    slug: 'health-medicine',
    label: 'Health & Medicine',
    color: '#0369A1',
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    border: 'border-sky-400',
  },
  {
    slug: 'law-justice',
    label: 'Law & Justice',
    color: '#6D28D9',
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    border: 'border-violet-400',
  },
  {
    slug: 'education',
    label: 'Education',
    color: '#A16207',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-400',
  },
  {
    slug: 'travel-migration',
    label: 'Travel & Migration',
    color: '#0E7490',
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-400',
  },
  {
    slug: 'opinion-commentary',
    label: 'Opinion & Commentary',
    color: '#475569',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-400',
  },
  // Legacy — kept so existing articles already filed under this slug stay routable.
  {
    slug: 'human-rights',
    label: 'Human Rights',
    color: '#B91C1C',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-400',
  },
];

/**
 * Legacy slug → metadata. NOT iterated by UI components (navbar dropdown, footer,
 * etc.) so writers no longer see these as selectable options, but URLs like
 * /category/economy and /category/commentary remain routable, and any article
 * still stored under the legacy slug renders with the correct badge label and
 * colour palette via `getCategoryMeta`.
 *
 * New articles default to the new slugs: `business-economy`, `opinion-commentary`.
 */
export const LEGACY_CATEGORIES: Category[] = [
  {
    slug: 'economy',
    label: 'Business & Economy',
    color: '#15803D',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-400',
  },
  {
    slug: 'commentary',
    label: 'Opinion & Commentary',
    color: '#475569',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-400',
  },
];

export function getCategoryMeta(slug: string): Category {
  return (
    CATEGORIES.find((c) => c.slug === slug) ||
    LEGACY_CATEGORIES.find((c) => c.slug === slug) || {
      slug,
      label: slug,
      color: '#64748b',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-400',
    }
  );
}

export async function getPublishedArticles(options?: {
  category?: string;
  limit?: number;
}): Promise<Article[]> {
  let query = supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return [];
  return data as Article[];
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  return data as Article;
}
