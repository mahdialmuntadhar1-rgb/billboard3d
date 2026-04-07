-- Create jobs table for tracking agent runs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  governorate TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  businesses_found INTEGER DEFAULT 0,
  businesses_saved INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_governorate ON jobs(governorate);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- Create staging_businesses table for immediate persistence
CREATE TABLE IF NOT EXISTS staging_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  governorate TEXT NOT NULL,
  requested_category TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'duplicate', 'rejected')),
  validation_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create final businesses table for approved data
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  governorate TEXT NOT NULL,
  requested_category TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  job_id UUID REFERENCES jobs(id),
  staging_id UUID REFERENCES staging_businesses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_phone ON businesses(phone);
CREATE INDEX IF NOT EXISTS idx_businesses_governorate ON businesses(governorate);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_confidence ON businesses(confidence);

-- Add indexes for staging_businesses table
CREATE INDEX IF NOT EXISTS idx_staging_businesses_job_id ON staging_businesses(job_id);
CREATE INDEX IF NOT EXISTS idx_staging_businesses_status ON staging_businesses(status);
CREATE INDEX IF NOT EXISTS idx_staging_businesses_name ON staging_businesses(name);
CREATE INDEX IF NOT EXISTS idx_staging_businesses_phone ON staging_businesses(phone);

-- Add unique constraint to prevent exact duplicates in final businesses
ALTER TABLE businesses ADD CONSTRAINT unique_business_name_phone 
  UNIQUE (name, phone) 
  WHERE phone IS NOT NULL AND phone != '';

-- Enable RLS (Row Level Security)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access - jobs" ON jobs
  FOR SELECT USING (true);

CREATE POLICY "Public read access - staging_businesses" ON staging_businesses
  FOR SELECT USING (true);

CREATE POLICY "Public read access - businesses" ON businesses
  FOR SELECT USING (true);

-- Create policies for insert access (service role will bypass RLS)
CREATE POLICY "Allow insert - jobs" ON jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow insert - staging_businesses" ON staging_businesses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow insert - businesses" ON businesses
  FOR INSERT WITH CHECK (true);

-- Create policies for update access (service role will bypass RLS)
CREATE POLICY "Allow update - jobs" ON jobs
  FOR UPDATE USING (true);

CREATE POLICY "Allow update - staging_businesses" ON staging_businesses
  FOR UPDATE USING (true);

CREATE POLICY "Allow update - businesses" ON businesses
  FOR UPDATE USING (true);
