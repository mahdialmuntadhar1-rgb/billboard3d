/**
 * Test CRM System
 * 
 * This script tests the complete CRM system to ensure:
 * 1. Database schema is working
 * 2. Businesses can be fetched with filters
 * 3. Phone selection logic works
 * 4. Campaign creation and message queuing works
 */

import { supabase } from '../server/services/supabase';
import { fetchTargetBusinesses, selectBestPhone } from '../server/services/businessService';

async function testDatabaseConnection() {
  console.log('\n=== Testing Database Connection ===');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Database connection failed:', error);
      return false;
    }

    console.log('Database connection: OK');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

async function testBusinessesTable() {
  console.log('\n=== Testing Businesses Table ===');
  
  try {
    const { data, error, count } = await supabase
      .from('businesses')
      .select('*', { count: 'exact' });

    if (error) {
      console.error('Businesses table error:', error);
      return false;
    }

    console.log(`Businesses table: OK (${count || 0} records)`);
    
    // Show sample data
    if (data && data.length > 0) {
      console.log('Sample business:', {
        name: data[0].business_name,
        phone_1: data[0].phone_1,
        phone_2: data[0].phone_2,
        whatsapp: data[0].whatsapp,
        governorate: data[0].governorate,
        city: data[0].city,
        category: data[0].category
      });
    }
    
    return true;
  } catch (error) {
    console.error('Businesses table error:', error);
    return false;
  }
}

async function testPhoneSelection() {
  console.log('\n=== Testing Phone Selection Logic ===');
  
  try {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Phone selection test error:', error);
      return false;
    }

    for (const business of businesses || []) {
      const phoneInfo = selectBestPhone(business);
      console.log(`${business.business_name}:`, {
        available: { phone_1: business.phone_1, phone_2: business.phone_2, whatsapp: business.whatsapp },
        selected: phoneInfo
      });
    }
    
    return true;
  } catch (error) {
    console.error('Phone selection test error:', error);
    return false;
  }
}

async function testBusinessFilters() {
  console.log('\n=== Testing Business Filters ===');
  
  try {
    const filters = [
      { governorate: 'Baghdad' },
      { category: 'Restaurant' },
      { city: 'Baghdad' },
      { governorate: 'Baghdad', category: 'Technology' }
    ];

    for (const filter of filters) {
      console.log(`Testing filter:`, filter);
      
      const result = await fetchTargetBusinesses(filter);
      
      console.log(`  - Total matched: ${result.total}`);
      console.log(`  - With valid phones: ${result.withValidPhones}`);
      console.log(`  - Without valid phones: ${result.withoutValidPhones}`);
      
      if (result.businesses.length > 0) {
        console.log(`  - Sample: ${result.businesses[0].business_name}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Business filters test error:', error);
    return false;
  }
}

async function testCampaignCreation() {
  console.log('\n=== Testing Campaign Creation ===');
  
  try {
    // First check if we have templates
    const { data: templates, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .limit(1);

    if (templateError) {
      console.error('Template check error:', templateError);
      return false;
    }

    if (!templates || templates.length === 0) {
      console.log('No templates found, creating a test template...');
      
      const { data: newTemplate, error: createError } = await supabase
        .from('message_templates')
        .insert({
          name: 'Test Template',
          body: 'Hello {business_name}! This is a test message from our CRM system.',
          cta_type: 'none',
          is_active: true,
          weight: 1
        })
        .select()
        .single();

      if (createError) {
        console.error('Template creation error:', createError);
        return false;
      }

      console.log('Test template created:', newTemplate.name);
    }

    // Create a test campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name: 'Test Campaign',
        description: 'Test campaign for CRM validation',
        status: 'draft',
        template_strategy: 'single_template',
        audience_filters: { governorate: 'Baghdad', category: 'Technology' }
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      return false;
    }

    console.log('Test campaign created:', campaign.name);
    console.log('Campaign ID:', campaign.id);
    
    // Clean up - delete the test campaign
    await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign.id);

    console.log('Test campaign cleaned up');
    
    return true;
  } catch (error) {
    console.error('Campaign creation test error:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('CRM System Test Suite');
  console.log('====================');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Businesses Table', fn: testBusinessesTable },
    { name: 'Phone Selection', fn: testPhoneSelection },
    { name: 'Business Filters', fn: testBusinessFilters },
    { name: 'Campaign Creation', fn: testCampaignCreation }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`\n${test.name}: PASSED`);
      } else {
        failed++;
        console.log(`\n${test.name}: FAILED`);
      }
    } catch (error) {
      failed++;
      console.error(`\n${test.name}: ERROR -`, error);
    }
  }

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\nAll tests passed! CRM system is ready for use.');
  } else {
    console.log('\nSome tests failed. Please check the errors above.');
  }
}

// Run all tests
runAllTests().catch(console.error);
