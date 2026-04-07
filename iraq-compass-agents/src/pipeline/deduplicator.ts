import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRecordStaging, PushResponse } from '../types';

// ============================================
// Deduplication Pipeline Stage
// ============================================
// Prevents duplicates from being pushed to production

export async function deduplicateAgainstProduction(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  console.log(`[Deduplicator] Starting deduplication for job ${jobId}`);

  // Fetch records ready for deduplication
  const { data: stagingRecords, error: fetchError } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'CLEANED');

  if (fetchError) {
    console.error('[Deduplicator] Error fetching records:', fetchError);
    throw fetchError;
  }

  if (!stagingRecords || stagingRecords.length === 0) {
    console.log('[Deduplicator] No records to deduplicate');
    return;
  }

  console.log(`[Deduplicator] Checking ${stagingRecords.length} records for duplicates`);

  let newCount = 0;
  let duplicateCount = 0;

  for (const record of stagingRecords) {
    try {
      const dedupResult = await checkForDuplicates(supabase, record);

      if (dedupResult.isDuplicate) {
        // Mark as duplicate
        await supabase
          .from('business_records_staging')
          .update({
            is_duplicate_candidate: true,
            duplicate_of: dedupResult.existingRecordId,
            pipeline_stage: 'READY_FOR_PUSH',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        // Insert into deduplicated table as not new
        await supabase.from('business_records_deduplicated').insert({
          staging_id: record.id,
          merged_from: dedupResult.mergedFrom,
          is_new: false,
          existing_record_id: dedupResult.existingRecordId,
          dedup_confidence: dedupResult.confidence,
        });

        duplicateCount++;
      } else {
        // Mark as new
        await supabase
          .from('business_records_staging')
          .update({
            is_duplicate_candidate: false,
            duplicate_of: null,
            pipeline_stage: 'READY_FOR_PUSH',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        // Insert into deduplicated table as new
        await supabase.from('business_records_deduplicated').insert({
          staging_id: record.id,
          merged_from: [],
          is_new: true,
          existing_record_id: null,
          dedup_confidence: 0.99,
        });

        newCount++;
      }
    } catch (err) {
      console.error(`[Deduplicator] Error processing record ${record.id}:`, err);
    }
  }

  console.log(`[Deduplicator] Complete: ${newCount} new, ${duplicateCount} duplicates`);
}

// ============================================
// Duplicate Detection Logic
// ============================================

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingRecordId: string | null;
  confidence: number;
  mergedFrom: string[];
}

async function checkForDuplicates(
  supabase: SupabaseClient,
  record: BusinessRecordStaging
): Promise<DuplicateCheckResult> {
  // ============================================
  // Step 1: Exact Match (Phone + Governorate)
  // ============================================
  if (record.phone_formatted) {
    const { data: exactMatches } = await supabase
      .from('business_records_production')
      .select('id, name, phone, governorate')
      .eq('phone', record.phone_formatted)
      .eq('governorate', record.governorate)
      .limit(1);

    if (exactMatches && exactMatches.length > 0) {
      return {
        isDuplicate: true,
        existingRecordId: exactMatches[0].id,
        confidence: 0.99,
        mergedFrom: [exactMatches[0].id],
      };
    }
  }

  // ============================================
  // Step 2: Fuzzy Match (Name + City + Category)
  // ============================================
  const { data: similarRecords } = await supabase
    .from('business_records_production')
    .select('id, name, phone, governorate, city, category')
    .eq('governorate', record.governorate)
    .eq('city', record.city)
    .eq('category', record.category);

  if (similarRecords && similarRecords.length > 0) {
    for (const prod of similarRecords) {
      const similarity = calculateNameSimilarity(
        record.name.toLowerCase(),
        prod.name.toLowerCase()
      );

      if (similarity > 0.85) {
        return {
          isDuplicate: true,
          existingRecordId: prod.id,
          confidence: similarity,
          mergedFrom: [prod.id],
        };
      }
    }
  }

  // ============================================
  // Step 3: Phone Variation Match
  // ============================================
  if (record.phone) {
    const phoneVariations = generatePhoneVariations(record.phone);

    for (const variant of phoneVariations) {
      const { data: phoneMatches } = await supabase
        .from('business_records_production')
        .select('id')
        .ilike('phone', `%${variant}%`)
        .eq('governorate', record.governorate)
        .limit(1);

      if (phoneMatches && phoneMatches.length > 0) {
        return {
          isDuplicate: true,
          existingRecordId: phoneMatches[0].id,
          confidence: 0.9,
          mergedFrom: [phoneMatches[0].id],
        };
      }
    }
  }

  // ============================================
  // Step 4: Address Match (if available)
  // ============================================
  if (record.address && record.name) {
    const { data: addressMatches } = await supabase
      .from('business_records_production')
      .select('id, name, address')
      .eq('governorate', record.governorate)
      .eq('city', record.city)
      .ilike('address', `%${record.address.substring(0, 20)}%`);

    if (addressMatches && addressMatches.length > 0) {
      for (const match of addressMatches) {
        const nameSim = calculateNameSimilarity(
          record.name.toLowerCase(),
          match.name.toLowerCase()
        );

        if (nameSim > 0.7) {
          return {
            isDuplicate: true,
            existingRecordId: match.id,
            confidence: 0.75,
            mergedFrom: [match.id],
          };
        }
      }
    }
  }

  // No duplicate found
  return {
    isDuplicate: false,
    existingRecordId: null,
    confidence: 0.99,
    mergedFrom: [],
  };
}

// ============================================
// String Similarity Functions
// ============================================

function calculateNameSimilarity(str1: string, str2: string): number {
  // Levenshtein distance normalized by max length
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);

  if (maxLen === 0) return 1;

  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ============================================
// Phone Variation Generation
// ============================================

function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [];

  // Clean the phone number
  const cleaned = phone.replace(/[^\d+]/g, '');

  // +9647701234567
  variations.push(cleaned);

  // 9647701234567 (without +)
  if (cleaned.startsWith('+')) {
    variations.push(cleaned.substring(1));
  } else if (!cleaned.startsWith('964')) {
    variations.push('964' + cleaned.substring(1));
  }

  // 07701234567 (with leading 0)
  if (cleaned.startsWith('+964')) {
    variations.push('0' + cleaned.substring(4));
  } else if (cleaned.startsWith('964')) {
    variations.push('0' + cleaned.substring(3));
  }

  // Last 7 digits (for flexible matching)
  if (cleaned.length >= 7) {
    variations.push(cleaned.slice(-7));
  }

  return [...new Set(variations)];
}

// ============================================
// Production Push
// ============================================

export async function pushToProduction(
  supabase: SupabaseClient,
  jobId: string
): Promise<PushResponse> {
  console.log(`[Deduplicator] Pushing records to production for job ${jobId}`);

  // Get all records that are ready to push (not duplicates)
  const { data: readyToPush, error: fetchError } = await supabase
    .from('business_records_staging')
    .select('*, dedup:business_records_deduplicated(is_new)')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'READY_FOR_PUSH')
    .eq('business_records_deduplicated.is_new', true);

  if (fetchError) {
    console.error('[Deduplicator] Error fetching records for push:', fetchError);
    throw fetchError;
  }

  if (!readyToPush || readyToPush.length === 0) {
    console.log('[Deduplicator] No records to push');
    return { recordsInserted: 0, duplicatesSkipped: 0 };
  }

  // Filter to only new records
  const newRecords = readyToPush.filter(
    (r: Record<string, unknown>) => r.dedup?.[0]?.is_new === true
  );

  const duplicateCount = readyToPush.length - newRecords.length;

  console.log(`[Deduplicator] Pushing ${newRecords.length} records (${duplicateCount} duplicates skipped)`);

  // Batch insert to production
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < newRecords.length; i += batchSize) {
    const batch = newRecords.slice(i, i + batchSize);

    const productionRecords = batch.map((record: BusinessRecordStaging) => ({
      id: record.id,
      name: record.name,
      name_ar: record.name_ar,
      name_ku: record.name_ku,
      phone: record.phone_formatted,
      has_phone: record.has_phone,
      phone_category: record.phone_category,
      whatsapp: record.whatsapp,
      category: record.category,
      governorate: record.governorate,
      city: record.city,
      address: record.address,
      language: record.language,
      sources: [record.source],
      source_urls: record.source_url ? [record.source_url] : [],
      confidence_final: record.confidence,
      verified_via: record.verified_via || [],
      pushed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('business_records_production')
      .insert(productionRecords);

    if (insertError) {
      console.error('[Deduplicator] Error inserting batch:', insertError);
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`[Deduplicator] Successfully pushed ${insertedCount} records`);

  return {
    recordsInserted: insertedCount,
    duplicatesSkipped: duplicateCount,
  };
}
