import { supabase, Business } from '../services/supabase';

// Phone selection logic with preferred order
export function selectBestPhone(business: Business): { phone: string; field: string } | null {
  // Preferred order: whatsapp > phone_1 > phone_2
  const phones = [
    { value: business.whatsapp, field: 'whatsapp' },
    { value: business.phone_1, field: 'phone_1' },
    { value: business.phone_2, field: 'phone_2' }
  ];

  for (const { value, field } of phones) {
    if (value && value.trim() && isValidPhone(value.trim())) {
      return { phone: value.trim(), field };
    }
  }

  return null;
}

// Basic phone validation - more lenient for real-world data
function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove common formatting characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
  
  // Skip obviously invalid numbers
  if (cleanPhone.length < 10) return false;
  if (cleanPhone === '1234567890' || cleanPhone === '0000000000') return false;
  
  // Iraqi phone patterns - more lenient
  const iraqiPatterns = [
    /^\+9647\d{8,9}$/,  // +9647xxxxxxxx
    /^07\d{9}$/,        // 07xxxxxxxxx
    /^\+96478\d{7,8}$/, // +96478xxxxxxx
    /^\+96479\d{7,8}$/, // +96479xxxxxxx
    /^\+96475\d{7,8}$/, // +96475xxxxxxx
    /^078\d{8}$/,       // 078xxxxxxxx
    /^079\d{8}$/,       // 079xxxxxxxx
    /^075\d{8}$/        // 075xxxxxxxx
  ];
  
  // General international pattern
  const generalPattern = /^\+\d{10,15}$/;
  
  // Check if it matches any valid pattern
  const isValid = iraqiPatterns.some(pattern => pattern.test(cleanPhone)) || 
                  generalPattern.test(cleanPhone);
  
  // Log validation attempts for debugging
  if (!isValid && cleanPhone.length >= 10) {
    console.log(`[businesses] Phone validation failed: ${phone} -> ${cleanPhone}`);
  }
  
  return isValid;
}

// Fetch businesses with filters
export async function fetchTargetBusinesses(filters: {
  governorate?: string;
  city?: string;
  category?: string;
  status?: string;
}): Promise<{ businesses: Business[]; total: number; withValidPhones: number; withoutValidPhones: number }> {
  try {
    console.log('[businesses] Fetching businesses with filters:', filters);

    let query = supabase
      .from('businesses')
      .select('*')
      .eq('status', filters.status || 'approved');

    // Apply filters
    if (filters.governorate) {
      query = query.eq('governorate', filters.governorate);
    }
    if (filters.city) {
      query = query.eq('city', filters.city);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data: businesses, error, count } = await query;

    if (error) {
      console.error('[businesses] Database error:', error);
      throw error;
    }

    console.log(`[businesses] Found ${businesses?.length || 0} businesses (total: ${count || 0})`);

    // Analyze phone availability
    let withValidPhones = 0;
    let withoutValidPhones = 0;
    const businessesWithPhones: Business[] = [];

    for (const business of businesses || []) {
      const phoneInfo = selectBestPhone(business);
      if (phoneInfo) {
        withValidPhones++;
        businessesWithPhones.push(business);
      } else {
        withoutValidPhones++;
        console.log(`[businesses] Skipping business ${business.business_name} - no valid phone found`);
      }
    }

    console.log(`[businesses] Phone analysis: ${withValidPhones} with valid phones, ${withoutValidPhones} without`);

    return {
      businesses: businessesWithPhones,
      total: count || 0,
      withValidPhones,
      withoutValidPhones
    };

  } catch (error) {
    console.error('[businesses] Failed to fetch businesses:', error);
    throw error;
  }
}

// Get business statistics without fetching all data
export async function getBusinessStats(filters: {
  governorate?: string;
  city?: string;
  category?: string;
  status?: string;
}): Promise<{ total: number; withValidPhones: number; withoutValidPhones: number }> {
  try {
    console.log('[businesses] Getting stats with filters:', filters);

    let query = supabase
      .from('businesses')
      .select('phone_1, phone_2, whatsapp', { count: 'exact', head: true })
      .eq('status', filters.status || 'approved');

    // Apply filters
    if (filters.governorate) {
      query = query.eq('governorate', filters.governorate);
    }
    if (filters.city) {
      query = query.eq('city', filters.city);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // First get total count
    const { count: total, error: countError } = await query;
    if (countError) throw countError;

    // For phone analysis, we need to fetch a sample or all records
    // For now, fetch all to get accurate stats (can be optimized later)
    const { data: businesses, error: dataError } = await supabase
      .from('businesses')
      .select('phone_1, phone_2, whatsapp')
      .eq('status', filters.status || 'approved');

    if (dataError) throw dataError;

    let withValidPhones = 0;
    let withoutValidPhones = 0;

    for (const business of businesses || []) {
      const phoneInfo = selectBestPhone(business as Business);
      if (phoneInfo) {
        withValidPhones++;
      } else {
        withoutValidPhones++;
      }
    }

    console.log(`[businesses] Stats: ${total} total, ${withValidPhones} with phones, ${withoutValidPhones} without`);

    return {
      total: total || 0,
      withValidPhones,
      withoutValidPhones
    };

  } catch (error) {
    console.error('[businesses] Failed to get stats:', error);
    throw error;
  }
}

// Get unique values for filters
export async function getFilterOptions(): Promise<{
  governorates: string[];
  cities: string[];
  categories: string[];
}> {
  try {
    // Fetch all businesses and extract unique values
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('governorate, city, category')
      .eq('status', 'approved');

    if (error) throw error;

    const extractUnique = (data: any[], field: string) => {
      const values = data?.map(item => item[field]).filter(Boolean) || [];
      return values.filter((value, index) => values.indexOf(value) === index).sort();
    };

    return {
      governorates: extractUnique(businesses, 'governorate'),
      cities: extractUnique(businesses, 'city'),
      categories: extractUnique(businesses, 'category')
    };

  } catch (error) {
    console.error('[businesses] Failed to get filter options:', error);
    return {
      governorates: [],
      cities: [],
      categories: []
    };
  }
}
