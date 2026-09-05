import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 8;

function submitterIp(req: NextRequest): string | null {
  const direct =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-vercel-forwarded-for');
  if (direct?.trim()) return direct.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

function hashSubmitterIp(ip: string): string {
  const pepper =
    process.env.CONTACT_RATE_LIMIT_SECRET ||
    process.env.WRITER_RATE_LIMIT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'ground-view-newsletter-rate-limit';
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex');
}

type RateLimitRow = {
  allowed: boolean;
  attempts: number;
  retry_after_seconds: number;
};

export async function enforceNewsletterRateLimit(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  const ip = submitterIp(req) || (process.env.NODE_ENV === 'production' ? null : '127.0.0.1');
  if (!ip) {
    return NextResponse.json({ error: 'Could not verify submission origin.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('consume_newsletter_subscribe_attempt', {
    p_ip_hash: hashSubmitterIp(ip),
    p_limit: MAX_ATTEMPTS,
    p_window: '1 hour',
  });

  if (error) {
    console.error('[newsletter rate limit]', error.message);
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row?.allowed) {
    const retryAfter = Math.max(1, Number(row?.retry_after_seconds) || 3600);
    return NextResponse.json(
      { error: 'Too many subscribe attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  return null;
}
