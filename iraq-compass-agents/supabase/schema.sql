-- Iraq Compass Production Agent System - Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- Table 1: agents - Main agent registry
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  governorate TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'COMPLETED')),
  current_checkpoint TEXT CHECK (current_checkpoint IN ('SCRAPING', 'ENRICHING', 'REVIEWING', 'PUSHING', 'IDLE')),
  total_records INT DEFAULT 0,
  scrape_count INT DEFAULT 0,
  enrich_count INT DEFAULT 0,
  review_count INT DEFAULT 0,
  push_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_governorate ON agents(governorate);

-- ============================================
-- Table 2: agent_jobs - Individual job tracking
-- ============================================
CREATE TABLE IF NOT EXISTS agent_jobs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  governorate TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_maps', 'web_scrape', 'local_directory', 'verification')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_scraped INT DEFAULT 0,
  records_enriched INT DEFAULT 0,
  records_reviewed INT DEFAULT 0,
  records_pushed INT DEFAULT 0,
  error_message TEXT,
  progress_pct FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent_id ON agent_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status);

-- ============================================
-- Table 3: agent_checkpoints - CRITICAL for resume
-- ============================================
CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES agent_jobs(id) ON DELETE CASCADE,
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('SCRAPED', 'ENRICHED', 'REVIEWED', 'CLEANED', 'READY_FOR_PUSH')),
  record_ids TEXT[] DEFAULT '{}',
  checkpoint_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(job_id, checkpoint_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_job_id ON agent_checkpoints(job_id);
CREATE INDEX IF NOT EXISTS idx_agent_checkpoints_agent_id ON agent_checkpoints(agent_id);

-- ============================================
-- Table 4: business_records_staging - Before dedup
-- ============================================
CREATE TABLE IF NOT EXISTS business_records_staging (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_id TEXT NOT NULL REFERENCES agent_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_ku TEXT,
  phone TEXT,
  phone_formatted TEXT,
  has_phone BOOLEAN DEFAULT FALSE,
  whatsapp TEXT,
  category TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT,
  address TEXT,
  language TEXT CHECK (language IN ('ar', 'ku', 'en')),
  source TEXT NOT NULL CHECK (source IN ('google_maps', 'web_scrape', 'directory')),
  source_url TEXT,
  confidence FLOAT DEFAULT 0,
  enrichment_issues TEXT[] DEFAULT '{}',
  is_duplicate_candidate BOOLEAN DEFAULT FALSE,
  duplicate_of TEXT,
  reviewed_by TEXT,
  review_status TEXT CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_EDIT')),
  review_notes TEXT,
  ai_confidence FLOAT DEFAULT 0,
  ai_verified BOOLEAN DEFAULT FALSE,
  verified_via TEXT[] DEFAULT '{}',
  pipeline_stage TEXT NOT NULL CHECK (pipeline_stage IN ('SCRAPED', 'ENRICHED', 'REVIEWED', 'CLEANED', 'READY_FOR_PUSH')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staging_job_id ON business_records_staging(job_id);
CREATE INDEX IF NOT EXISTS idx_staging_pipeline_stage ON business_records_staging(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_staging_governorate ON business_records_staging(governorate);
CREATE INDEX IF NOT EXISTS idx_staging_category ON business_records_staging(category);
CREATE INDEX IF NOT EXISTS idx_staging_review_status ON business_records_staging(review_status);
CREATE INDEX IF NOT EXISTS idx_staging_is_duplicate ON business_records_staging(is_duplicate_candidate);

-- Full-text search on name
CREATE INDEX IF NOT EXISTS idx_staging_name_trgm ON business_records_staging USING gin (name gin_trgm_ops);

-- ============================================
-- Table 5: business_records_deduplicated - After dedup check
-- ============================================
CREATE TABLE IF NOT EXISTS business_records_deduplicated (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  staging_id TEXT NOT NULL REFERENCES business_records_staging(id) ON DELETE CASCADE,
  merged_from TEXT[] DEFAULT '{}',
  is_new BOOLEAN NOT NULL,
  existing_record_id TEXT,
  dedup_confidence FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dedup_staging_id ON business_records_deduplicated(staging_id);
CREATE INDEX IF NOT EXISTS idx_dedup_is_new ON business_records_deduplicated(is_new);

-- ============================================
-- Table 6: business_records_production - FINAL LIVE DATA
-- ============================================
CREATE TABLE IF NOT EXISTS business_records_production (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_ku TEXT,
  phone TEXT,
  has_phone BOOLEAN DEFAULT FALSE,
  phone_category TEXT CHECK (phone_category IN ('whatsapp_only', 'phone_only', 'both', 'none')),
  whatsapp TEXT,
  category TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT,
  address TEXT,
  language TEXT CHECK (language IN ('ar', 'ku', 'en')),
  sources TEXT[] DEFAULT '{}',
  source_urls TEXT[] DEFAULT '{}',
  confidence_final FLOAT DEFAULT 0,
  verified_via TEXT[] DEFAULT '{}',
  pushed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_governorate ON business_records_production(governorate);
CREATE INDEX IF NOT EXISTS idx_production_category ON business_records_production(category);
CREATE INDEX IF NOT EXISTS idx_production_phone ON business_records_production(phone);
CREATE INDEX IF NOT EXISTS idx_production_phone_category ON business_records_production(phone_category);
CREATE INDEX IF NOT EXISTS idx_production_language ON business_records_production(language);
CREATE INDEX IF NOT EXISTS idx_production_name_trgm ON business_records_production USING gin (name gin_trgm_ops);

-- ============================================
-- Table 7: export_logs - Track all exports
-- ============================================
CREATE TABLE IF NOT EXISTS export_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'excel')),
  filters JSONB DEFAULT '{}',
  record_count INT DEFAULT 0,
  file_url TEXT,
  encoding TEXT DEFAULT 'utf8',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON export_logs(created_at);

-- ============================================
-- Helper Functions
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staging_updated_at BEFORE UPDATE ON business_records_staging
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable pg_trgm extension for fuzzy matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Row Level Security Policies (optional, enable as needed)
-- ============================================

-- Enable RLS on tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_records_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_records_production ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (worker)
CREATE POLICY allow_service_role ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_service_role ON agent_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_service_role ON business_records_staging FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_service_role ON business_records_production FOR ALL USING (true) WITH CHECK (true);
