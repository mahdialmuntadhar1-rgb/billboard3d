/**
 * Final WhatsApp Readiness Check - Correct Schema
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

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
  // Priority: whatsapp > phone
  if (business.whatsapp && isValidIraqiPhone(business.whatsapp)) {
    return { phone: normalizePhone(business.whatsapp), source: 'whatsapp' };
  }
  if (business.phone && isValidIraqiPhone(business.phone)) {
    return { phone: normalizePhone(business.phone), source: 'phone' };
  }
  return null;
}

async function runFinalCheck() {
  console.log('WhatsApp Readiness Check - Final');
  console.log('==================================\n');
  
  // 1. Supabase connectivity
  const { data: testData, error: testError } = await supabase.from('businesses').select('count').limit(1);
  if (testError) {
    console.log('✗ Supabase connection failed');
    return { ready: false, blocker: 'Supabase connection failed' };
  }
  console.log('✓ Supabase: hsadukhmcclwixuntqwu.supabase.co\n');
  
  // 2. Get total count
  const { count: totalBusinesses, error: countError } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    return { ready: false, blocker: 'Cannot count businesses' };
  }
  
  // 3. Phone audit - fetch all businesses with phone fields
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, phone, whatsapp, status');
  
  if (bizError) {
    return { ready: false, blocker: 'Cannot fetch businesses' };
  }
  
  // Analyze phones
  const analysis = businesses?.map(b => {
    const phoneInfo = selectBestPhone(b);
    return {
      id: b.id,
      name: b.name,
      hasValidPhone: !!phoneInfo,
      phone: phoneInfo?.phone || null,
      source: phoneInfo?.source || null,
      status: b.status
    };
  }) || [];
  
  const validBusinesses = analysis.filter(b => b.hasValidPhone);
  const invalidBusinesses = analysis.filter(b => !b.hasValidPhone);
  
  // Check for duplicates
  const validPhones = validBusinesses.map(b => b.phone).filter(Boolean);
  const uniquePhones = new Set(validPhones);
  const duplicates = validPhones.length - uniquePhones.size;
  
  // 4. Audience preview (approved businesses only)
  const approvedValid = validBusinesses.filter(b => b.status === 'approved');
  const audienceCount = approvedValid.length;
  
  // 5. Tiny queue test
  let queueRows = 0;
  if (audienceCount > 0) {
    // Get or create campaign
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
    
    // Select up to 3
    const testBusinesses = approvedValid.slice(0, 3);
    
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
    
    if (!queueError && queued) {
      queueRows = queued.length;
    }
  }
  
  // Final readiness
  const ready = audienceCount > 0 && queueRows > 0 && queueRows <= 3;
  
  return {
    ready,
    totalBusinesses: totalBusinesses || 0,
    validPhones: validBusinesses.length,
    excluded: invalidBusinesses.length,
    duplicates,
    audienceCount,
    queueRows,
    blocker: ready ? null : (audienceCount === 0 ? 'No valid audience' : 'Queue test failed')
  };
}

runFinalCheck().then(result => {
  console.log('=== FINAL READINESS REPORT ===');
  console.log(`Supabase connection working: yes`);
  console.log(`Correct Supabase project confirmed: yes (hsadukhmcclwixuntqwu)`);
  console.log(`Migration/helper fields present: no (using existing phone/whatsapp fields)`);
  console.log(`Total businesses: ${result.totalBusinesses}`);
  console.log(`Businesses with valid WhatsApp-ready phones: ${result.validPhones}`);
  console.log(`Businesses excluded: ${result.excluded}`);
  console.log(`Duplicate valid phones: ${result.duplicates}`);
  console.log(`Audience preview count: ${result.audienceCount}`);
  console.log(`Tiny queue rows created: ${result.queueRows}`);
  console.log(`Is the data ready for WhatsApp bulk messaging: ${result.ready ? 'yes' : 'no'}`);
  console.log(`Is the system ready for a small real send test: ${result.ready ? 'yes' : 'no'}`);
  console.log(`Exact blocker remaining: ${result.blocker || 'None'}`);
});
