import { Language } from '../types';

// ============================================
// Language Detection Utility
// ============================================
// Detects Arabic, Kurdish, and English text

// Arabic Unicode range: \u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFF
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Kurdish (uses Arabic script with additional characters)
const KURDISH_REGEX = /[\u06A4\u06B5\u06C6\u06CE\u06D5\u06EE\u06B1]/;

// Latin characters (English)
const LATIN_REGEX = /[a-zA-Z]/;

// Kurdish-specific words and patterns
const KURDISH_KEYWORDS = [
  'kurd', 'kurdistan', 'erbil', 'hawler', 'sulaymaniyah', 'duhok',
  'kirkuk', 'zaxo', 'akre', 'soran', 'ranya', 'chalak', 'restoran',
  'kafiya', 'otel', 'dermanxane', 'zanku', 'kutubxane', 'qehwe',
  'naw', 'bash', 'zoor', 'ziman', 'kurdish', 'kurdi', 'sorani', 'badini'
];

// Arabic-specific patterns (common Iraqi words)
const ARABIC_KEYWORDS = [
  'مطعم', 'مقهى', 'فندق', 'صيدلية', 'مستشفى', 'مدرسة', 'جامعة',
  'سوق', 'مخبز', 'مكتبة', 'مصرف', 'بنك', 'عيادة', 'مستوصف',
  'العراق', 'بغداد', 'البصرة', 'الموصل', 'النجف', 'كربلاء',
  'عمان', 'سوريا', 'سعودية', 'كويت', 'إيران', 'تركيا',
  'عربي', 'إسلام', 'مسجد', 'كنيسة', 'حسينية'
];

/**
 * Detect the primary language of text
 */
export function detectLanguage(text: string): Language {
  if (!text || text.trim().length === 0) {
    return 'en';
  }

  const normalizedText = text.toLowerCase().trim();

  // Check for Kurdish first (has special characters)
  if (KURDISH_REGEX.test(normalizedText)) {
    return 'ku';
  }

  // Check for Kurdish keywords
  for (const keyword of KURDISH_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      return 'ku';
    }
  }

  // Check for Arabic
  if (ARABIC_REGEX.test(normalizedText)) {
    return 'ar';
  }

  // Check for Arabic keywords (even without Arabic script)
  for (const keyword of ARABIC_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      return 'ar';
    }
  }

  // Check for Latin characters (English)
  if (LATIN_REGEX.test(normalizedText)) {
    return 'en';
  }

  // Default to English if undetermined
  return 'en';
}

/**
 * Detect multiple languages in text (for mixed content)
 */
export function detectLanguages(text: string): Language[] {
  const languages: Set<Language> = new Set();

  if (!text) {
    return ['en'];
  }

  // Check for Arabic script
  if (ARABIC_REGEX.test(text)) {
    languages.add('ar');
  }

  // Check for Kurdish
  if (KURDISH_REGEX.test(text) || hasKurdishKeywords(text)) {
    languages.add('ku');
  }

  // Check for Latin
  if (LATIN_REGEX.test(text)) {
    languages.add('en');
  }

  if (languages.size === 0) {
    return ['en'];
  }

  return Array.from(languages);
}

/**
 * Check if text contains Kurdish keywords
 */
function hasKurdishKeywords(text: string): boolean {
  const normalized = text.toLowerCase();
  return KURDISH_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Get language name for display
 */
export function getLanguageName(language: Language): string {
  const names: Record<Language, string> = {
    'ar': 'Arabic',
    'ku': 'Kurdish',
    'en': 'English',
  };
  return names[language] || 'Unknown';
}

/**
 * Get language name in its own script
 */
export function getLanguageNameNative(language: Language): string {
  const names: Record<Language, string> = {
    'ar': 'العربية',
    'ku': 'کوردی',
    'en': 'English',
  };
  return names[language] || 'Unknown';
}

/**
 * Check if text is RTL (Right-to-Left) language
 */
export function isRTL(text: string): boolean {
  const lang = detectLanguage(text);
  return lang === 'ar' || lang === 'ku';
}

/**
 * Get text direction for HTML/CSS
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  return isRTL(text) ? 'rtl' : 'ltr';
}

/**
 * Normalize text for comparison (handles Arabic letter variations)
 */
export function normalizeText(text: string, language: Language): string {
  if (!text) return '';

  let normalized = text.toLowerCase().trim();

  if (language === 'ar') {
    // Remove Arabic diacritics (tashkeel)
    normalized = normalized.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

    // Normalize Arabic letter variants
    normalized = normalized
      .replace(/[\u0622\u0623\u0625]/g, '\u0627') // Alef variants
      .replace(/\u0649/g, '\u064A') // Alef maksura to ya
      .replace(/\u0629/g, '\u0647'); // Ta marbuta to ha
  }

  if (language === 'ku') {
    // Kurdish-specific normalizations
    normalized = normalized
      .replace(/\u06C6/g, '\u0648') // Kurdish o to waw
      .replace(/\u06D5/g, '\u0647'); // Kurdish e to ha
  }

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Detect script type (for font selection)
 */
export function detectScript(text: string): 'arabic' | 'latin' | 'mixed' {
  const hasArabic = ARABIC_REGEX.test(text);
  const hasLatin = LATIN_REGEX.test(text);

  if (hasArabic && hasLatin) return 'mixed';
  if (hasArabic) return 'arabic';
  return 'latin';
}

/**
 * Estimate language confidence score
 */
export function getLanguageConfidence(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const lang = detectLanguage(text);
  let score = 0;

  if (lang === 'ar' && ARABIC_REGEX.test(text)) {
    // Count Arabic characters
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.length;
    score = arabicChars / totalChars;
  } else if (lang === 'ku') {
    if (KURDISH_REGEX.test(text)) {
      score = 0.9;
    } else if (hasKurdishKeywords(text)) {
      score = 0.7;
    }
  } else if (lang === 'en') {
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.length;
    score = latinChars / totalChars;
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Split text by language segments
 * Useful for mixed-language content
 */
export function splitByLanguage(text: string): Array<{ text: string; language: Language }> {
  const segments: Array<{ text: string; language: Language }> = [];

  if (!text) return segments;

  // Simple approach: detect language of each word
  const words = text.split(/(\s+)/);
  let currentSegment = '';
  let currentLang: Language = 'en';

  for (const word of words) {
    if (!word.trim()) {
      currentSegment += word;
      continue;
    }

    const wordLang = detectLanguage(word);

    if (currentSegment && wordLang !== currentLang) {
      segments.push({ text: currentSegment.trim(), language: currentLang });
      currentSegment = word;
      currentLang = wordLang;
    } else {
      currentSegment += word;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment.trim(), language: currentLang });
  }

  return segments;
}

/**
 * Get collation order for sorting
 * Ensures Arabic/Kurdish names sort correctly
 */
export function getCollationKey(text: string, language: Language): string {
  const normalized = normalizeText(text, language);

  if (language === 'ar' || language === 'ku') {
    // Arabic sort order: remove initial articles for sorting
    return normalized
      .replace(/^\u0627\u0644/, '') // Remove initial "Al-"
      .replace(/^\u0628/, '')       // Remove initial "B-"
      .replace(/^\u0641/, '');     // Remove initial "F-"
  }

  return normalized;
}
