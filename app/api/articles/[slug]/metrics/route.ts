import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { fetchArticleMetrics } from '@/lib/article-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: { slug: string } }
) {
  const slug = decodeURIComponent(context.params.slug || '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const metrics = await fetchArticleMetrics(supabase, slug);
  if (!metrics) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  return NextResponse.json(metrics, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
