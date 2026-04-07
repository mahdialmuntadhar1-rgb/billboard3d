import { SupabaseClient } from '@supabase/supabase-js';
import { SourceType, ScrapeResult, ScraperConfig } from '../types';

// ============================================
// Multi-Source Scraper
// ============================================

export async function scrapeFromMultipleSources(
  supabase: SupabaseClient,
  governorate: string,
  category: string,
  source: SourceType,
  jobId: string
): Promise<number> {
  const results: ScrapeResult[] = [];

  try {
    switch (source) {
      case 'google_maps':
        const mapsResults = await scrapeGoogleMaps(governorate, category);
        results.push(...mapsResults.map(r => ({
          ...r,
          source: 'google_maps' as SourceType,
          confidence: 0.9
        })));
        break;

      case 'web_scrape':
        const webResults = await scrapeLocalWebsites(governorate, category);
        results.push(...webResults.map(r => ({
          ...r,
          source: 'web_scrape' as SourceType,
          confidence: 0.6
        })));
        break;

      case 'local_directory':
        const dirResults = await scrapeLocalDirectories(governorate, category);
        results.push(...dirResults.map(r => ({
          ...r,
          source: 'directory' as SourceType,
          confidence: 0.7
        })));
        break;

      default:
        console.warn(`Unknown source type: ${source}`);
    }

    // Batch insert to staging table
    if (results.length > 0) {
      await batchInsertToStaging(supabase, results, jobId, governorate, category);
    }

    console.log(`[Scraper] Scraped ${results.length} records from ${source} for ${category} in ${governorate}`);
    return results.length;

  } catch (error) {
    console.error(`[Scraper] Error scraping from ${source}:`, error);
    throw error;
  }
}

// ============================================
// Google Maps Scraper
// ============================================

async function scrapeGoogleMaps(
  governorate: string,
  category: string
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  try {
    // In production, this would use Google Places API
    // For now, returning stub data structure
    const searchQuery = `${category} in ${governorate}, Iraq`;

    // NOTE: Replace with actual Google Places API call
    // const response = await fetch(
    //   `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`
    // );
    // const data = await response.json();

    // Stub results for demonstration
    const stubResults = generateStubResults(governorate, category, 'google_maps');
    results.push(...stubResults);

    // Rate limiting - Google Maps API has quotas
    await sleep(1000);

  } catch (error) {
    console.error('[GoogleMaps] Error:', error);
  }

  return results;
}

// ============================================
// Web Scraper
// ============================================

async function scrapeLocalWebsites(
  governorate: string,
  category: string
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  try {
    // List of known Iraqi business directories and websites
    const targetSites = getTargetSitesForGovernorate(governorate, category);

    for (const site of targetSites) {
      try {
        // In production, this would use a scraping service or puppeteer
        // For now, returning stub data
        const siteResults = await scrapeWebsite(site, governorate, category);
        results.push(...siteResults);

        // Rate limiting between requests
        await sleep(2000);
      } catch (err) {
        console.warn(`[WebScraper] Failed to scrape ${site}:`, err);
      }
    }
  } catch (error) {
    console.error('[WebScraper] Error:', error);
  }

  return results;
}

async function scrapeWebsite(
  url: string,
  governorate: string,
  category: string
): Promise<ScrapeResult[]> {
  // Placeholder for actual web scraping logic
  // In production, this would:
  // 1. Fetch the page
  // 2. Parse HTML with cheerio or similar
  // 3. Extract business data
  // 4. Return structured results

  return generateStubResults(governorate, category, 'web_scrape', 3);
}

// ============================================
// Local Directory Scraper
// ============================================

async function scrapeLocalDirectories(
  governorate: string,
  category: string
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  try {
    // Known Iraqi business directories
    const directories = [
      'iraq-business.com',
      'baghdad-directory.iq',
      'basra-business.net',
    ];

    for (const dir of directories) {
      const dirResults = await scrapeDirectory(dir, governorate, category);
      results.push(...dirResults);
      await sleep(1500);
    }
  } catch (error) {
    console.error('[DirectoryScraper] Error:', error);
  }

  return results;
}

async function scrapeDirectory(
  directory: string,
  governorate: string,
  category: string
): Promise<ScrapeResult[]> {
  // Placeholder for directory scraping
  return generateStubResults(governorate, category, 'directory', 2);
}

// ============================================
// Helper Functions
// ============================================

function getTargetSitesForGovernorate(governorate: string, category: string): string[] {
  const siteMap: Record<string, string[]> = {
    'Baghdad': [
      'https://baghdad-business.com',
      'https://iraq-business-directory.com/baghdad',
    ],
    'Basra': [
      'https://basra-business.net',
      'https://southern-iraq-business.com',
    ],
    'Erbil': [
      'https://kurdistan-business.com/erbil',
      'https://erbil-directory.com',
    ],
    'Mosul': [
      'https://ninawa-business.com',
      'https://mosul-directory.iq',
    ],
  };

  return siteMap[governorate] || ['https://iraq-business-directory.com'];
}

function generateStubResults(
  governorate: string,
  category: string,
  source: string,
  count: number = 5
): ScrapeResult[] {
  const results: ScrapeResult[] = [];
  const arabicNames = [
    'المطعم الشرقي',
    'مقهى النخيل',
    'فندق الفرات',
    'صيدلية العافية',
    'مكتبة دار العلم',
    'مطعم بابل',
    'سوق الزيتون',
    'مخبز الصمون العراقي',
  ];

  const kurdishNames = [
    'Restoran Nawêm',
    'Kafiya Cihû',
    'Otelê Hewlêr',
    'Dermanxaneya Sihat',
    'Kutubxaneya Zanist',
  ];

  const cities: Record<string, string[]> = {
    'Baghdad': ['Al-Kadhimiya', 'Al-Mansour', 'Al-Karada', 'Sadr City'],
    'Basra': ['Basra City', 'Abu Al-Khaseeb', 'Al-Faw'],
    'Erbil': ['Erbil City', 'Ankawa', 'Mamostayan'],
    'Mosul': ['Mosul City', 'Hamdaniya', 'Tilkaif'],
    'Najaf': ['Najaf City', 'Kufa'],
    'Karbala': ['Karbala City'],
  };

  const citiesList = cities[governorate] || ['City Center'];

  for (let i = 0; i < count; i++) {
    const useArabic = Math.random() > 0.3;
    const useKurdish = !useArabic && Math.random() > 0.5;
    const name = useArabic
      ? arabicNames[Math.floor(Math.random() * arabicNames.length)]
      : useKurdish
        ? kurdishNames[Math.floor(Math.random() * kurdishNames.length)]
        : `${category} Business ${i + 1}`;

    const city = citiesList[Math.floor(Math.random() * citiesList.length)];

    results.push({
      name,
      phone: generateIraqiPhone(),
      whatsapp: Math.random() > 0.3 ? generateIraqiPhone() : undefined,
      category,
      governorate,
      city,
      address: `${city}, ${governorate}`,
      source_url: `https://${source}.example.com/business-${i}`,
    });
  }

  return results;
}

function generateIraqiPhone(): string {
  const prefixes = ['077', '078', '079', '075', '076', '074'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `+964${prefix.substring(1)}${suffix}`;
}

async function batchInsertToStaging(
  supabase: SupabaseClient,
  results: ScrapeResult[],
  jobId: string,
  governorate: string,
  category: string
): Promise<void> {
  const batchSize = 100;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    const stagingRecords = batch.map(r => ({
      job_id: jobId,
      name: r.name,
      phone: r.phone || null,
      whatsapp: r.whatsapp || null,
      category: r.category,
      governorate: r.governorate,
      city: r.city || null,
      address: r.address || null,
      source: r.source || 'web_scrape',
      source_url: r.source_url || null,
      confidence: r.raw_data?.confidence || 0.6,
      pipeline_stage: 'SCRAPED',
      enrichment_issues: [],
      is_duplicate_candidate: false,
      ai_verified: false,
      verified_via: [],
    }));

    const { error } = await supabase
      .from('business_records_staging')
      .insert(stagingRecords);

    if (error) {
      console.error('[Scraper] Error inserting batch:', error);
      throw error;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Scraper Configuration
// ============================================

export function getScraperConfig(
  governorate: string,
  category: string,
  source: SourceType
): ScraperConfig {
  return {
    governorate,
    category,
    source,
    rateLimitMs: source === 'google_maps' ? 1000 : 2000,
    maxResults: source === 'google_maps' ? 60 : 100,
  };
}
