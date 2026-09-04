// Heuristics for rejecting auto-generated contact/advertising-enquiry submissions.
// The bot traffic observed against these forms fills every field with a bare,
// randomly-cased alphanumeric tracking token (e.g. "QnBnyfKwJCFIKIJk") rather than
// text a person typed, so the checks below target that shape specifically.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

/** True if any word is long enough that a real Latin-script word would contain a vowel. */
function hasVowellessLongWord(value: string): boolean {
  const words = value.match(/[A-Za-z]+/g) || [];
  return words.some((word) => word.length >= 4 && !/[aeiouAEIOU]/.test(word));
}

function hasReadableWord(value: string): boolean {
  const words = value.match(/[A-Za-z]+/g) || [];
  return words.some((word) => word.length >= 2 && /[aeiouAEIOU]/.test(word));
}

export function isValidEmailFormat(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** For name-like fields: rejects bare tokens, vowelless gibberish words, and content with no real word. */
export function isPlausibleName(value: string): boolean {
  return !looksLikeRandomToken(value) && !hasVowellessLongWord(value) && hasReadableWord(value);
}

/** For free-text fields (subject/message): rejects bare tokens and content with no real word. */
export function isPlausibleFreeText(value: string): boolean {
  return !looksLikeRandomToken(value) && hasReadableWord(value);
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
