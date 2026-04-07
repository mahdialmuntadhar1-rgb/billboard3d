/**
 * Debug Queue Creation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQueue() {
  console.log('Debugging queue creation...\n');
  
  // 1. Check campaigns table
  console.log('1. Checking campaigns table...');
  const { data: campaigns, error: campError } = await supabase.from('campaigns').select('id, name').limit(3);
  if (campError) {
    console.log('  Campaign error:', campError.message);
  } else {
    console.log(`  Found ${campaigns?.length || 0} campaigns`);
    if (campaigns && campaigns.length > 0) {
      console.log('  First campaign:', campaigns[0]);
    }
  }
  
  // 2. Check messages table schema
  console.log('\n2. Checking messages table...');
  const { data: msgSample, error: msgError } = await supabase.from('messages').select('*').limit(1);
  if (msgError && msgError.message.includes('does not exist')) {
    console.log('  ✗ messages table does not exist!');
    console.log('  Need to create messages table with proper schema');
  } else if (msgError) {
    console.log('  Messages error:', msgError.message);
  } else {
    console.log('  ✓ messages table exists');
    if (msgSample && msgSample.length > 0) {
      console.log('  Fields:', Object.keys(msgSample[0]).join(', '));
    }
  }
  
  // 3. Try to create a test message
  console.log('\n3. Attempting test message insert...');
  let campaignId = campaigns?.[0]?.id;
  if (!campaignId) {
    console.log('  Creating test campaign...');
    const { data: newCamp } = await supabase.from('campaigns').insert({
      name: 'Debug Test',
      status: 'draft',
      template_strategy: 'single_template',
      audience_filters: {}
    }).select('id').single();
    campaignId = newCamp?.id;
    console.log('  Created campaign:', campaignId);
  }
  
  // Get a business with valid phone
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, phone, whatsapp, status')
    .eq('status', 'approved')
    .not('phone', 'is', null)
    .limit(1)
    .single();
  
  if (!business) {
    console.log('  No approved business with phone found');
    return;
  }
  
  console.log('  Test business:', business.name, 'Phone:', business.phone);
  
  // Try insert
  const testMessage = {
    campaign_id: campaignId,
    business_id: business.id,
    business_name: business.name,
    phone: business.phone?.startsWith('07') ? '+964' + business.phone.substring(1) : business.phone,
    rendered_message: 'Test message',
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  console.log('  Inserting:', JSON.stringify(testMessage, null, 2));
  
  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert(testMessage)
    .select('id, phone, status');
  
  if (insertError) {
    console.log('  ✗ Insert failed:', insertError.message);
    console.log('  Error details:', insertError);
  } else {
    console.log('  ✓ Insert success:', inserted);
  }
}

debugQueue();
