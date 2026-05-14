/** Format integers for reader/share counts: commas ≥1k, 1 decimal M ≥1M. */
export function formatStatCount(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m >= 10 ? m.toFixed(0) : m.toFixed(1);
    return `${s.replace(/\.0$/, '')}M`;
  }
  if (v >= 1000) return v.toLocaleString('en-US');
  return String(v);
}
