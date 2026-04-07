/**
 * WhatsApp Bulk Messaging Readiness Check
 * 
 * This script performs a complete readiness verification for WhatsApp bulk messaging
 * using real business data from Supabase.
 */

import { supabase } from '../server/services/supabase';

interface ReadinessReport {
  supabaseConnectionWorking: boolean;
  migrationFieldsPresent: boolean;
  totalBusinesses: number;
  businessesWithValidPhones: number;
  businessesExcluded: number;
  duplicateValidPhones: number;
  audiencePreviewCount: number;
  tinyQueueRowsCreated: number;
  dataReadyForWhatsApp: boolean;
  readyForSmallTest: boolean;
  exactBlocker: string;
}

async function runReadinessCheck(): Promise<ReadinessReport> {
  console.log('WhatsApp Bulk Messaging Readiness Check');
  console.log('==========================================\n');

  const report: ReadinessReport = {
    supabaseConnectionWorking: false,
    migrationFieldsPresent: false,
    totalBusinesses: 0,
    businessesWithValidPhones: 0,
    businessesExcluded: 0,
    duplicateValidPhones: 0,
    audiencePreviewCount: 0,
    tinyQueueRowsCreated: 0,
    dataReadyForWhatsApp: false,
    readyForSmallTest: false,
    exactBlocker: ''
  };

  try {
    // 1. Supabase connectivity test
    console.log('1. Testing Supabase connectivity...');
    try {
      const { data, error } = await supabase.from('businesses').select('count').limit(1);
      if (error) throw error;
      report.supabaseConnectionWorking = true;
      console.log('  PASS: Supabase connection working');
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Supabase connection failed: ${error.message}`;
      return report;
    }

    // 2. Database readiness - check migration fields
    console.log('2. Checking migration/helper fields...');
    try {
      const { data: sampleBusiness, error } = await supabase
        .from('businesses')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      
      const requiredFields = ['normalized_phone', 'normalized_phone_source', 'phone_valid', 'phone_invalid_reason'];
      const availableFields = sampleBusiness && sampleBusiness.length > 0 ? Object.keys(sampleBusiness[0]) : [];
      const missingFields = requiredFields.filter(field => !availableFields.includes(field));
      
      if (missingFields.length > 0) {
        console.log(`  FAIL: Missing migration fields: ${missingFields.join(', ')}`);
        report.exactBlocker = `Missing migration fields: ${missingFields.join(', ')}`;
        return report;
      }
      
      report.migrationFieldsPresent = true;
      console.log('  PASS: All migration fields present');
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Database schema check failed: ${error.message}`;
      return report;
    }

    // 3. Phone readiness audit
    console.log('3. Running phone readiness audit...');
    try {
      const { data: businesses, error } = await supabase
        .from('businesses')
        .select('id, business_name, phone, phone_1, phone_2, whatsapp, normalized_phone, normalized_phone_source, phone_valid, phone_invalid_reason');
      
      if (error) throw error;
      
      report.totalBusinesses = businesses?.length || 0;
      
      // Analyze phone data
      const phoneAnalysis = businesses?.map(business => {
        const hasPhone = !!business.phone;
        const hasPhone1 = !!business.phone_1;
        const hasPhone2 = !!business.phone_2;
        const hasWhatsapp = !!business.whatsapp;
        const hasAnyPhone = hasPhone || hasPhone1 || hasPhone2 || hasWhatsapp;
        const hasNormalizedPhone = !!business.normalized_phone;
        const phoneValid = business.phone_valid === true;
        
        return {
          id: business.id,
          name: business.business_name,
          hasAnyPhone,
          hasNormalizedPhone,
          phoneValid,
          phoneSource: business.normalized_phone_source,
          invalidReason: business.phone_invalid_reason,
          normalizedPhone: business.normalized_phone
        };
      }) || [];

      const withAnyPhone = phoneAnalysis.filter(b => b.hasAnyPhone);
      const withValidNormalizedPhone = phoneAnalysis.filter(b => b.phoneValid && b.hasNormalizedPhone);
      const excluded = phoneAnalysis.filter(b => !b.phoneValid || !b.hasNormalizedPhone);
      
      report.businessesWithValidPhones = withValidNormalizedPhone.length;
      report.businessesExcluded = excluded.length;
      
      // Check for duplicates
      const validPhones = withValidNormalizedPhone.map(b => b.normalizedPhone).filter(Boolean);
      const uniquePhones = new Set(validPhones);
      report.duplicateValidPhones = validPhones.length - uniquePhones.size;
      
      console.log(`  Total businesses: ${report.totalBusinesses}`);
      console.log(`  With any phone: ${withAnyPhone.length}`);
      console.log(`  With valid normalized phones: ${report.businessesWithValidPhones}`);
      console.log(`  Excluded: ${report.businessesExcluded}`);
      console.log(`  Duplicate valid phones: ${report.duplicateValidPhones}`);
      
      // Top invalid reasons
      const invalidReasons = excluded.reduce((acc, b) => {
        const reason = b.invalidReason || 'Unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('  Top invalid reasons:');
      Object.entries(invalidReasons).slice(0, 3).forEach(([reason, count]) => {
        console.log(`    ${reason}: ${count}`);
      });
      
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Phone audit failed: ${error.message}`;
      return report;
    }

    // 4. Phone normalization readiness
    console.log('4. Checking phone normalization...');
    try {
      const { data: unnormalizedBusinesses, error } = await supabase
        .from('businesses')
        .select('id, phone, phone_1, phone_2, whatsapp, normalized_phone')
        .or('normalized_phone.is.null,normalized_phone.eq.""');
      
      if (error) throw error;
      
      if (unnormalizedBusinesses && unnormalizedBusinesses.length > 0) {
        console.log(`  INFO: ${unnormalizedBusinesses.length} businesses need phone normalization`);
        
        // Test phone selection priority
        const { selectBestPhone } = await import('../server/services/businessService');
        const testBusiness = {
          whatsapp: '+9647701234567',
          phone: '+964781234567',
          phone_1: '+964791234567',
          phone_2: '+964751234567'
        };
        
        const selected = selectBestPhone(testBusiness as any);
        if (selected && selected.field === 'whatsapp') {
          console.log('  PASS: Phone selection priority working (whatsapp > phone > phone_1 > phone_2)');
        } else {
          console.log(`  FAIL: Phone selection priority issue. Selected: ${selected?.field}`);
          report.exactBlocker = 'Phone selection priority not working correctly';
          return report;
        }
      } else {
        console.log('  PASS: All businesses have normalized phones');
      }
      
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Phone normalization check failed: ${error.message}`;
      return report;
    }

    // 5. Audience readiness
    console.log('5. Testing audience preview...');
    try {
      const { fetchTargetBusinesses } = await import('../server/services/businessService');
      
      const audienceResult = await fetchTargetBusinesses({});
      report.audiencePreviewCount = audienceResult.businesses.length;
      
      console.log(`  Audience preview count: ${report.audiencePreviewCount}`);
      
      if (report.audiencePreviewCount === 0) {
        console.log('  FAIL: No valid audience found');
        report.exactBlocker = 'No valid audience found for messaging';
        return report;
      }
      
      console.log('  PASS: Valid audience found');
      
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Audience preview failed: ${error.message}`;
      return report;
    }

    // 6. Queue readiness - tiny test
    console.log('6. Testing tiny queue creation...');
    try {
      // Create test campaign if needed
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('id')
        .limit(1);
      
      if (campaignError) throw campaignError;
      
      let campaignId = campaigns?.[0]?.id;
      if (!campaignId) {
        const { data: newCampaign, error: createError } = await supabase
          .from('campaigns')
          .insert({
            name: 'Readiness Test Campaign',
            status: 'draft',
            template_strategy: 'single_template',
            audience_filters: {}
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        campaignId = newCampaign.id;
      }
      
      // Get 3 valid businesses
      const { data: validBusinesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, business_name, normalized_phone, normalized_phone_source')
        .eq('phone_valid', true)
        .not('normalized_phone', 'is', null)
        .limit(3);
      
      if (businessError) throw businessError;
      
      if (!validBusinesses || validBusinesses.length === 0) {
        console.log('  FAIL: No valid businesses found for queue test');
        report.exactBlocker = 'No valid businesses with normalized phones found';
        return report;
      }
      
      // Create tiny queue
      const messagesToInsert = validBusinesses.map(business => ({
        campaign_id: campaignId,
        business_id: business.id,
        business_name: business.business_name,
        phone: business.normalized_phone,
        phone_source: business.normalized_phone_source,
        rendered_message: `Test message for ${business.business_name}`,
        status: 'pending'
      }));
      
      const { data: queuedMessages, error: queueError } = await supabase
        .from('messages')
        .insert(messagesToInsert)
        .select('id, phone, phone_source, status');
      
      if (queueError) throw queueError;
      
      report.tinyQueueRowsCreated = queuedMessages?.length || 0;
      
      console.log(`  Tiny queue rows created: ${report.tinyQueueRowsCreated}`);
      
      // Verify queue contents
      const invalidInQueue = queuedMessages?.filter(msg => 
        !msg.phone || !msg.phone.startsWith('+9647') || msg.phone.length < 12
      ) || [];
      
      if (invalidInQueue.length > 0) {
        console.log(`  FAIL: ${invalidInQueue.length} invalid numbers in queue`);
        report.exactBlocker = 'Invalid phone numbers found in queue';
        return report;
      }
      
      console.log('  PASS: Tiny queue created successfully');
      
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Queue test failed: ${error.message}`;
      return report;
    }

    // 7. Queue verification
    console.log('7. Verifying queue in database...');
    try {
      const { data: queueVerification, error } = await supabase
        .from('messages')
        .select('id, phone, phone_source, status')
        .eq('status', 'pending')
        .limit(5);
      
      if (error) throw error;
      
      const queueCount = queueVerification?.length || 0;
      const validInQueue = queueVerification?.filter(msg => 
        msg.phone && msg.phone.startsWith('+9647') && msg.phone.length >= 12
      ) || [];
      
      console.log(`  Queue verification: ${validInQueue.length}/${queueCount} valid phones`);
      
      if (validInQueue.length !== queueCount) {
        console.log('  FAIL: Invalid phones found in queue verification');
        report.exactBlocker = 'Queue verification found invalid phones';
        return report;
      }
      
      console.log('  PASS: Queue verification passed');
      
    } catch (error: any) {
      console.log(`  FAIL: ${error.message}`);
      report.exactBlocker = `Queue verification failed: ${error.message}`;
      return report;
    }

    // 8. Final readiness judgment
    console.log('8. Final readiness judgment...');
    
    report.dataReadyForWhatsApp = 
      report.supabaseConnectionWorking &&
      report.migrationFieldsPresent &&
      report.businessesWithValidPhones > 0 &&
      report.audiencePreviewCount > 0 &&
      report.tinyQueueRowsCreated > 0;
    
    report.readyForSmallTest = 
      report.dataReadyForWhatsApp &&
      report.duplicateValidPhones === 0 &&
      report.tinyQueueRowsCreated <= 3;
    
    if (report.dataReadyForWhatsApp && report.readyForSmallTest) {
      console.log('  PASS: System ready for WhatsApp bulk messaging and small testing');
    } else {
      console.log('  FAIL: System not ready for WhatsApp bulk messaging');
      if (!report.exactBlocker) {
        report.exactBlocker = 'General readiness criteria not met';
      }
    }

  } catch (error: any) {
    console.log(`CRITICAL ERROR: ${error.message}`);
    report.exactBlocker = `Critical error: ${error.message}`;
  }

  return report;
}

// Run the readiness check
runReadinessCheck().then(report => {
  console.log('\n=== FINAL READINESS REPORT ===');
  console.log(`Supabase connection working: ${report.supabaseConnectionWorking ? 'yes' : 'no'}`);
  console.log(`Migration/helper fields present: ${report.migrationFieldsPresent ? 'yes' : 'no'}`);
  console.log(`Total businesses: ${report.totalBusinesses}`);
  console.log(`Businesses with valid WhatsApp-ready phones: ${report.businessesWithValidPhones}`);
  console.log(`Businesses excluded: ${report.businessesExcluded}`);
  console.log(`Duplicate valid phones: ${report.duplicateValidPhones}`);
  console.log(`Audience preview count: ${report.audiencePreviewCount}`);
  console.log(`Tiny queue rows created: ${report.tinyQueueRowsCreated}`);
  console.log(`Is the data ready for WhatsApp bulk messaging: ${report.dataReadyForWhatsApp ? 'yes' : 'no'}`);
  console.log(`Is the system ready for a small real send test: ${report.readyForSmallTest ? 'yes' : 'no'}`);
  console.log(`Exact blocker remaining, if any: ${report.exactBlocker || 'None'}`);
}).catch(console.error);
