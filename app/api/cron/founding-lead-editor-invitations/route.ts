import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { claimAndSendProgrammeNotification, evaluateFoundingLeadEditorEligibility } from '@/lib/founding-lead-editor-program';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  const { data: published, error: publishedError } = await service
    .from('articles')
    .select('author_id')
    .eq('status', 'published')
    .eq('lead_editor_qualifying', true)
    .not('author_id', 'is', null);
  if (publishedError) return NextResponse.json({ error: publishedError.message }, { status: 400 });
  const authors = Array.from(new Set((published || []).map((row) => row.author_id).filter(Boolean)));
  for (const journalistId of authors) {
    await evaluateFoundingLeadEditorEligibility(service, journalistId);
  }
  const { data: promoted, error } = await service.rpc('maintain_founding_lead_editor_invitations', {
    p_max_places: 10,
    p_invitation_days: 14,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let notified = 0;
  for (const row of promoted || []) {
    if (await claimAndSendProgrammeNotification(service, row)) notified += 1;
  }
  return NextResponse.json({ ok: true, evaluated: authors.length, promoted: (promoted || []).length, notified });
}
