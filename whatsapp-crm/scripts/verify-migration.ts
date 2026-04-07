/**
 * Verify if migration fields exist
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('Verifying migration fields...\n');
  
  try {
    // Try to select the migration fields
    const { data, error } = await supabase
      .from('businesses')
      .select('normalized_phone, normalized_phone_source, phone_valid, phone_invalid_reason')
      .limit(1);
    
    if (error) {
      console.log('✗ Migration fields NOT present');
      console.log('Error:', error.message);
      console.log('\n=== MIGRATION SQL ===');
      console.log('Execute this in Supabase Dashboard SQL Editor:');
      console.log('');
      console.log('ALTER TABLE businesses');
      console.log('ADD COLUMN IF NOT EXISTS normalized_phone TEXT,');
      console.log('ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT,');
      console.log('ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE,');
      console.log('ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;');
      console.log('');
      console.log('Project URL: https://app.supabase.com/project/hsadukhmcclwixuntqwu');
      return false;
    }
    
    console.log('✓ Migration fields verified - all fields present');
    return true;
    
  } catch (error: any) {
    console.error('Verification error:', error.message);
    return false;
  }
}

verifyMigration();
