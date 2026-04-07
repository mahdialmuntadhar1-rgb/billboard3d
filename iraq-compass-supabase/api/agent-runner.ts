// Simplified Agent Runner for Vercel Functions
// Supabase-only architecture - NO Cloudflare, NO Durable Objects

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Types matching your existing schema
interface AgentConfig {
  governorate: string;
  category: string;
  sources: string[];
}

interface Checkpoint {
  stage: 'SCRAPED' | 'ENRICHED' | 'REVIEWED' | 'CLEANED' | 'READY_FOR_PUSH' | 'PUSHED';
  recordIds: string[];
  timestamp: string;
  stats: {
    scraped: number;
    enriched: number;
    reviewed: number;
    cleaned: number;
    pushed: number;
  };
}

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Main Agent Runner - Called by GitHub Actions or Dashboard
 * GET /api/agent-runner?governorate=Baghdad&category=Restaurants
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { governorate, category, sources = 'google_maps,web_scrape' } = req.query;
    
    if (!governorate || !category) {
      return res.status(400).json({ 
        error: 'Missing required params: governorate, category' 
      });
    }

    const sourceList = (sources as string).split(',');
    
    // 1. Create or get agent
    const agentId = await getOrCreateAgent(governorate as string, category as string);
    
    // 2. Create job
    const jobId = await createJob(agentId, governorate as string, category as string, sourceList);
    
    // 3. Check for existing checkpoint (resume capability)
    const checkpoint = await getLastCheckpoint(jobId);
    
    // 4. Run pipeline from checkpoint (or from beginning)
    const result = await runPipeline(
      jobId, 
      governorate as string, 
      category as string, 
      sourceList,
      checkpoint
    );

    return res.status(200).json({
      success: true,
      agentId,
      jobId,
      governorate,
      category,
      checkpoint: result.currentStage,
      recordsProcessed: result.recordsProcessed,
      recordsTotal: result.recordsTotal,
      completed: result.completed,
      message: result.completed 
        ? 'Pipeline completed successfully' 
        : `Pipeline paused at ${result.currentStage}. Will resume on next run.`
    });

  } catch (error) {
    console.error('[AgentRunner] Error:', error);
    return res.status(500).json({
      error: 'Agent runner failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Run the 6-stage pipeline with checkpointing
 */
async function runPipeline(
  jobId: string,
  governorate: string,
  category: string,
  sources: string[],
  lastCheckpoint: Checkpoint | null
): Promise<{ currentStage: string; recordsProcessed: number; recordsTotal: number; completed: boolean }> {
  
  const stages = ['SCRAPED', 'ENRICHED', 'REVIEWED', 'CLEANED', 'READY_FOR_PUSH', 'PUSHED'];
  
  // Determine starting stage
  let currentStageIndex = 0;
  if (lastCheckpoint) {
    const lastIndex = stages.indexOf(lastCheckpoint.stage);
    currentStageIndex = lastIndex + 1; // Resume from next stage
    console.log(`[Pipeline] Resuming from stage: ${stages[currentStageIndex]}`);
  }

  const stats = {
    scraped: 0,
    enriched: 0,
    reviewed: 0,
    cleaned: 0,
    pushed: 0
  };

  // Stage 1: SCRAPING (if needed)
  if (currentStageIndex <= 0) {
    console.log(`[Pipeline] Stage 1: Scraping ${governorate} - ${category}`);
    stats.scraped = await scrapeStage(jobId, governorate, category, sources);
    await saveCheckpoint(jobId, 'SCRAPED', [], stats);
    currentStageIndex = 1;
  } else {
    stats.scraped = lastCheckpoint?.stats.scraped || 0;
  }

  // Stage 2: ENRICHING (if needed)
  if (currentStageIndex <= 1) {
    console.log(`[Pipeline] Stage 2: Enriching records`);
    stats.enriched = await enrichStage(jobId);
    await saveCheckpoint(jobId, 'ENRICHED', [], stats);
    currentStageIndex = 2;
  } else {
    stats.enriched = lastCheckpoint?.stats.enriched || 0;
  }

  // Stage 3: REVIEW (if needed)
  if (currentStageIndex <= 2) {
    console.log(`[Pipeline] Stage 3: Reviewing low-confidence records`);
    stats.reviewed = await reviewStage(jobId);
    await saveCheckpoint(jobId, 'REVIEWED', [], stats);
    currentStageIndex = 3;
  } else {
    stats.reviewed = lastCheckpoint?.stats.reviewed || 0;
  }

  // Stage 4: AI VERIFY (if needed)
  if (currentStageIndex <= 3) {
    console.log(`[Pipeline] Stage 4: AI verification`);
    stats.cleaned = await verifyStage(jobId);
    await saveCheckpoint(jobId, 'CLEANED', [], stats);
    currentStageIndex = 4;
  } else {
    stats.cleaned = lastCheckpoint?.stats.cleaned || 0;
  }

  // Stage 5: DEDUPLICATE (if needed)
  if (currentStageIndex <= 4) {
    console.log(`[Pipeline] Stage 5: Deduplicating`);
    await deduplicateStage(jobId);
    await saveCheckpoint(jobId, 'READY_FOR_PUSH', [], stats);
    currentStageIndex = 5;
  }

  // Stage 6: PUSH TO PRODUCTION (if needed)
  if (currentStageIndex <= 5) {
    console.log(`[Pipeline] Stage 6: Pushing to production`);
    stats.pushed = await pushStage(jobId);
    await saveCheckpoint(jobId, 'PUSHED', [], stats);
    currentStageIndex = 6;
  }

  const totalRecords = stats.scraped;
  const completed = currentStageIndex >= 6;

  // Update job status
  await supabase.from('agent_jobs').update({
    status: completed ? 'COMPLETED' : 'RUNNING',
    completed_at: completed ? new Date().toISOString() : null,
    records_scraped: stats.scraped,
    records_enriched: stats.enriched,
    records_reviewed: stats.reviewed,
    records_pushed: stats.pushed,
    progress_pct: completed ? 100 : Math.round((currentStageIndex / 6) * 100)
  }).eq('id', jobId);

  return {
    currentStage: stages[Math.min(currentStageIndex, 5)],
    recordsProcessed: stats.pushed,
    recordsTotal: totalRecords,
    completed
  };
}

/**
 * Stage 1: Scrape from multiple sources
 */
async function scrapeStage(
  jobId: string, 
  governorate: string, 
  category: string, 
  sources: string[]
): Promise<number> {
  const results: any[] = [];

  for (const source of sources) {
    try {
      let sourceResults: any[] = [];
      
      if (source === 'google_maps') {
        sourceResults = await scrapeGoogleMaps(governorate, category);
      } else if (source === 'web_scrape') {
        sourceResults = await scrapeLocalWebsites(governorate, category);
      } else if (source === 'local_directory') {
        sourceResults = await scrapeLocalDirectories(governorate, category);
      }

      results.push(...sourceResults.map(r => ({
        ...r,
        source,
        job_id: jobId,
        pipeline_stage: 'SCRAPED',
        enrichment_issues: [],
        is_duplicate_candidate: false,
        ai_verified: false,
        verified_via: [],
        confidence: source === 'google_maps' ? 0.9 : 0.6,
        created_at: new Date().toISOString()
      })));
    } catch (err) {
      console.error(`[Scrape] Error from ${source}:`, err);
    }
  }

  // Batch insert to staging
  if (results.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await supabase.from('business_records_staging').insert(batch);
    }
  }

  return results.length;
}

/**
 * Stage 2: Enrich records (phone parsing, language detection, etc.)
 */
async function enrichStage(jobId: string): Promise<number> {
  // Get scraped records
  const { data: records } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'SCRAPED');

  if (!records || records.length === 0) return 0;

  for (const record of records) {
    const updates: any = {
      pipeline_stage: 'ENRICHED',
      updated_at: new Date().toISOString()
    };

    // Parse phone
    if (record.phone) {
      const phoneData = parseIraqiPhone(record.phone);
      updates.phone_formatted = phoneData.formatted;
      updates.has_phone = phoneData.has_phone;
      updates.phone_category = detectPhoneCategory(record.phone, record.whatsapp);
    }

    // Detect language
    updates.language = detectLanguage(record.name);
    if (updates.language === 'ar') updates.name_ar = record.name;
    if (updates.language === 'ku') updates.name_ku = record.name;

    // Calculate confidence
    updates.confidence = calculateConfidence({
      hasPhone: updates.has_phone,
      hasAddress: !!record.address,
      hasCategory: !!record.category,
      phoneValid: !!updates.phone_formatted,
      fromGoogleMaps: record.source === 'google_maps'
    });

    await supabase.from('business_records_staging')
      .update(updates)
      .eq('id', record.id);
  }

  return records.length;
}

/**
 * Stage 3: Review low-confidence records
 */
async function reviewStage(jobId: string): Promise<number> {
  // Flag low-confidence for human review
  const { data: lowConfidence } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'ENRICHED')
    .lt('confidence', 0.7);

  // Mark low-confidence as needing review
  if (lowConfidence && lowConfidence.length > 0) {
    await supabase.from('business_records_staging')
      .update({
        pipeline_stage: 'REVIEWED',
        review_status: 'PENDING'
      })
      .in('id', lowConfidence.map(r => r.id));
  }

  // Auto-approve high-confidence
  await supabase.from('business_records_staging')
    .update({
      pipeline_stage: 'REVIEWED',
      review_status: 'APPROVED'
    })
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'ENRICHED')
    .gte('confidence', 0.7);

  const { data: all } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'REVIEWED');

  return all?.length || 0;
}

/**
 * Stage 4: AI Verification
 */
async function verifyStage(jobId: string): Promise<number> {
  const { data: records } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('review_status', 'APPROVED');

  if (!records) return 0;

  for (const record of records) {
    // Cross-check with Wikidata, Google Maps, etc.
    const verifiedVia: string[] = [];
    
    // Simple verification logic (expand as needed)
    if (record.source === 'google_maps') verifiedVia.push('google_maps');
    if (record.confidence > 0.8) verifiedVia.push('high_confidence');

    await supabase.from('business_records_staging')
      .update({
        pipeline_stage: 'CLEANED',
        ai_verified: verifiedVia.length > 0,
        ai_confidence: verifiedVia.length > 0 ? 0.9 : 0.5,
        verified_via: verifiedVia
      })
      .eq('id', record.id);
  }

  return records.length;
}

/**
 * Stage 5: Deduplicate against production
 */
async function deduplicateStage(jobId: string): Promise<void> {
  const { data: records } = await supabase
    .from('business_records_staging')
    .select('*')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'CLEANED');

  if (!records) return;

  for (const record of records) {
    // Check for exact duplicate (phone + governorate)
    const { data: exactMatch } = await supabase
      .from('business_records_production')
      .select('id')
      .eq('phone', record.phone_formatted)
      .eq('governorate', record.governorate)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      // Mark as duplicate
      await supabase.from('business_records_staging')
        .update({
          is_duplicate_candidate: true,
          duplicate_of: exactMatch[0].id,
          pipeline_stage: 'READY_FOR_PUSH'
        })
        .eq('id', record.id);
      
      await supabase.from('business_records_deduplicated').insert({
        staging_id: record.id,
        is_new: false,
        existing_record_id: exactMatch[0].id,
        dedup_confidence: 0.99
      });
    } else {
      // Mark as new
      await supabase.from('business_records_staging')
        .update({ pipeline_stage: 'READY_FOR_PUSH' })
        .eq('id', record.id);
      
      await supabase.from('business_records_deduplicated').insert({
        staging_id: record.id,
        is_new: true,
        dedup_confidence: 0.99
      });
    }
  }
}

/**
 * Stage 6: Push to production
 */
async function pushStage(jobId: string): Promise<number> {
  // Get new records ready to push
  const { data: newRecords } = await supabase
    .from('business_records_staging')
    .select('*, dedup:business_records_deduplicated(is_new)')
    .eq('job_id', jobId)
    .eq('pipeline_stage', 'READY_FOR_PUSH');

  if (!newRecords) return 0;

  const toPush = newRecords.filter((r: any) => r.dedup?.[0]?.is_new === true);

  if (toPush.length === 0) return 0;

  // Transform for production
  const productionRecords = toPush.map((r: any) => ({
    id: r.id,
    name: r.name,
    name_ar: r.name_ar,
    name_ku: r.name_ku,
    phone: r.phone_formatted,
    has_phone: r.has_phone,
    phone_category: r.phone_category,
    whatsapp: r.whatsapp,
    category: r.category,
    governorate: r.governorate,
    city: r.city,
    address: r.address,
    language: r.language,
    sources: [r.source],
    source_urls: r.source_url ? [r.source_url] : [],
    confidence_final: r.confidence,
    verified_via: r.verified_via || [],
    pushed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }));

  // Batch insert
  const batchSize = 100;
  let pushed = 0;
  for (let i = 0; i < productionRecords.length; i += batchSize) {
    const batch = productionRecords.slice(i, i + batchSize);
    const { error } = await supabase.from('business_records_production').insert(batch);
    if (!error) pushed += batch.length;
  }

  return pushed;
}

// Helper functions
async function getOrCreateAgent(governorate: string, category: string): Promise<string> {
  const agentId = `agent-${governorate.toLowerCase().replace(/\s+/g, '-')}-${category.toLowerCase().replace(/\s+/g, '-')}`;
  
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .single();

  if (!existing) {
    await supabase.from('agents').insert({
      id: agentId,
      governorate,
      category,
      status: 'IDLE',
      created_at: new Date().toISOString()
    });
  }

  return agentId;
}

async function createJob(agentId: string, governorate: string, category: string, sources: string[]): Promise<string> {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await supabase.from('agent_jobs').insert({
    id: jobId,
    agent_id: agentId,
    governorate,
    category,
    source_type: sources[0],
    status: 'RUNNING',
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  return jobId;
}

async function getLastCheckpoint(jobId: string): Promise<Checkpoint | null> {
  const { data } = await supabase
    .from('agent_checkpoints')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data ? {
    stage: data.checkpoint_type,
    recordIds: data.record_ids || [],
    timestamp: data.created_at,
    stats: data.checkpoint_data?.stats || {}
  } : null;
}

async function saveCheckpoint(
  jobId: string, 
  stage: string, 
  recordIds: string[],
  stats: any
): Promise<void> {
  const { data: job } = await supabase
    .from('agent_jobs')
    .select('agent_id')
    .eq('id', jobId)
    .single();

  await supabase.from('agent_checkpoints').insert({
    agent_id: job?.agent_id,
    job_id: jobId,
    checkpoint_type: stage,
    record_ids: recordIds,
    checkpoint_data: { stats },
    created_at: new Date().toISOString()
  });
}

// Stubs for scrapers (implement these in separate files)
async function scrapeGoogleMaps(governorate: string, category: string): Promise<any[]> {
  // TODO: Implement Google Maps API integration
  console.log(`[Scraper] Google Maps: ${governorate} - ${category}`);
  return generateStubResults(governorate, category, 'google_maps');
}

async function scrapeLocalWebsites(governorate: string, category: string): Promise<any[]> {
  // TODO: Implement web scraping
  console.log(`[Scraper] Local Websites: ${governorate} - ${category}`);
  return generateStubResults(governorate, category, 'web_scrape');
}

async function scrapeLocalDirectories(governorate: string, category: string): Promise<any[]> {
  // TODO: Implement directory scraping
  console.log(`[Scraper] Directories: ${governorate} - ${category}`);
  return generateStubResults(governorate, category, 'directory');
}

// Utility functions (implement properly)
function parseIraqiPhone(phone: string): { formatted: string | null; has_phone: boolean } {
  if (!phone) return { formatted: null, has_phone: false };
  
  // Basic Iraqi phone formatting
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+964')) {
    return { formatted: cleaned, has_phone: true };
  }
  if (cleaned.startsWith('0')) {
    return { formatted: '+964' + cleaned.substring(1), has_phone: true };
  }
  return { formatted: phone, has_phone: true };
}

function detectPhoneCategory(phone: string, whatsapp: string): string {
  const hasPhone = !!phone;
  const hasWhatsapp = !!whatsapp;
  
  if (hasPhone && hasWhatsapp) return 'both';
  if (hasPhone) return 'phone_only';
  if (hasWhatsapp) return 'whatsapp_only';
  return 'none';
}

function detectLanguage(text: string): 'ar' | 'ku' | 'en' {
  // Arabic regex
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Kurdish detection (simplified)
  if (text.toLowerCase().includes('kurd') || /[\u06A4\u06B5]/.test(text)) return 'ku';
  return 'en';
}

function calculateConfidence(factors: any): number {
  let score = 0.5;
  if (factors.hasPhone) score += 0.15;
  if (factors.phoneValid) score += 0.15;
  if (factors.hasAddress) score += 0.1;
  if (factors.fromGoogleMaps) score += 0.15;
  return Math.min(1, Math.max(0, score));
}

function generateStubResults(governorate: string, category: string, source: string): any[] {
  // Generate realistic stub data for testing
  const arabicNames = ['المطعم الشرقي', 'مقهى النخيل', 'فندق الفرات', 'صيدلية العافية'];
  const cities: Record<string, string[]> = {
    'Baghdad': ['Al-Kadhimiya', 'Al-Mansour'],
    'Erbil': ['Erbil City', 'Ankawa'],
    'Basra': ['Basra City', 'Abu Al-Khaseeb']
  };
  
  const citiesList = cities[governorate] || ['City Center'];
  
  return Array(5).fill(null).map((_, i) => ({
    name: arabicNames[i % arabicNames.length],
    phone: `+96477${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
    category,
    governorate,
    city: citiesList[i % citiesList.length],
    address: `${citiesList[i % citiesList.length]}, ${governorate}`,
    source
  }));
}
