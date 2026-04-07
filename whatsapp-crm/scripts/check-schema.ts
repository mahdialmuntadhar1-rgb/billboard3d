/**
 * Check actual database schema
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking actual businesses table schema...\n');
  
  try {
    // Get a sample business to see available fields
    const { data: sample, error } = await supabase
      .from('businesses')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Error:', error.message);
      return;
    }
    
    if (sample && sample.length > 0) {
      const fields = Object.keys(sample[0]);
      console.log('Available fields in businesses table:');
      fields.forEach(f => console.log(`  - ${f}`));
      console.log('\nSample record:');
      console.log(JSON.stringify(sample[0], null, 2));
    } else {
      console.log('No businesses found in table');
    }
    
    // Count total
    const { count, error: countError } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\nTotal businesses: ${count}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkSchema();
