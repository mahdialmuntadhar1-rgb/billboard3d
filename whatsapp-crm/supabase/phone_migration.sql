-- Manual SQL Migration for Phone Normalization Fields
-- Execute this SQL in Supabase Dashboard (SQL Editor)

-- Add helper fields for WhatsApp bulk messaging (non-destructive)
-- These fields do NOT modify or delete existing phone fields

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT,
ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;

-- Create index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_phone ON businesses(normalized_phone) WHERE phone_valid = TRUE;

-- Verify fields were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'businesses' 
AND column_name IN ('normalized_phone', 'normalized_phone_source', 'phone_valid', 'phone_invalid_reason')
ORDER BY ordinal_position;
