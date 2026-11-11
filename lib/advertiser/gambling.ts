/**
 * Heuristic detection of gambling advertising. Ads that match are held for
 * manual approval instead of going live automatically. This errs towards
 * holding: a false positive costs a minute of review, a false negative puts a
 * casino ad live unseen. It is not a guarantee, which is why the advertiser
 * terms also require advertisers not to disguise gambling advertising.
 */

const GAMBLING_TEXT =
  /\b(casinos?|gambl(?:e|es|ing|er|ers)|betting|bookmakers?|sportsbooks?|poker|roulette|blackjack|baccarat|bingo|lotter(?:y|ies)|jackpots?|wager(?:s|ing)?|punters?|igaming|free spins?|online slots|slot machines?|place (?:a|your) bets?|bet now)\b/gi;

const GAMBLING_HOST_PARTS =
  /(casino|poker|betting|sportsbook|bingo|jackpot|gambl|lotto|roulette|blackjack|slots)/;

const GAMBLING_BRAND_LABELS = new Set([
  'bet365',
  'betway',
  'betfair',
  'betfred',
  'betvictor',
  'betmgm',
  'betsson',
  'paddypower',
  'williamhill',
  'ladbrokes',
  'skybet',
  'unibet',
  'bwin',
  'stake',
  '1xbet',
  '22bet',
  'parimatch',
  'melbet',
  'mostbet',
  'bet',
  'bets',
]);

export type GamblingDetection = { matched: boolean; signals: string[] };

function hostSignals(destinationUrl: string): string[] {
  try {
    const host = new URL(destinationUrl).hostname.toLowerCase().replace(/^www\./, '');
    const labels = host.split('.');
    // Second-level label of the registrable domain, e.g. "bet365" in "bet365.com".
    const registrable = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
    const out: string[] = [];
    if (GAMBLING_BRAND_LABELS.has(registrable)) out.push(`domain:${registrable}`);
    const part = host.match(GAMBLING_HOST_PARTS);
    if (part) out.push(`domain:${part[1]}`);
    return out;
  } catch {
    return [];
  }
}

export function detectGamblingAd(input: {
  title?: string | null;
  bodyText?: string | null;
  destinationUrl?: string | null;
}): GamblingDetection {
  const text = `${input.title || ''}\n${input.bodyText || ''}`;
  const signals = new Set<string>();

  const textRe = new RegExp(GAMBLING_TEXT.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(text)) !== null) {
    signals.add(m[1].toLowerCase());
  }
  for (const s of hostSignals(String(input.destinationUrl || ''))) {
    signals.add(s);
  }

  return { matched: signals.size > 0, signals: Array.from(signals) };
}
