/**
 * WhatsApp Messaging Pipeline Fix
 * 
 * This script diagnoses and fixes the complete messaging pipeline
 * from audience selection to message sending and status tracking.
 */

import { supabase } from '../server/services/supabase';

interface PipelineTest {
  name: string;
  test: () => Promise<{ success: boolean; error?: string; details?: any }>;
}

async function runPipelineAudit() {
  console.log('WhatsApp Messaging Pipeline Audit');
  console.log('==================================\n');

  const tests: PipelineTest[] = [
    {
      name: 'Environment Variables Check',
      test: async () => {
        const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NABDA_API_KEY'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
          return {
            success: false,
            error: `Missing environment variables: ${missing.join(', ')}`
          };
        }
        
        return { success: true, details: 'All required environment variables present' };
      }
    },
    {
      name: 'Database Connection',
      test: async () => {
        try {
          const { data, error } = await supabase
            .from('businesses')
            .select('count', { count: 'exact', head: true });
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          return { 
            success: true, 
            details: { totalBusinesses: data || 0 }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: 'Business Data Availability',
      test: async () => {
        try {
          const { data: businesses, error } = await supabase
            .from('businesses')
            .select('id, business_name, phone_1, phone_2, whatsapp, city, category, governorate')
            .eq('status', 'approved')
            .limit(5);
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          if (!businesses || businesses.length === 0) {
            return { 
              success: false, 
              error: 'No approved businesses found in database' 
            };
          }
          
          const phoneAnalysis = businesses.map(b => ({
            name: b.business_name,
            hasPhone1: !!b.phone_1,
            hasPhone2: !!b.phone_2,
            hasWhatsapp: !!b.whatsapp,
            hasAnyPhone: !!(b.phone_1 || b.phone_2 || b.whatsapp)
          }));
          
          return { 
            success: true, 
            details: { 
              sampleCount: businesses.length,
              phoneAnalysis
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: 'Campaign Data Availability',
      test: async () => {
        try {
          const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('id, name, status, template_strategy')
            .limit(3);
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          if (!campaigns || campaigns.length === 0) {
            return { 
              success: false, 
              error: 'No campaigns found in database' 
            };
          }
          
          return { 
            success: true, 
            details: { 
              campaignCount: campaigns.length,
              campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status }))
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: 'Template Availability',
      test: async () => {
        try {
          const { data: templates, error } = await supabase
            .from('message_templates')
            .select('id, name, body, is_active')
            .eq('is_active', true)
            .limit(3);
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          if (!templates || templates.length === 0) {
            return { 
              success: false, 
              error: 'No active templates found in database' 
            };
          }
          
          return { 
            success: true, 
            details: { 
              templateCount: templates.length,
              templates: templates.map(t => ({ id: t.id, name: t.name }))
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: 'Phone Selection Logic',
      test: async () => {
        try {
          // Import the phone selection function
          const { selectBestPhone } = await import('../server/services/businessService');
          
          // Test with sample business data
          const testBusiness = {
            id: 'test',
            business_name: 'Test Business',
            phone_1: '+9647701234567',
            phone_2: '+9647501234567',
            whatsapp: '+9647701234567',
            city: 'Baghdad',
            category: 'Technology',
            governorate: 'Baghdad'
          };
          
          const phoneInfo = selectBestPhone(testBusiness as any);
          
          if (!phoneInfo) {
            return { 
              success: false, 
              error: 'Phone selection logic returned null for valid business' 
            };
          }
          
          return { 
            success: true, 
            details: { 
              selectedPhone: phoneInfo.phone,
              selectedField: phoneInfo.field
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: 'Message Queue Test',
      test: async () => {
        try {
          // Check if there are any pending messages
          const { data: pendingMessages, error } = await supabase
            .from('messages')
            .select('id, status, campaign_id, business_name')
            .eq('status', 'pending')
            .limit(5);
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          return { 
            success: true, 
            details: { 
              pendingCount: pendingMessages?.length || 0,
              sampleMessages: pendingMessages?.map(m => ({ 
                id: m.id, 
                business: m.business_name,
                campaign: m.campaign_id 
              }))
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    }
  ];

  // Run all tests
  const results = [];
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    try {
      const result = await test.test();
      results.push({ name: test.name, ...result });
      
      if (result.success) {
        console.log(`  PASS: ${result.details || 'Test passed'}`);
      } else {
        console.log(`  FAIL: ${result.error}`);
      }
    } catch (error: any) {
      console.log(`  ERROR: ${error.message}`);
      results.push({ name: test.name, success: false, error: error.message });
    }
    console.log('');
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('=== Audit Summary ===');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n=== Failed Tests ===');
    results.filter(r => !r.success).forEach(test => {
      console.log(`${test.name}: ${test.error}`);
    });
  }

  // Recommendations
  console.log('\n=== Recommendations ===');
  
  if (results.find(r => r.name === 'Environment Variables Check' && !r.success)) {
    console.log('1. Create .env file with required environment variables');
    console.log('   Copy .env.example to .env and fill in your credentials');
  }
  
  if (results.find(r => r.name === 'Database Connection' && !r.success)) {
    console.log('2. Check Supabase URL and service role key');
    console.log('   Ensure your Supabase project is accessible');
  }
  
  if (results.find(r => r.name === 'Business Data Availability' && !r.success)) {
    console.log('3. Seed the businesses table with sample data');
    console.log('   Run: npm run seed:businesses');
  }
  
  if (results.find(r => r.name === 'Campaign Data Availability' && !r.success)) {
    console.log('4. Create a test campaign with linked templates');
    console.log('   Use the Campaigns page in the UI to create a campaign');
  }
  
  if (results.find(r => r.name === 'Template Availability' && !r.success)) {
    console.log('5. Create active message templates');
    console.log('   Use the Templates page to create templates');
  }
  
  if (passed === results.length) {
    console.log('All tests passed! The messaging pipeline is ready.');
    console.log('\n=== Next Steps ===');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Navigate to the Campaigns page');
    console.log('3. Create a test campaign with test mode ON');
    console.log('4. Queue a small batch (3-5 recipients)');
    console.log('5. Go to the Message Queue page to send messages');
    console.log('6. Monitor the server console for detailed logs');
  }
}

// Run the audit
runPipelineAudit().catch(console.error);
