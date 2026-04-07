/**
 * End-to-End Messaging Pipeline Test
 * 
 * This script tests the complete flow:
 * 1. Queue messages from real business data
 * 2. Send messages through Nabda (or mock)
 * 3. Track status transitions in database
 * 4. Verify complete pipeline integrity
 */

import { supabase } from '../server/services/supabase';
import { fetchTargetBusinesses, selectBestPhone } from '../server/services/businessService';

// Test configuration
const TEST_CONFIG = {
  testCampaignName: 'E2E Test Campaign',
  testTemplateBody: 'Hello {business_name}! This is an end-to-end test message from our CRM system. Category: {category}, City: {city}',
  testLimit: 3,
  testFilters: {
    governorate: 'Baghdad',
    category: 'Technology'
  }
};

async function createTestCampaign() {
  console.log('\n=== Creating Test Campaign ===');
  
  try {
    // Create test template first
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .insert({
        name: 'E2E Test Template',
        body: TEST_CONFIG.testTemplateBody,
        cta_type: 'none',
        is_active: true,
        weight: 1
      })
      .select()
      .single();

    if (templateError) {
      console.error('Template creation error:', templateError);
      throw templateError;
    }

    console.log('Test template created:', template.id);

    // Create test campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name: TEST_CONFIG.testCampaignName,
        description: 'End-to-end test campaign',
        status: 'draft',
        template_strategy: 'single_template',
        audience_filters: TEST_CONFIG.testFilters
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }

    console.log('Test campaign created:', campaign.id);

    // Link template to campaign
    const { error: linkError } = await supabase
      .from('campaign_templates')
      .insert({
        campaign_id: campaign.id,
        template_id: template.id
      });

    if (linkError) {
      console.error('Template linking error:', linkError);
      throw linkError;
    }

    console.log('Template linked to campaign');
    
    return { campaign, template };
    
  } catch (error) {
    console.error('Campaign setup failed:', error);
    throw error;
  }
}

async function queueTestMessages(campaignId: any) {
  console.log('\n=== Queuing Test Messages ===');
  
  try {
    // Get businesses for testing
    const { businesses } = await fetchTargetBusinesses(TEST_CONFIG.testFilters);
    
    if (businesses.length === 0) {
      console.log('No businesses found for testing');
      return [];
    }

    console.log(`Found ${businesses.length} businesses, limiting to ${TEST_CONFIG.testLimit}`);
    
    // Limit to test size
    const testBusinesses = businesses.slice(0, TEST_CONFIG.testLimit);
    
    // Prepare businesses for queuing
    const businessesForQueue = testBusinesses.map(business => {
      const phoneInfo = selectBestPhone(business);
      return {
        id: business.id,
        name: business.business_name,
        phone: phoneInfo?.phone,
        phone_field: phoneInfo?.field,
        city: business.city,
        category: business.category,
        governorate: business.governorate
      };
    }).filter(b => b.phone);

    console.log('Prepared businesses for queuing:', businessesForQueue.map(b => ({
      name: b.name,
      phone: b.phone,
      field: b.phone_field
    })));

    // Queue messages
    const { data: messages, error: queueError } = await supabase
      .from('messages')
      .insert(
        businessesForQueue.map(business => ({
          campaign_id: campaignId,
          business_id: business.id,
          business_name: business.name,
          category: business.category,
          city: business.city,
          phone: business.phone,
          rendered_message: TEST_CONFIG.testTemplateBody
            .replace('{business_name}', business.name)
            .replace('{category}', business.category || 'Unknown')
            .replace('{city}', business.city || 'Unknown'),
          status: 'pending'
        }))
      )
      .select();

    if (queueError) {
      console.error('Message queuing error:', queueError);
      throw queueError;
    }

    console.log(`Queued ${messages?.length || 0} messages successfully`);
    
    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId);

    console.log('Campaign status updated to active');
    
    return messages || [];
    
  } catch (error) {
    console.error('Message queuing failed:', error);
    throw error;
  }
}

async function simulateMessageSending(messages: any[]) {
  console.log('\n=== Simulating Message Sending ===');
  
  try {
    console.log(`Processing ${messages.length} queued messages...`);
    
    const results = [];
    
    for (const message of messages) {
      console.log(`Processing message ${message.id} for ${message.business_name}`);
      
      // Simulate phone validation
      const isValid = /^\+964\d{10}$/.test(message.phone);
      
      if (!isValid) {
        console.log(`Invalid phone format: ${message.phone}`);
        
        await supabase
          .from('messages')
          .update({ 
            status: 'failed', 
            error_message: 'Invalid phone number format',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: false, error: 'Invalid phone' });
        continue;
      }
      
      // Simulate API call (mock for testing)
      console.log(`Simulating API call to ${message.phone}...`);
      const mockMessageId = `msg_${Date.now()}_${message.id}`;
      
      // Simulate some success and some failures
      const isSuccess = Math.random() > 0.2; // 80% success rate
      
      if (isSuccess) {
        console.log(`Mock send successful for ${message.business_name}, ID: ${mockMessageId}`);
        
        await supabase
          .from('messages')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            nabda_message_id: mockMessageId,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: true, messageId: mockMessageId });
      } else {
        console.log(`Mock send failed for ${message.business_name}`);
        
        await supabase
          .from('messages')
          .update({ 
            status: 'failed', 
            error_message: 'Mock API failure',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        results.push({ id: message.id, success: false, error: 'Mock API failure' });
      }
      
      // Simulate rate limiting
      if (messages.indexOf(message) < messages.length - 1) {
        console.log('Rate limiting: waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const sentCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`Send simulation completed: ${sentCount} sent, ${failedCount} failed`);
    
    return results;
    
  } catch (error) {
    console.error('Message sending simulation failed:', error);
    throw error;
  }
}

async function verifyDatabaseState(campaignId: any) {
  console.log('\n=== Verifying Database State ===');
  
  try {
    // Check campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;
    
    console.log('Campaign state:', {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      filters: campaign.audience_filters
    });

    // Check message states
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;
    
    console.log(`Found ${messages?.length || 0} messages for campaign`);
    
    const statusCounts = messages?.reduce((acc, msg) => {
      acc[msg.status] = (acc[msg.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('Message status distribution:', statusCounts);
    
    // Show message details
    messages?.forEach((message, index) => {
      console.log(`Message ${index + 1}:`, {
        id: message.id,
        business_name: message.business_name,
        phone: message.phone,
        status: message.status,
        nabda_message_id: message.nabda_message_id,
        error_message: message.error_message,
        sent_at: message.sent_at,
        created_at: message.created_at
      });
    });
    
    return { campaign, messages, statusCounts };
    
  } catch (error) {
    console.error('Database verification failed:', error);
    throw error;
  }
}

async function cleanupTestData(campaignId: any, templateId: any) {
  console.log('\n=== Cleaning Up Test Data ===');
  
  try {
    // Delete messages
    const { error: messagesDeleteError } = await supabase
      .from('messages')
      .delete()
      .eq('campaign_id', campaignId);

    if (messagesDeleteError) {
      console.error('Messages cleanup error:', messagesDeleteError);
    } else {
      console.log('Test messages deleted');
    }

    // Delete campaign template link
    const { error: linkDeleteError } = await supabase
      .from('campaign_templates')
      .delete()
      .eq('campaign_id', campaignId);

    if (linkDeleteError) {
      console.error('Campaign template link cleanup error:', linkDeleteError);
    }

    // Delete campaign
    const { error: campaignDeleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (campaignDeleteError) {
      console.error('Campaign cleanup error:', campaignDeleteError);
    } else {
      console.log('Test campaign deleted');
    }

    // Delete template
    const { error: templateDeleteError } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', templateId);

    if (templateDeleteError) {
      console.error('Template cleanup error:', templateDeleteError);
    } else {
      console.log('Test template deleted');
    }
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

async function runE2ETest() {
  console.log('CRM End-to-End Messaging Pipeline Test');
  console.log('==========================================');
  
  let campaignId: string | null = null;
  let templateId: string | null = null;
  
  try {
    // Step 1: Create test campaign and template
    const { campaign, template } = await createTestCampaign();
    campaignId = campaign.id;
    templateId = template.id;
    
    // Step 2: Queue test messages
    const messages = await queueTestMessages(campaignId);
    
    if (messages.length === 0) {
      console.log('No messages to test. Check if businesses exist with valid phones.');
      return;
    }
    
    // Step 3: Simulate message sending
    const sendResults = await simulateMessageSending(messages);
    
    // Step 4: Verify database state
    const { campaign: finalCampaign, messages: finalMessages, statusCounts } = await verifyDatabaseState(campaignId);
    
    // Step 5: Generate test report
    console.log('\n=== Test Results Summary ===');
    console.log(`Campaign: ${finalCampaign.name} (${finalCampaign.id})`);
    console.log(`Total messages processed: ${finalMessages?.length || 0}`);
    console.log(`Status distribution:`, statusCounts);
    console.log(`Send success rate: ${sendResults.filter(r => r.success).length}/${sendResults.length}`);
    
    // Validation checks
    const validations = [
      {
        check: 'Campaign created successfully',
        passed: !!finalCampaign && finalCampaign.status === 'active'
      },
      {
        check: 'Messages queued successfully',
        passed: (finalMessages?.length || 0) > 0
      },
      {
        check: 'Status transitions working',
        passed: Object.keys(statusCounts || {}).length > 0
      },
      {
        check: 'No messages left in pending state',
        passed: (statusCounts?.pending || 0) === 0
      },
      {
        check: 'Database updates working',
        passed: finalMessages?.some(m => m.updated_at && m.updated_at > m.created_at)
      }
    ];
    
    console.log('\n=== Validation Results ===');
    validations.forEach(validation => {
      console.log(`${validation.passed ? 'PASS' : 'FAIL'}: ${validation.check}`);
    });
    
    const allPassed = validations.every(v => v.passed);
    
    if (allPassed) {
      console.log('\nAll validations passed! End-to-end pipeline is working correctly.');
    } else {
      console.log('\nSome validations failed. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('E2E test failed:', error);
  } finally {
    // Cleanup test data
    if (campaignId && templateId) {
      await cleanupTestData(campaignId, templateId);
    }
  }
}

// Run the test
runE2ETest().catch(console.error);
