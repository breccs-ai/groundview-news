import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Nightly clean-up of newsletter sign-ups that never confirmed.
 *
 * An unconfirmed row can never receive the digest, so it is dead weight at best and a
 * place for junk addresses to pile up at worst. Rows older than RETENTION_DAYS are
 * deleted, with one exception: rows created before double opt-in went live
 * (LEGACY_CUTOFF) are left alone, because those readers were never asked to confirm and
 * the owner is deciding separately whether to email them. Remove the cutoff only once
 * that decision is made.
 *
 * Auth: Bearer CRON_SECRET, as for the other cron routes. ?dry_run=1 counts without deleting.
 */

const RETENTION_DAYS = 30;
const LEGACY_CUTOFF = '2026-11-26T00:00:00Z';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  const olderThan = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (dryRun) {
      const { count, error } = await supabase
        .from('subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('confirmed', false)
        .gte('subscribed_at', LEGACY_CUTOFF)
        .lt('subscribed_at', olderThan);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, dry_run: true, would_delete: count ?? 0 });
    }

    const { data, error } = await supabase
      .from('subscribers')
      .delete()
      .eq('confirmed', false)
      .gte('subscribed_at', LEGACY_CUTOFF)
      .lt('subscribed_at', olderThan)
      .select('id');
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
  } catch (e) {
    console.error('[cron/purge-unconfirmed-subscribers]', e);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
