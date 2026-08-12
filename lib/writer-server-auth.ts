import { NextRequest } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';

export type ApprovedWriter = {
  id: string;
  email: string;
  fullName: string;
  penName: string;
};

export async function getApprovedWriter(req: NextRequest): Promise<ApprovedWriter | null> {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const service = getServiceSupabase();
  if (!service) return null;

  const { data: authData, error: authError } = await service.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile } = await service
    .from('profiles')
    .select('id, email, full_name, pen_name, role, roles, subscription_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  const row = profile as {
    id?: string;
    email?: string;
    full_name?: string;
    pen_name?: string | null;
    role?: string | null;
    roles?: string[] | null;
    subscription_status?: string | null;
  } | null;
  const hasWriterRole = row?.role === 'journalist' || (row?.roles || []).includes('journalist');
  if (!row?.id || !hasWriterRole || row.subscription_status !== 'active') return null;

  return {
    id: row.id,
    email: row.email || authData.user.email || '',
    fullName: row.full_name || '',
    penName: row.pen_name || row.full_name || '',
  };
}
