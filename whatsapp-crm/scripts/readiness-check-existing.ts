/**
 * WhatsApp Readiness Check - Using Existing Schema
 * Works with current phone fields without requiring migration
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Phone validation function
function isValidIraqiPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s\-\(\)]/g, '').trim();
  if (clean.length < 10) return false;
  
  const patterns = [
    /^\+9647\d{8,9}$/,
    /^07\d{9}$/,
    /^\+96478\d{7,8}$/,
    /^\+96479\d{7,8}$/,
    /^\+96475\d{7,8}$/,
    /^078\d{8}$/,
    /^079\d{8}$/,
    /^075\d{8}$/
  ];
  
  return patterns.some(p => p.test(clean));
}

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-\(\)]/g, '').trim();
  if (clean.startsWith('07')) {
    return '+964' + clean.substring(1);
  }
  return clean;
}

function selectBestPhone(business: any): { phone: string; source: string } | null {
  const phones = [
    { value: business.whatsapp, field: 'whatsapp' },
    { value: business.phone, field: 'phone' },
    { value: business.phone_1, field: 'phone_1' },
    { value: business.phone_2, field: 'phone_2' }
  ];
  
  for (const { value, field } of phones) {
    if (value && isValidIraqiPhone(value)) {
      return { phone: normalizePhone(value), source: field };
    }
  }
  return null;
}

async function runReadinessCheck() {
  console.log('WhatsApp Readiness Check (Using Existing Schema)');
  console.log('================================================\n');
  
  // 1. Supabase connectivity
  console.log('1. Supabase connectivity...');
  const { data: testData, error: testError } = await supabase.from('businesses').select('count').limit(1);
  if (testError) {
    console.log('  ✗ FAILED:', testError.message);
    return { ready: false, blocker: 'Supabase connection failed' };
  }
  console.log('  ✓ Connected to hsadukhmcclwixuntqwu.supabase.co\n');
  
  // 2. Phone audit
  console.log('2. Phone audit...');
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, business_name, phone, phone_1, phone_2, whatsapp');
  
  if (bizError) {
    console.log('  ✗ FAILED:', bizError.message);
    return { ready: false, blocker: 'Cannot fetch businesses' };
  }
  
  const totalBusinesses = businesses?.length || 0;
  
  // Analyze each business
  const analysis = businesses?.map(b => {
    const phoneInfo = selectBestPhone(b);
    return {
      id: b.id,
      name: b.business_name,
      hasValidPhone: !!phoneInfo,
      phone: phoneInfo?.phone || null,
      source: phoneInfo?.source || null
    };
  }) || [];
  
  const validBusinesses = analysis.filter(b => b.hasValidPhone);
  const invalidBusinesses = analysis.filter(b => !b.hasValidPhone);
  
  // Check for duplicates
  const validPhones = validBusinesses.map(b => b.phone);
  const uniquePhones = new Set(validPhones);
  const duplicates = validPhones.length - uniquePhones.size;
  
  console.log(`  Total businesses: ${totalBusinesses}`);
  console.log(`  Valid WhatsApp-ready: ${validBusinesses.length}`);
  console.log(`  Excluded (no valid phone): ${invalidBusinesses.length}`);
  console.log(`  Duplicate phones: ${duplicates}\n`);
  
  // 3. Audience preview
  console.log('3. Audience preview...');
  const audienceCount = validBusinesses.length;
  console.log(`  Audience count: ${audienceCount}\n`);
  
  if (audienceCount === 0) {
    return { 
      ready: false, 
      blocker: 'No valid audience found',
      totalBusinesses,
      validPhones: 0,
      audienceCount: 0,
      queueRows: 0
    };
  }
  
  // 4. Tiny queue test (max 3)
  console.log('4. Tiny queue test (max 3)...');
  
  // Get or create test campaign
  const { data: campaigns } = await supabase.from('campaigns').select('id').limit(1);
  let campaignId = campaigns?.[0]?.id;
  
  if (!campaignId) {
    const { data: newCampaign } = await supabase.from('campaigns').insert({
      name: 'Readiness Test',
      status: 'draft',
      template_strategy: 'single_template',
      audience_filters: {}
    }).select('id').single();
    campaignId = newCampaign?.id;
  }
  
  // Select up to 3 businesses with valid phones
  const testBusinesses = validBusinesses.slice(0, 3);
  
  // Create queue entries
  const messagesToInsert = testBusinesses.map(b => ({
    campaign_id: campaignId,
    business_id: b.id,
    business_name: b.name,
    phone: b.phone,
    rendered_message: `Test message for ${b.name}`,
    status: 'pending',
    created_at: new Date().toISOString()
  }));
  
  const { data: queued, error: queueError } = await supabase
    .from('messages')
    .insert(messagesToInsert)
    .select('id, phone, status');
  
  if (queueError) {
    console.log('  ✗ Queue creation failed:', queueError.message);
    return { 
      ready: false, 
      blocker: `Queue creation failed: ${queueError.message}`,
      totalBusinesses,
      validPhones: validBusinesses.length,
      audienceCount,
      queueRows: 0
    };
  }
  
  const queueRows = queued?.length || 0;
  console.log(`  Queue rows created: ${queueRows}`);
  
  // Verify queue contents
  const invalidInQueue = queued?.filter(m => !m.phone?.startsWith('+964')) || [];
  if (invalidInQueue.length > 0) {
    console.log(`  ✗ Invalid phones in queue: ${invalidInQueue.length}`);
    return { 
      ready: false, 
      blocker: 'Invalid phone format in queue',
      totalBusinesses,
      validPhones: validBusinesses.length,
      audienceCount,
      queueRows
    };
  }
  
  console.log('  ✓ All queue entries have valid +964 format\n');
  
  // Final readiness
  const ready = queueRows > 0 && queueRows <= 3 && invalidInQueue.length === 0;
  
  return {
    ready,
    totalBusinesses,
    validPhones: validBusinesses.length,
    audienceCount,
    queueRows,
    duplicates,
    blocker: ready ? null : 'Queue test failed'
  };
}

runReadinessCheck().then(result => {
  console.log('=== FINAL READINESS REPORT ===');
  console.log(`Total businesses: ${result.totalBusinesses}`);
  console.log(`Valid phone count: ${result.validPhones}`);
  console.log(`Audience preview count: ${result.audienceCount}`);
  console.log(`Queue rows created: ${result.queueRows}`);
  console.log(`Duplicate valid phones: ${result.duplicates}`);
  console.log(`System ready for WhatsApp testing: ${result.ready ? 'yes' : 'no'}`);
  console.log(`Exact blocker: ${result.blocker || 'None'}`);
});
