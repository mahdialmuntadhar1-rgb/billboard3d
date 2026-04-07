import { SupabaseClient } from '@supabase/supabase-js';
import { parsePhoneNumber } from 'libphonenumber-js';
import { detectLanguage } from '../utils/language-detector';
import { detectPhoneCategory } from '../utils/phone-parser';

// ============================================
// Enrichment Pipeline Stage
// ============================================

export async function enrichRecords(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  console.log(`[Enricher] Starting enrichment for job ${jobId}`);

  // Fetch records that need enrichment
  const { data: stagingRecords, error: fetchError } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'SCRAPED');

  if (fetchError) {
    console.error('[Enricher] Error fetching records:', fetchError);
    throw fetchError;
  }

  if (!stagingRecords || stagingRecords.length === 0) {
    console.log('[Enricher] No records to enrich');
    return;
  }

  console.log(`[Enricher] Enriching ${stagingRecords.length} records`);

  // Process records in batches
  const batchSize = 50;
  for (let i = 0; i < stagingRecords.length; i += batchSize) {
    const batch = stagingRecords.slice(i, i + batchSize);
    await processEnrichmentBatch(supabase, batch);
  }

  console.log(`[Enricher] Completed enrichment for ${stagingRecords.length} records`);
}

async function processEnrichmentBatch(
  supabase: SupabaseClient,
  records: Record<string, unknown>[]
): Promise<void> {
  for (const record of records) {
    try {
      const issues: string[] = [];
      const updates: Record<string, unknown> = {
        pipeline_stage: 'ENRICHED',
        updated_at: new Date().toISOString(),
      };

      // ============================================
      // 1. Parse and validate phone numbers
      // ============================================
      const phoneData = enrichPhoneData(record.phone as string | null);
      updates.phone_formatted = phoneData.formatted;
      updates.has_phone = phoneData.has_phone;
      updates.phone_category = phoneData.phone_category;

      if (!phoneData.is_valid && record.phone) {
        issues.push('Invalid phone number format');
      }

      // ============================================
      // 2. Process WhatsApp number
      // ============================================
      if (record.whatsapp) {
        const whatsappData = enrichPhoneData(record.whatsapp as string);
        if (whatsappData.is_valid) {
          updates.whatsapp = whatsappData.formatted;
        }
      }

      // Update phone category if we have both phone and whatsapp
      if (record.phone && record.whatsapp) {
        updates.phone_category = detectPhoneCategory(
          record.phone as string,
          record.whatsapp as string
        );
      }

      // ============================================
      // 3. Detect language
      // ============================================
      const language = detectLanguage(record.name as string);
      updates.language = language;

      // Store name in appropriate language field
      if (language === 'ar') {
        updates.name_ar = record.name;
      } else if (language === 'ku') {
        updates.name_ku = record.name;
      }

      // ============================================
      // 4. Validate and normalize category
      // ============================================
      const normalizedCategory = normalizeCategory(
        record.category as string,
        record.name as string
      );
      if (normalizedCategory !== record.category) {
        issues.push(`Category normalized: ${record.category} → ${normalizedCategory}`);
        updates.category = normalizedCategory;
      }

      // ============================================
      // 5. Geocode address (optional, uses Nominatim)
      // ============================================
      if (record.address && record.city) {
        const geocodeResult = await geocodeAddress(
          record.address as string,
          record.city as string,
          record.governorate as string
        );
        if (!geocodeResult.found) {
          issues.push('Address not found in geocoding service');
        }
      }

      // ============================================
      // 6. Calculate confidence score
      // ============================================
      updates.confidence = calculateConfidence({
        hasPhone: phoneData.has_phone,
        hasAddress: !!record.address,
        hasCategory: !!normalizedCategory,
        phoneValid: phoneData.is_valid,
        fromGoogleMaps: record.source === 'google_maps',
        issues: issues.length,
      });

      // Store enrichment issues
      updates.enrichment_issues = issues;

      // Update record
      const { error: updateError } = await supabase
        .from('business_records_staging')
        .update(updates)
        .eq('id', record.id);

      if (updateError) {
        console.error(`[Enricher] Error updating record ${record.id}:`, updateError);
      }

    } catch (err) {
      console.error(`[Enricher] Error processing record ${record.id}:`, err);
    }
  }
}

// ============================================
// Phone Enrichment
// ============================================

interface PhoneEnrichmentResult {
  formatted: string | null;
  has_phone: boolean;
  phone_category: string;
  is_valid: boolean;
}

function enrichPhoneData(phone: string | null): PhoneEnrichmentResult {
  if (!phone) {
    return {
      formatted: null,
      has_phone: false,
      phone_category: 'none',
      is_valid: false,
    };
  }

  try {
    // Parse Iraqi phone number
    const parsed = parsePhoneNumber(phone, 'IQ');

    if (parsed && parsed.isValid()) {
      return {
        formatted: parsed.format('INTERNATIONAL'),
        has_phone: true,
        phone_category: 'phone_only',
        is_valid: true,
      };
    }
  } catch {
    // Invalid phone format
  }

  // Try to clean and re-parse
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length >= 10) {
    // Attempt to format as Iraqi number
    const formatted = formatIraqiNumber(cleaned);
    if (formatted) {
      return {
        formatted,
        has_phone: true,
        phone_category: 'phone_only',
        is_valid: true,
      };
    }
  }

  return {
    formatted: phone,
    has_phone: true,
    phone_category: 'phone_only',
    is_valid: false,
  };
}

function formatIraqiNumber(number: string): string | null {
  // Remove all non-digits except +
  let cleaned = number.replace(/[^\d+]/g, '');

  // Handle various Iraqi number formats
  if (cleaned.startsWith('+964')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('964')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Iraqi numbers should be 10 digits after country code
  if (cleaned.length === 10) {
    return `+964 ${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  }

  return null;
}

// ============================================
// Category Normalization
// ============================================

function normalizeCategory(category: string, name: string): string {
  const categoryKeywords: Record<string, string[]> = {
    'Restaurants': ['مطعم', 'restaurant', 'مطاعم', 'food', 'taam', 'akl'],
    'Hotels': ['فندق', 'hotel', 'فنادق', 'hostel', 'otel'],
    'Pharmacies': ['صيدلية', 'pharmacy', 'صيدليات', 'dermanxane'],
    'Hospitals': ['مستشفى', 'hospital', 'hospitals', 'nosxane'],
    'Schools': ['مدرسة', 'school', 'schools', 'mekteb'],
    'Universities': ['جامعة', 'university', 'universities', 'zanku'],
    'Cafes': ['مقهى', 'cafe', 'coffee', 'maqha', 'qehwe'],
    'Banks': ['مصرف', 'bank', 'بنك', 'banks', 'bonk'],
    'Markets': ['سوق', 'market', 'markets', 'bazar'],
    'Bakeries': ['مخبز', 'bakery', 'bread', 'nan'],
    'Bookstores': ['مكتبة', 'bookstore', 'library', 'books', 'kutubxane'],
    'Clinics': ['عيادة', 'clinic', 'clinics', 'tibb'],
    'Mobile Shops': ['موبايل', 'mobile', 'phone', 'telecom'],
    'Car Dealers': ['سيارات', 'car', 'auto', 'dealership', 'seyyare'],
    'Grocery Stores': ['بقالة', 'grocery', 'supermarket', 'market'],
  };

  // Check if category matches known categories
  const normalizedInput = category.toLowerCase().trim();

  for (const [standardCategory, keywords] of Object.entries(categoryKeywords)) {
    if (normalizedInput.includes(standardCategory.toLowerCase())) {
      return standardCategory;
    }

    for (const keyword of keywords) {
      if (normalizedInput.includes(keyword.toLowerCase()) ||
          name.toLowerCase().includes(keyword.toLowerCase())) {
        return standardCategory;
      }
    }
  }

  return category; // Return original if no match
}

// ============================================
// Geocoding (Nominatim)
// ============================================

interface GeocodeResult {
  found: boolean;
  lat?: number;
  lon?: number;
  display_name?: string;
}

async function geocodeAddress(
  address: string,
  city: string,
  governorate: string
): Promise<GeocodeResult> {
  try {
    const searchQuery = `${address}, ${city}, ${governorate}, Iraq`;
    const encodedQuery = encodeURIComponent(searchQuery);

    // Nominatim API with User-Agent (required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'IraqCompass-Agent-System/1.0',
        },
      }
    );

    if (!response.ok) {
      return { found: false };
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        found: true,
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    }

    return { found: false };
  } catch (error) {
    console.error('[Enricher] Geocoding error:', error);
    return { found: false };
  }
}

// ============================================
// Confidence Calculation
// ============================================

interface ConfidenceFactors {
  hasPhone: boolean;
  hasAddress: boolean;
  hasCategory: boolean;
  phoneValid: boolean;
  fromGoogleMaps: boolean;
  issues: number;
}

function calculateConfidence(factors: ConfidenceFactors): number {
  let score = 0.5; // Base score

  if (factors.hasPhone) score += 0.15;
  if (factors.phoneValid) score += 0.15;
  if (factors.hasAddress) score += 0.1;
  if (factors.hasCategory) score += 0.1;
  if (factors.fromGoogleMaps) score += 0.15;

  // Deduct for issues
  score -= factors.issues * 0.1;

  // Cap at 0-1
  return Math.max(0, Math.min(1, score));
}
