/**
 * Network Diagnostic for Supabase Connection
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mxxaxhrtccomkazpvthn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eGF4aHJ0Y2NvbWthenB2dGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIyNDk5MSwiZXhwIjoyMDg4ODAwOTkxfQ.KtZfSdvLe0EKBQRf9m7UyXBDTTYaOUGs-ZoWtHoxHpI';

console.log('Network Diagnostic');
console.log('==================');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey.length);
console.log('');

// Test 1: Basic fetch
try {
  console.log('Test 1: Basic fetch to Supabase...');
  const response = await fetch(supabaseUrl);
  console.log('  Response status:', response.status);
  console.log('  Response ok:', response.ok);
} catch (error: any) {
  console.log('  Fetch error:', error.message);
  console.log('  Error code:', error.code);
}

// Test 2: Supabase client
try {
  console.log('');
  console.log('Test 2: Supabase client connection...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('businesses').select('count').limit(1);
  
  if (error) {
    console.log('  Supabase error:', error.message);
    console.log('  Error details:', error);
  } else {
    console.log('  SUCCESS! Data:', data);
  }
} catch (error: any) {
  console.log('  Client error:', error.message);
  console.log('  Stack:', error.stack);
}

console.log('');
console.log('Diagnostic complete.');
