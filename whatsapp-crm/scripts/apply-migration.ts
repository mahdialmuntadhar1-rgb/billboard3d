/**
 * Apply Phone Normalization Migration to Supabase
 * Adds helper fields for WhatsApp bulk messaging
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Applying phone normalization migration...');
  
  try {
    // Add normalized_phone field
    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS normalized_phone TEXT;`
    });
    if (err1) console.log('normalized_phone field may already exist or requires manual addition');
    else console.log('✓ normalized_phone field added');
    
    // Add normalized_phone_source field
    const { error: err2 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT;`
    });
    if (err2) console.log('normalized_phone_source field may already exist or requires manual addition');
    else console.log('✓ normalized_phone_source field added');
    
    // Add phone_valid field
    const { error: err3 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE;`
    });
    if (err3) console.log('phone_valid field may already exist or requires manual addition');
    else console.log('✓ phone_valid field added');
    
    // Add phone_invalid_reason field
    const { error: err4 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;`
    });
    if (err4) console.log('phone_invalid_reason field may already exist or requires manual addition');
    else console.log('✓ phone_invalid_reason field added');
    
    console.log('\nMigration applied (or fields already exist)');
    
    // Verify fields exist
    const { data, error } = await supabase
      .from('businesses')
      .select('normalized_phone, normalized_phone_source, phone_valid, phone_invalid_reason')
      .limit(1);
    
    if (error) {
      console.log('Verification failed:', error.message);
    } else {
      console.log('✓ All migration fields verified present');
    }
    
  } catch (error: any) {
    console.error('Migration error:', error.message);
    console.log('\nNOTE: RPC exec_sql may not be available. Fields may need manual SQL execution in Supabase dashboard.');
  }
}

applyMigration();
