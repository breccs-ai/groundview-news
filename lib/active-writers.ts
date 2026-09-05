import { SupabaseClient } from '@supabase/supabase-js';

export type ActiveWriter = { id: string; email: string; full_name: string | null };

/** Approved, active journalists who haven't opted out of non-essential writer emails. */
export async function fetchActiveWriters(supabase: SupabaseClient): Promise<ActiveWriter[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('subscription_status', 'active')
    .eq('writer_reminder_opt_out', false)
    .or('role.eq.journalist,roles.cs.{journalist}');

  if (error) throw error;
  return ((data || []) as ActiveWriter[]).filter((w) => w.email);
}
