/** Classified traffic source stored on article_views.referrer_source */
export type ReferrerSource =
  | 'direct'
  | 'search'
  | 'social_twitter'
  | 'social_facebook'
  | 'social_linkedin'
  | 'social_whatsapp'
  | 'referral'
  | 'unknown';

export const REFERRER_SOURCE_LABELS: Record<ReferrerSource, string> = {
  direct: 'Direct',
  search: 'Search engines',
  social_twitter: 'Twitter / X',
  social_facebook: 'Facebook',
  social_linkedin: 'LinkedIn',
  social_whatsapp: 'WhatsApp',
  referral: 'Referral',
  unknown: 'Unknown',
};

/** Traffic groups for dashboard bar charts */
export const TRAFFIC_GROUP_LABELS: Record<string, string> = {
  direct: 'Direct',
  search: 'Search engines',
  social: 'Social media',
  referral: 'Referral',
  unknown: 'Unknown',
};

export function classifyReferrer(
  referrer: string | null | undefined,
  siteHost = 'groundviewnews.com'
): ReferrerSource {
  const raw = (referrer || '').trim();
  if (!raw) return 'direct';

  let host = '';
  try {
    const u = new URL(raw);
    host = u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }

  const site = siteHost.toLowerCase().replace(/^www\./, '');
  if (host === site || host.endsWith(`.${site}`)) return 'direct';

  if (
    host.includes('google.') ||
    host.includes('bing.com') ||
    host.includes('duckduckgo.com') ||
    host.includes('yahoo.') ||
    host.includes('ecosia.org') ||
    host === 't.co'
  ) {
    return 'search';
  }

  if (host.includes('twitter.com') || host === 'x.com' || host.includes('t.co')) {
    return 'social_twitter';
  }
  if (host.includes('facebook.com') || host === 'fb.com' || host.includes('fb.me')) {
    return 'social_facebook';
  }
  if (host.includes('linkedin.com') || host === 'lnkd.in') {
    return 'social_linkedin';
  }
  if (host.includes('whatsapp.com') || host === 'wa.me') {
    return 'social_whatsapp';
  }

  return 'referral';
}

export function referrerSourceToTrafficGroup(source: string): string {
  if (source.startsWith('social_')) return 'social';
  if (source === 'direct' || source === 'search' || source === 'referral') return source;
  return 'unknown';
}

export function socialPlatformLabel(source: string): string {
  if (source === 'social_twitter') return 'Twitter / X';
  if (source === 'social_facebook') return 'Facebook';
  if (source === 'social_linkedin') return 'LinkedIn';
  if (source === 'social_whatsapp') return 'WhatsApp';
  return source;
}
