import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

/**
 * Admin subscribers API.
 *
 * Returns a unified view that merges:
 *   - the existing `subscribers` table (free newsletter list)
 *   - the new reader-subscription rows on `profiles` (paying subscribers)
 *
 * Plus aggregate stats the admin page surfaces at the top:
 *   - total                    : raw row count
 *   - active_paid_count        : profiles.subscription_status = 'active'
 *   - monthly_paid_count       : active + plan = 'monthly'
 *   - annual_paid_count        : active + plan = 'annual'
 *   - mrr_pence                : MRR estimate, in pence
 *     formula: monthly × £4.99 + annual × (£39 / 12)
 *   - monthly_growth           : free newsletter signups per UTC month (last 12)
 */

type Tier = 'monthly' | 'annual' | 'newsletter';
type Status = 'active' | 'cancelled' | 'past_due' | 'pending' | 'free';

type Row = {
  id: string;
  email: string;
  tier: Tier;
  status: Status;
  join_date: string;
  expires_at: string | null;
};

const MONTHLY_PENCE = 499;
const ANNUAL_PENCE = 3900;

export async function GET(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const tierFilter = searchParams.get('tier');
  const statusFilter = searchParams.get('status');
  const q = searchParams.get('q')?.trim().toLowerCase();

  const [subsRes, profilesRes] = await Promise.all([
    supabase
      .from('subscribers')
      .select('id, email, confirmed, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select(
        'id, email, subscription_status, subscription_plan, subscription_started_at, subscription_expires_at, created_at',
      )
      .in('subscription_status', ['active', 'cancelled', 'past_due'])
      .order('created_at', { ascending: false }),
  ]);

  if (subsRes.error) {
    return NextResponse.json({ error: subsRes.error.message }, { status: 400 });
  }
  if (profilesRes.error) {
    return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
  }

  const newsletterRows: Row[] = (subsRes.data || []).map((r) => {
    const row = r as { id: string; email: string; confirmed: boolean; created_at: string };
    return {
      id: row.id,
      email: row.email,
      tier: 'newsletter',
      status: row.confirmed ? 'active' : 'pending',
      join_date: row.created_at,
      expires_at: null,
    };
  });

  const profileRows: Row[] = (profilesRes.data || []).map((r) => {
    const row = r as {
      id: string;
      email: string;
      subscription_status: string | null;
      subscription_plan: string | null;
      subscription_started_at: string | null;
      subscription_expires_at: string | null;
      created_at: string;
    };
    const plan = row.subscription_plan === 'annual' ? 'annual' : 'monthly';
    const status = (row.subscription_status as Status) || 'free';
    return {
      id: row.id,
      email: row.email,
      tier: plan as Tier,
      status,
      join_date: row.subscription_started_at || row.created_at,
      expires_at: row.subscription_expires_at,
    };
  });

  let list: Row[] = [...profileRows, ...newsletterRows];

  if (tierFilter && tierFilter !== 'all') {
    list = list.filter((s) => s.tier === tierFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    list = list.filter((s) => s.status === statusFilter);
  }
  if (q) {
    list = list.filter((s) => s.email.toLowerCase().includes(q));
  }

  const activePaid = profileRows.filter((p) => p.status === 'active');
  const monthlyCount = activePaid.filter((p) => p.tier === 'monthly').length;
  const annualCount = activePaid.filter((p) => p.tier === 'annual').length;
  // MRR estimate in pence: monthly × £4.99 + annual × (£39 / 12). We round
  // annual to the nearest penny per active subscriber, then sum.
  const mrrPence = monthlyCount * MONTHLY_PENCE + annualCount * Math.round(ANNUAL_PENCE / 12);

  // Free-newsletter growth chart (unchanged behaviour).
  const growthMap = new Map<string, number>();
  for (const s of subsRes.data || []) {
    const created = (s as { created_at: string }).created_at;
    const d = new Date(created);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    growthMap.set(key, (growthMap.get(key) || 0) + 1);
  }
  const monthlyGrowth = Array.from(growthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  return NextResponse.json({
    total: newsletterRows.length + profileRows.length,
    free_newsletter_count: newsletterRows.length,
    active_paid_count: activePaid.length,
    monthly_paid_count: monthlyCount,
    annual_paid_count: annualCount,
    mrr_pence: mrrPence,
    subscribers: list,
    monthly_growth: monthlyGrowth,
  });
}
