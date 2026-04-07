/**
 * Direct API Migration for Phone Normalization Fields
 * Uses Supabase REST API directly to execute SQL
 */

async function executeDirectMigration() {
  const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';
  
  console.log('Attempting direct SQL execution via REST API...\n');
  
  const sql = `
    ALTER TABLE businesses 
    ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
    ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT,
    ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;
  `;
  
  try {
    // Try to execute via Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Prefer': 'tx=commit'
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log('Direct API failed:', error);
      console.log('\nTrying alternative approach...\n');
      
      // Try using pg-functions endpoint
      const funcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql: sql })
      });
      
      if (!funcResponse.ok) {
        console.log('RPC approach also failed');
        return false;
      }
      
      console.log('✓ Migration applied via RPC');
      return true;
    }
    
    console.log('✓ Migration applied via REST API');
    return true;
    
  } catch (error: any) {
    console.error('Migration error:', error.message);
    return false;
  }
}

executeDirectMigration().then(success => {
  if (success) {
    console.log('\n✓ All migration fields added successfully');
  } else {
    console.log('\n✗ Migration failed - manual SQL execution required');
    console.log('\nExecute this SQL in Supabase Dashboard:');
    console.log('ALTER TABLE businesses ADD COLUMN IF NOT EXISTS normalized_phone TEXT, ADD COLUMN IF NOT EXISTS normalized_phone_source TEXT, ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS phone_invalid_reason TEXT;');
  }
});
