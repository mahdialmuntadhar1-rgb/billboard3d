import { createClient } from '@supabase/supabase-js';

// Test direct Supabase connection
const supabaseUrl = 'https://mxxaxhrtccomkazpvthn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eGF4aHJ0Y2NvbWthenB2dGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyNDk5MSwiZXhwIjoyMDg4ODAwOTkxfQ.KtZfSdvLe0EKBQRf9m7UyXBDTTYaOUGs-ZoWtHoxHpI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    console.log('Key length:', supabaseKey.length);
    
    const { data, error } = await supabase.from('businesses').select('count').limit(1);
    
    if (error) {
      console.error('Supabase error:', error);
    } else {
      console.log('SUCCESS: Supabase connection working');
      console.log('Data:', data);
    }
  } catch (error: any) {
    console.error('Connection error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testConnection();
