import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendArticleDigest } from '@/lib/writer-digest';

export const dynamic = 'force-dynamic';

/**
 * Monday-morning digest: every writer gets a roundup of everything published
 * by their colleagues in the last 7 days, encouraging them to share it.
 * Schedule: weekly, Monday (declared in vercel.json).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('articles')
    .select('title, slug, author_id, author_name')
    .eq('status', 'published')
    .gte('published_at', since.toISOString())
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = await sendArticleDigest(supabase, data || [], 'Published this past week');

  console.log(`[weekly-writer-digest] articles=${(data || []).length} sent=${result.sent} skipped=${result.skipped} failed=${result.failed.length}`);

  return NextResponse.json({ ok: true, articles: (data || []).length, ...result });
}
