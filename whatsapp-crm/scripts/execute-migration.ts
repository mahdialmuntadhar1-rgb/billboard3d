/**
 * Direct SQL Execution for Phone Normalization Migration
 * Uses Supabase REST API to execute SQL
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  console.log('Executing phone normalization migration...\n');
  
  // SQL to add all fields in one command
  const sql = `
    ALTER TABLE businesses 
    ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
    ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT,
    ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;
  `;
  
  try {
    // Try using pg_exec or direct SQL via REST
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .limit(0);
    
    if (error) {
      console.error('Connection error:', error);
      return;
    }
    
    console.log('Connected to Supabase successfully');
    console.log('\nManual SQL Migration Required:');
    console.log('================================');
    console.log('Please execute the following SQL in Supabase Dashboard:');
    console.log('');
    console.log(sql);
    console.log('');
    console.log('Steps:');
    console.log('1. Go to https://app.supabase.com/project/hsadukhmcclwixuntqwu');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Paste the SQL above');
    console.log('4. Click Run');
    console.log('5. Return here and I\'ll continue with the readiness checks');
    
    // Check if fields might already exist
    const { data: sample, error: sampleError } = await supabase
      .from('businesses')
      .select('normalized_phone, normalized_phone_source, phone_valid, phone_invalid_reason')
      .limit(1);
    
    if (sampleError && sampleError.message.includes('column')) {
      console.log('\n✗ Fields do not exist yet - manual SQL execution required');
    } else if (!sampleError) {
      console.log('\n✓ Fields appear to exist - proceeding with readiness checks');
      return true;
    }
    
    return false;
    
  } catch (error: any) {
    console.error('Error:', error.message);
    return false;
  }
}

executeMigration();
