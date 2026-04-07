// Iraq Compass Production Agent System - TypeScript Types

// ============================================
// Agent Types
// ============================================

export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'COMPLETED';
export type CheckpointType = 'SCRAPING' | 'ENRICHING' | 'REVIEWING' | 'PUSHING' | 'IDLE';
export type PipelineStage = 'SCRAPED' | 'ENRICHED' | 'REVIEWED' | 'CLEANED' | 'READY_FOR_PUSH';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type SourceType = 'google_maps' | 'web_scrape' | 'local_directory' | 'verification';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_EDIT';
export type PhoneCategory = 'whatsapp_only' | 'phone_only' | 'both' | 'none';
export type Language = 'ar' | 'ku' | 'en';

export interface Agent {
  id: string;
  governorate: string;
  category: string;
  status: AgentStatus;
  current_checkpoint: CheckpointType | null;
  total_records: number;
  scrape_count: number;
  enrich_count: number;
  review_count: number;
  push_count: number;
  error_count: number;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

export interface AgentJob {
  id: string;
  agent_id: string;
  governorate: string;
  category: string;
  source_type: SourceType;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  records_scraped: number;
  records_enriched: number;
  records_reviewed: number;
  records_pushed: number;
  error_message: string | null;
  progress_pct: number;
  created_at: string;
}

export interface AgentCheckpoint {
  id: string;
  agent_id: string;
  job_id: string | null;
  checkpoint_type: PipelineStage;
  record_ids: string[];
  checkpoint_data: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Business Record Types
// ============================================

export interface BusinessRecordStaging {
  id: string;
  job_id: string;
  name: string;
  name_ar: string | null;
  name_ku: string | null;
  phone: string | null;
  phone_formatted: string | null;
  has_phone: boolean;
  whatsapp: string | null;
  category: string;
  governorate: string;
  city: string | null;
  address: string | null;
  language: Language | null;
  source: SourceType;
  source_url: string | null;
  confidence: number;
  enrichment_issues: string[];
  is_duplicate_candidate: boolean;
  duplicate_of: string | null;
  reviewed_by: string | null;
  review_status: ReviewStatus | null;
  review_notes: string | null;
  ai_confidence: number;
  ai_verified: boolean;
  verified_via: string[];
  pipeline_stage: PipelineStage;
  created_at: string;
  updated_at: string;
}

export interface BusinessRecordDeduplicated {
  id: string;
  staging_id: string;
  merged_from: string[];
  is_new: boolean;
  existing_record_id: string | null;
  dedup_confidence: number;
  created_at: string;
}

export interface BusinessRecordProduction {
  id: string;
  name: string;
  name_ar: string | null;
  name_ku: string | null;
  phone: string | null;
  has_phone: boolean;
  phone_category: PhoneCategory | null;
  whatsapp: string | null;
  category: string;
  governorate: string;
  city: string | null;
  address: string | null;
  language: Language | null;
  sources: string[];
  source_urls: string[];
  confidence_final: number;
  verified_via: string[];
  pushed_at: string;
  created_at: string;
}

// ============================================
// Export Types
// ============================================

export type ExportType = 'csv' | 'excel';

export interface ExportFilters {
  governorate?: string;
  category?: string;
  phone_category?: PhoneCategory;
  language?: Language;
  city?: string;
}

export interface ExportLog {
  id: string;
  export_type: ExportType;
  filters: ExportFilters;
  record_count: number;
  file_url: string | null;
  encoding: string;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Phone Types
// ============================================

export interface PhoneData {
  raw: string;
  formatted: string;
  has_phone: boolean;
  has_whatsapp: boolean;
  phone_category: PhoneCategory;
  is_valid: boolean;
  country_code?: string;
  national_number?: string;
}

// ============================================
// Verification Types
// ============================================

export interface VerificationSource {
  found: boolean;
  confidence: number;
  url?: string;
  data?: Record<string, unknown>;
}

export interface VerificationResult {
  name: string;
  sources: {
    google_maps?: VerificationSource;
    web_scrape?: VerificationSource;
    directory?: VerificationSource;
    wikidata?: VerificationSource;
  };
  cross_source_confidence: number;
  verification_summary: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface StartAgentRequest {
  governorate: string;
  categories: string[];
  sources: SourceType[];
}

export interface StartAgentResponse {
  agentId: string;
  status: AgentStatus;
}

export interface AgentListResponse {
  agentId: string;
  governorate: string;
  status: AgentStatus;
  currentCheckpoint: CheckpointType | null;
  progressPct: number;
  recordsScraped: number;
  recordsPushed: number;
}

export interface AgentDetailResponse {
  agentId: string;
  governorate: string;
  status: AgentStatus;
  checkpoints: Array<{
    stage: PipelineStage;
    timestamp: string;
    recordCount: number;
  }>;
  currentProgress: {
    stage: PipelineStage | null;
    processed: number;
    total: number;
  };
}

export interface JobStatusResponse {
  jobId: string;
  stage: PipelineStage;
  progressPct: number;
  recordsProcessed: number;
  recordsTotal: number;
  nextCheckpoint: PipelineStage | null;
}

export interface ReviewQueueItem {
  recordId: string;
  name: string;
  confidence: number;
  enrichmentIssues: string[];
  source: SourceType;
  phone: string | null;
  language: Language | null;
  governorate: string;
  city: string | null;
  category: string;
}

export interface ApproveRecordRequest {
  recordId: string;
  reviewDecision: ReviewStatus;
  notes?: string;
}

export interface PushResponse {
  recordsInserted: number;
  duplicatesSkipped: number;
}

export interface HealthResponse {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  agentsRunning: number;
  jobsInProgress: number;
  lastHeartbeat: string;
}

// ============================================
// Durable Object Types
// ============================================

export interface AgentState {
  agentId: string;
  governorate: string;
  categories: string[];
  sources: SourceType[];
  status: AgentStatus;
  currentJobId: string | null;
  currentStage: PipelineStage | null;
  processedRecordIds: string[];
  totalRecords: number;
  lastCheckpoint: {
    stage: PipelineStage;
    timestamp: number;
    recordIds: string[];
  } | null;
}

export interface CheckpointData {
  stage: PipelineStage;
  recordIds: string[];
  timestamp: number;
  jobState: Record<string, unknown>;
}

// ============================================
// Scraper Types
// ============================================

export interface ScrapeResult {
  name: string;
  phone?: string;
  whatsapp?: string;
  category: string;
  governorate: string;
  city?: string;
  address?: string;
  source_url?: string;
  raw_data?: Record<string, unknown>;
}

export interface ScraperConfig {
  governorate: string;
  category: string;
  source: SourceType;
  rateLimitMs: number;
  maxResults: number;
}
