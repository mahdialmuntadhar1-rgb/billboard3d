import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';
import { PhoneData, PhoneCategory } from '../types';

// ============================================
// Phone Parser Utility
// ============================================
// Handles Iraqi phone number parsing and validation

const IRAQ_COUNTRY_CODE: CountryCode = 'IQ';

/**
 * Parse and validate an Iraqi phone number
 */
export function parseIraqiPhone(phone: string | null | undefined): PhoneData {
  if (!phone) {
    return {
      raw: '',
      formatted: '',
      has_phone: false,
      has_whatsapp: false,
      phone_category: 'none',
      is_valid: false,
    };
  }

  try {
    // Try parsing with libphonenumber-js
    const parsed = parsePhoneNumber(phone, IRAQ_COUNTRY_CODE);

    if (parsed && parsed.isValid()) {
      return {
        raw: phone,
        formatted: parsed.format('INTERNATIONAL'),
        has_phone: true,
        has_whatsapp: false, // Will be set by detectPhoneCategory
        phone_category: 'phone_only',
        is_valid: true,
        country_code: parsed.countryCallingCode,
        national_number: parsed.nationalNumber.toString(),
      };
    }
  } catch {
    // Parsing failed, try manual cleanup
  }

  // Manual cleanup and validation
  const cleaned = cleanIraqiPhone(phone);

  if (isValidIraqiFormat(cleaned)) {
    return {
      raw: phone,
      formatted: formatIraqiNumber(cleaned),
      has_phone: true,
      has_whatsapp: false,
      phone_category: 'phone_only',
      is_valid: true,
    };
  }

  // Invalid but keep original
  return {
    raw: phone,
    formatted: phone,
    has_phone: true,
    has_whatsapp: false,
    phone_category: 'phone_only',
    is_valid: false,
  };
}

/**
 * Detect phone category based on phone and WhatsApp availability
 */
export function detectPhoneCategory(
  phone: string | null | undefined,
  whatsapp: string | null | undefined
): PhoneCategory {
  const phoneValid = validateIraqiPhone(phone);
  const whatsappValid = validateIraqiPhone(whatsapp);

  if (phoneValid && whatsappValid) return 'both';
  if (phoneValid && !whatsappValid) return 'phone_only';
  if (!phoneValid && whatsappValid) return 'whatsapp_only';
  return 'none';
}

/**
 * Validate Iraqi phone number
 */
export function validateIraqiPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;

  try {
    const parsed = parsePhoneNumber(phone, IRAQ_COUNTRY_CODE);
    if (parsed && parsed.isValid()) {
      return true;
    }
  } catch {
    // Parsing failed
  }

  // Manual validation
  const cleaned = cleanIraqiPhone(phone);
  return isValidIraqiFormat(cleaned);
}

/**
 * Clean Iraqi phone number - remove non-digits and standardize
 */
export function cleanIraqiPhone(phone: string): string {
  // Remove all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle various formats
  if (cleaned.startsWith('+964')) {
    return cleaned;
  } else if (cleaned.startsWith('964')) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    return '+964' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('7')) {
    return '+964' + cleaned;
  }

  return cleaned;
}

/**
 * Check if phone matches valid Iraqi format
 */
export function isValidIraqiFormat(phone: string): boolean {
  // Iraqi mobile numbers: +964 7XX XXX XXXX (10 digits after country code)
  // Valid prefixes: 077, 078, 079, 075, 076, 074
  const validPrefixes = ['77', '78', '79', '75', '76', '74'];

  // Remove +964 prefix for checking
  let national = phone;
  if (phone.startsWith('+964')) {
    national = phone.substring(4);
  }

  // Should be 10 digits
  if (national.length !== 10) {
    return false;
  }

  // Check prefix
  const prefix = national.substring(0, 2);
  return validPrefixes.includes(prefix);
}

/**
 * Format Iraqi number in standard international format
 */
export function formatIraqiNumber(phone: string): string {
  const cleaned = cleanIraqiPhone(phone);

  if (!cleaned.startsWith('+964')) {
    return phone; // Return original if can't format
  }

  const national = cleaned.substring(4); // Remove +964

  if (national.length !== 10) {
    return cleaned;
  }

  // Format: +964 770 123 4567
  const prefix = national.substring(0, 3);
  const part1 = national.substring(3, 6);
  const part2 = national.substring(6, 10);

  return `+964 ${prefix} ${part1} ${part2}`;
}

/**
 * Generate all possible variations of an Iraqi phone number
 * Useful for fuzzy matching and deduplication
 */
export function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [];
  const cleaned = cleanIraqiPhone(phone);

  if (!isValidIraqiFormat(cleaned)) {
    return [phone];
  }

  // International format: +9647701234567
  variations.push(cleaned);

  // Without + : 9647701234567
  variations.push(cleaned.substring(1));

  // National format with 0: 07701234567
  const national = cleaned.substring(4);
  variations.push('0' + national);

  // With spaces: +964 770 123 4567
  variations.push(formatIraqiNumber(cleaned));

  // Last 7 digits for flexible matching
  variations.push(national.substring(3));

  // Last 9 digits (without country code)
  variations.push(national);

  return [...new Set(variations)];
}

/**
 * Check if a phone number is likely a WhatsApp number
 * In Iraq, WhatsApp numbers are typically mobile numbers
 */
export function isLikelyWhatsApp(phone: string): boolean {
  // All valid Iraqi mobile numbers can be WhatsApp numbers
  return validateIraqiPhone(phone);
}

/**
 * Extract phone numbers from text
 */
export function extractPhoneNumbers(text: string): string[] {
  // Pattern for Iraqi phone numbers
  const patterns = [
    /\+964[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}/g,  // +964 770 123 4567
    /964[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}/g,    // 964 770 123 4567
    /0[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/g,      // 0770 123 4567
    /07[5789][\s\-]?\d{3}[\s\-]?\d{4}/g,            // 077 123 4567
    /07[456][\s\-]?\d{3}[\s\-]?\d{4}/g,             // 075 123 4567 (regional)
  ];

  const matches: string[] = [];

  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }

  // Clean and deduplicate
  return [...new Set(matches.map(m => cleanIraqiPhone(m)))];
}

/**
 * Compare two phone numbers for equality
 * Handles various format differences
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const cleaned1 = cleanIraqiPhone(phone1);
  const cleaned2 = cleanIraqiPhone(phone2);

  // Direct match
  if (cleaned1 === cleaned2) return true;

  // Check variations
  const variations1 = generatePhoneVariations(cleaned1);
  const variations2 = generatePhoneVariations(cleaned2);

  // Check if any variation matches
  for (const v1 of variations1) {
    for (const v2 of variations2) {
      if (v1 === v2) return true;
    }
  }

  return false;
}

/**
 * Get phone metadata for display
 */
export function getPhoneMetadata(phone: string): {
  carrier: string | null;
  region: string | null;
  isMobile: boolean;
} {
  const cleaned = cleanIraqiPhone(phone);

  if (!isValidIraqiFormat(cleaned)) {
    return { carrier: null, region: null, isMobile: false };
  }

  const national = cleaned.startsWith('+964')
    ? cleaned.substring(4)
    : cleaned;

  const prefix = national.substring(0, 3);

  // Iraqi mobile carriers
  const carriers: Record<string, string> = {
    '770': 'Zain Iraq',
    '771': 'Zain Iraq',
    '772': 'Zain Iraq',
    '773': 'Zain Iraq',
    '774': 'Zain Iraq',
    '780': 'Asiacell',
    '781': 'Asiacell',
    '782': 'Asiacell',
    '783': 'Asiacell',
    '790': 'Korek Telecom',
    '791': 'Korek Telecom',
    '792': 'Korek Telecom',
    '793': 'Korek Telecom',
    '750': 'Zain Iraq',
    '751': 'Zain Iraq',
    '752': 'Zain Iraq',
    '753': 'Zain Iraq',
    '754': 'Zain Iraq',
    '760': 'Asiacell',
    '761': 'Asiacell',
    '762': 'Asiacell',
    '763': 'Asiacell',
    '764': 'Asiacell',
  };

  // Regional prefixes (less common)
  const regionalPrefixes = ['745', '746', '747', '748', '749'];
  const isRegional = regionalPrefixes.includes(prefix);

  return {
    carrier: carriers[prefix] || (isRegional ? 'Regional' : 'Unknown'),
    region: isRegional ? 'Kurdistan Region' : null,
    isMobile: true,
  };
}
