/** Domains (hostname match, lowercase) blocked for ad destination URLs. */
const BLOCKED_HOSTS = new Set([
  'malware.testing.google.test',
  'phishing.example',
]);

export function hostnameBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.onion')) return true;
  return false;
}

export function isProhibitedDestinationUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return true;
    return hostnameBlocked(u.hostname);
  } catch {
    return true;
  }
}
