type WriterContent = {
  fullName: string;
  penName: string;
  bio: string;
};

export type WriterContentValidation =
  | { valid: true }
  | { valid: false; error: string };

const ALPHABETIC_WORD = /(?:^|[^\p{L}])\p{L}{2,}(?=$|[^\p{L}])/u;
const ASCII_VOWEL = /[aeiouy]/i;

function hasVowel(value: string): boolean {
  // Normalisation makes accented Latin vowels (for example é or ö) comparable.
  return ASCII_VOWEL.test(value.normalize('NFD').replace(/\p{M}/gu, ''));
}

function hasAlphabeticWord(value: string): boolean {
  return ALPHABETIC_WORD.test(value);
}

function looksBase64Like(value: string): boolean {
  const compact = value.trim();
  if (compact.length < 16 || compact.length % 4 !== 0 || /\s/.test(compact)) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return false;

  const transitions = (compact.match(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[a-z])/g) || []).length;
  return /[0-9+/=]/.test(compact) || transitions >= 4;
}

function hasSuspiciousUppercaseRatio(value: string): boolean {
  const letters = Array.from(value).filter((char) => /\p{L}/u.test(char));
  if (letters.length < 6) return false;

  const uppercase = letters.filter(
    (char) => char === char.toLocaleUpperCase() && char !== char.toLocaleLowerCase()
  ).length;
  const lowercase = letters.filter(
    (char) => char === char.toLocaleLowerCase() && char !== char.toLocaleUpperCase()
  ).length;
  if (lowercase === 0 || uppercase / letters.length <= 0.4) return false;

  // Preserve ordinary acronyms/initialisms such as "BBC" or "J Smith BBC".
  const words = value.match(/\p{L}+/gu) || [];
  const uppercaseWords = words.filter(
    (word) => word.length <= 5 && word === word.toLocaleUpperCase()
  );
  const nonAcronymLetters = words
    .filter((word) => !uppercaseWords.includes(word))
    .join('');
  if (!nonAcronymLetters) return false;

  const nonAcronymUppercase = Array.from(nonAcronymLetters).filter(
    (char) => char === char.toLocaleUpperCase() && char !== char.toLocaleLowerCase()
  ).length;
  return nonAcronymUppercase / Array.from(nonAcronymLetters).length > 0.4;
}

function validateHumanText(label: string, value: string): WriterContentValidation {
  if (!hasVowel(value) || !hasAlphabeticWord(value)) {
    return { valid: false, error: `Please enter a valid ${label}.` };
  }
  return { valid: true };
}

export function validateWriterApplicationContent({
  fullName,
  penName,
  bio,
}: WriterContent): WriterContentValidation {
  for (const [label, value] of [
    ['full name', fullName],
    ['pen name', penName],
    ['bio', bio],
  ] as const) {
    const result = validateHumanText(label, value);
    if (!result.valid) return result;
  }

  for (const [label, value] of [
    ['full name', fullName],
    ['pen name', penName],
  ] as const) {
    if (looksBase64Like(value) || hasSuspiciousUppercaseRatio(value)) {
      return { valid: false, error: `Please enter a valid ${label}.` };
    }
  }

  return { valid: true };
}
