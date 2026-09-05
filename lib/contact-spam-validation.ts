// Heuristics for rejecting auto-generated contact/advertising-enquiry submissions.
// The bot traffic observed against these forms fills every field with a bare,
// randomly-cased alphanumeric tracking token (e.g. "QnBnyfKwJCFIKIJk") rather than
// text a person typed, so the checks below target that shape specifically.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 'y' counts as a vowel here so real words like "rhythm" or "crypt" aren't
// mistaken for vowelless filler.
const VOWEL_RE = /[aeiouyAEIOUY]/;
const VOWEL_RE_G = /[aeiouyAEIOUY]/g;

function countCaseTransitions(value: string): number {
  let transitions = 0;
  for (let i = 1; i < value.length; i++) {
    const prevLower = /[a-z]/.test(value[i - 1]);
    const prevUpper = /[A-Z]/.test(value[i - 1]);
    const currLower = /[a-z]/.test(value[i]);
    const currUpper = /[A-Z]/.test(value[i]);
    if ((prevLower && currUpper) || (prevUpper && currLower)) transitions++;
  }
  return transitions;
}

/**
 * A single word (no whitespace) with erratic case-switching throughout, the hallmark of
 * a machine-generated identifier rather than a word or short phrase a person typed.
 * A normal capitalized word ("Feedback") has at most one transition, at the start.
 */
export function looksLikeRandomToken(value: string): boolean {
  const trimmed = value.trim();
  if (/\s/.test(trimmed) || trimmed.length < 10) return false;
  if (!/^[A-Za-z]+$/.test(trimmed)) return false;
  return countCaseTransitions(trimmed) >= 3;
}

/** True if any individual word within a multi-word value is itself a random token. */
function hasEmbeddedRandomToken(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  return words.some((word) => looksLikeRandomToken(word));
}

/** True if any word is long enough that a real Latin-script word would contain a vowel. */
function hasVowellessLongWord(value: string): boolean {
  const words = value.match(/[A-Za-z]+/g) || [];
  return words.some((word) => word.length >= 4 && !VOWEL_RE.test(word));
}

/**
 * True if any word has a vowel ratio far below anything real Latin-script text
 * produces — catches multi-consonant filler (e.g. "Svslomzc") that dodges the
 * vowelless check by including a single vowel. The threshold is tuned against long
 * English/Irish surnames (Fitzgerald, Worthington, Cholmondeley) so real names
 * don't trip it; it is intentionally not used on free text, where legitimate words
 * like "strength" or "twelfth" have similarly low ratios.
 */
function hasLowVowelRatioWord(value: string): boolean {
  const words = value.match(/[A-Za-z]+/g) || [];
  return words.some((word) => {
    if (word.length < 7) return false;
    const vowels = (word.match(VOWEL_RE_G) || []).length;
    return vowels / word.length < 0.15;
  });
}

function hasReadableWord(value: string): boolean {
  const words = value.match(/[A-Za-z]+/g) || [];
  return words.some((word) => word.length >= 2 && VOWEL_RE.test(word));
}

export function isValidEmailFormat(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * For name-like fields: rejects bare tokens, embedded tokens, vowelless or
 * near-vowelless gibberish words, and content with no real word.
 */
export function isPlausibleName(value: string): boolean {
  return (
    !looksLikeRandomToken(value) &&
    !hasEmbeddedRandomToken(value) &&
    !hasVowellessLongWord(value) &&
    !hasLowVowelRatioWord(value) &&
    hasReadableWord(value)
  );
}

/** For free-text fields (subject/message): rejects bare tokens, embedded tokens, and content with no real word. */
export function isPlausibleFreeText(value: string): boolean {
  return !looksLikeRandomToken(value) && !hasEmbeddedRandomToken(value) && hasReadableWord(value);
}

export type ContactValidation = { valid: true } | { valid: false; error: string };

export function validateContactSubmission(fields: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): ContactValidation {
  const { name, email, subject, message } = fields;

  if (!isValidEmailFormat(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!isPlausibleName(name)) {
    return { valid: false, error: 'Please enter a valid name.' };
  }
  if (!isPlausibleFreeText(subject)) {
    return { valid: false, error: 'Please enter a valid subject.' };
  }
  if (!isPlausibleFreeText(message)) {
    return { valid: false, error: 'Please enter a valid message.' };
  }

  return { valid: true };
}
