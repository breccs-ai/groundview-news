import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

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

  const { data: rows, error } = await supabase
    .from('subscribers')
    .select('id, email, confirmed, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let list = (rows || []).map((r) => {
    const row = r as { id: string; email: string; confirmed: boolean; created_at: string };
    const status = row.confirmed ? 'active' : 'pending';
    return {
      id: row.id,
      email: row.email,
      tier: 'newsletter' as const,
      status,
      join_date: row.created_at,
    };
  });

  if (tierFilter && tierFilter !== 'all') {
    list = list.filter((s) => s.tier === tierFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    list = list.filter((s) => s.status === statusFilter);
  }
  if (q) {
    list = list.filter((s) => s.email.toLowerCase().includes(q));
  }

  const growthMap = new Map<string, number>();
  for (const s of rows || []) {
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
    total: (rows || []).length,
    subscribers: list,
    monthly_growth: monthlyGrowth,
  });
}
