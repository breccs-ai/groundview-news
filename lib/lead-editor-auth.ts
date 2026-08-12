import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export async function resolveLeadEditor(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: membership } = await service
    .from('founding_lead_editor_memberships')
    .select('journalist_id, status')
    .eq('journalist_id', data.user.id)
    .eq('status', 'accepted')
    .maybeSingle();
  if (!membership) return null;

  return { user: data.user, service };
}
