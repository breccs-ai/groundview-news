import { createClient } from '@supabase/supabase-js';

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
  published_at: string;
  created_at: string;
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

export const CATEGORIES: Category[] = [
  {
    slug: 'africa-diaspora',
    label: 'Africa & Diaspora',
    color: '#B8860B',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-400',
  },
  {
    slug: 'world-politics',
    label: 'World Politics',
    color: '#1E40AF',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-400',
  },
  {
    slug: 'human-rights',
    label: 'Human Rights',
    color: '#B91C1C',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-400',
  },
  {
    slug: 'economy',
    label: 'Economy',
    color: '#15803D',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-400',
  },
  {
    slug: 'commentary',
    label: 'Commentary',
    color: '#475569',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-400',
  },
];

export function getCategoryMeta(slug: string): Category {
  return (
    CATEGORIES.find((c) => c.slug === slug) || {
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
