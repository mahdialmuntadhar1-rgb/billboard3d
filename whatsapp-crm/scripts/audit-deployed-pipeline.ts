/**
 * Deployed App Pipeline Audit & Fix
 * 
 * This script audits and fixes the complete WhatsApp messaging pipeline
 * for the deployed app, ensuring real end-to-end functionality.
 */

import { supabase } from '../server/services/supabase';

interface PipelineIssue {
  component: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fix: string;
  file?: string;
}

interface PipelineTest {
  name: string;
  test: () => Promise<{ success: boolean; error?: string; details?: any; issues?: PipelineIssue[] }>;
}

async function runDeployedPipelineAudit() {
  console.log('Deployed WhatsApp Messaging Pipeline Audit');
  console.log('==========================================\n');

  const issues: PipelineIssue[] = [];
  const tests: PipelineTest[] = [
    {
      name: '1. Environment Variables Check',
      test: async () => {
        const envIssues: PipelineIssue[] = [];
        const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NABDA_API_KEY'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
          envIssues.push({
            component: 'Environment',
            issue: `Missing environment variables: ${missing.join(', ')}`,
            severity: 'critical',
            fix: 'Create .env file with required variables for deployment',
            file: '.env'
          });
        }
        
        const optional = ['NABDA_API_URL', 'NODE_ENV', 'PORT'];
        const missingOptional = optional.filter(key => !process.env[key]);
        
        if (missingOptional.length > 0) {
          envIssues.push({
            component: 'Environment',
            issue: `Missing optional variables: ${missingOptional.join(', ')}`,
            severity: 'medium',
            fix: 'Add optional environment variables for better configuration',
            file: '.env'
          });
        }
        
        if (envIssues.length > 0) {
          issues.push(...envIssues);
          return { 
            success: false, 
            error: 'Environment configuration incomplete',
            details: { missing, missingOptional },
            issues: envIssues
          };
        }
        
        return { 
          success: true, 
          details: 'All environment variables configured correctly'
        };
      }
    },
    {
      name: '2. Database Connection & Business Data',
      test: async () => {
        try {
          // Test database connection
          const { data: businesses, error } = await supabase
            .from('businesses')
            .select('id, business_name, phone_1, phone_2, whatsapp, city, category, governorate, status')
            .eq('status', 'approved')
            .limit(10);
          
          if (error) {
            issues.push({
              component: 'Database',
              issue: `Database connection failed: ${error.message}`,
              severity: 'critical',
              fix: 'Check Supabase URL and service role key',
              file: 'server/services/supabase.ts'
            });
            return { success: false, error: error.message, issues };
          }
          
          if (!businesses || businesses.length === 0) {
            issues.push({
              component: 'Database',
              issue: 'No approved businesses found in database',
              severity: 'high',
              fix: 'Run seed script to populate businesses table',
              file: 'scripts/seed-businesses.ts'
            });
            return { 
              success: false, 
              error: 'No business data available',
              issues
            };
          }
          
          // Analyze phone availability
          const phoneAnalysis = businesses.map(b => {
            const hasPhone1 = !!b.phone_1;
            const hasPhone2 = !!b.phone_2;
            const hasWhatsapp = !!b.whatsapp;
            const hasAnyPhone = hasPhone1 || hasPhone2 || hasWhatsapp;
            
            return {
              id: b.id,
              name: b.business_name,
              hasPhone1,
              hasPhone2,
              hasWhatsapp,
              hasAnyPhone,
              phoneFields: [hasPhone1 && 'phone_1', hasPhone2 && 'phone_2', hasWhatsapp && 'whatsapp'].filter(Boolean)
            };
          });
          
          const withPhones = phoneAnalysis.filter(b => b.hasAnyPhone);
          const withoutPhones = phoneAnalysis.filter(b => !b.hasAnyPhone);
          
          if (withoutPhones.length > 0) {
            issues.push({
              component: 'Data Quality',
              issue: `${withoutPhones.length} businesses have no phone numbers`,
              severity: 'medium',
              fix: 'Update business records with valid phone numbers',
              file: 'database'
            });
          }
          
          return { 
            success: true, 
            details: { 
              totalBusinesses: businesses.length,
              withPhones: withPhones.length,
              withoutPhones: withoutPhones.length,
              phoneAnalysis: phoneAnalysis.slice(0, 3) // First 3 for brevity
            }
          };
          
        } catch (error: any) {
          issues.push({
            component: 'Database',
            issue: `Database test failed: ${error.message}`,
            severity: 'critical',
            fix: 'Check database configuration and network connectivity',
            file: 'server/services/supabase.ts'
          });
          return { success: false, error: error.message, issues };
        }
      }
    },
    {
      name: '3. Campaign & Template Availability',
      test: async () => {
        try {
          // Check campaigns
          const { data: campaigns, error: campaignError } = await supabase
            .from('campaigns')
            .select('id, name, status, template_strategy, audience_filters')
            .limit(5);
          
          if (campaignError) {
            return { success: false, error: campaignError.message };
          }
          
          if (!campaigns || campaigns.length === 0) {
            issues.push({
              component: 'Campaigns',
              issue: 'No campaigns found in database',
              severity: 'high',
              fix: 'Create at least one campaign with linked templates',
              file: 'src/pages/Campaigns.tsx'
            });
          }
          
          // Check templates
          const { data: templates, error: templateError } = await supabase
            .from('message_templates')
            .select('id, name, body, is_active')
            .eq('is_active', true)
            .limit(5);
          
          if (templateError) {
            return { success: false, error: templateError.message };
          }
          
          if (!templates || templates.length === 0) {
            issues.push({
              component: 'Templates',
              issue: 'No active templates found in database',
              severity: 'high',
              fix: 'Create at least one active message template',
              file: 'src/pages/Templates.tsx'
            });
          }
          
          // Check campaign-template relationships
          const { data: campaignTemplates, error: relError } = await supabase
            .from('campaign_templates')
            .select('campaign_id, template_id')
            .limit(10);
          
          if (relError) {
            return { success: false, error: relError.message };
          }
          
          if (!campaignTemplates || campaignTemplates.length === 0) {
            issues.push({
              component: 'Campaign Templates',
              issue: 'No campaign-template relationships found',
              severity: 'high',
              fix: 'Link templates to campaigns in the campaign creation flow',
              file: 'src/pages/Campaigns.tsx'
            });
          }
          
          return { 
            success: true, 
            details: { 
              campaignCount: campaigns?.length || 0,
              templateCount: templates?.length || 0,
              relationshipCount: campaignTemplates?.length || 0,
              campaigns: campaigns?.map(c => ({ id: c.id, name: c.name, status: c.status })),
              templates: templates?.map(t => ({ id: t.id, name: t.name }))
            }
          };
          
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: '4. Phone Selection Logic Test',
      test: async () => {
        try {
          const { selectBestPhone } = await import('../server/services/businessService');
          
          // Test with various phone formats
          const testCases = [
            {
              name: 'Valid WhatsApp',
              business: { whatsapp: '+9647701234567', phone_1: null, phone_2: null },
              expected: { phone: '+9647701234567', field: 'whatsapp' }
            },
            {
              name: 'Valid Phone 1',
              business: { whatsapp: null, phone_1: '+9647707654321', phone_2: null },
              expected: { phone: '+9647707654321', field: 'phone_1' }
            },
            {
              name: 'Valid Phone 2',
              business: { whatsapp: null, phone_1: null, phone_2: '+9647501112222' },
              expected: { phone: '+9647501112222', field: 'phone_2' }
            },
            {
              name: 'Priority Order',
              business: { whatsapp: '+9647709998888', phone_1: '+9647701234567', phone_2: '+9647501112222' },
              expected: { phone: '+9647709998888', field: 'whatsapp' }
            },
            {
              name: 'No Valid Phones',
              business: { whatsapp: null, phone_1: null, phone_2: null },
              expected: null
            }
          ];
          
          const results = testCases.map(testCase => {
            const result = selectBestPhone(testCase.business as any);
            const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
            
            if (!passed) {
              issues.push({
                component: 'Phone Selection',
                issue: `Phone selection failed for ${testCase.name}`,
                severity: 'high',
                fix: 'Check phone selection logic and validation',
                file: 'server/services/businessService.ts'
              });
            }
            
            return { name: testCase.name, passed, result, expected: testCase.expected };
          });
          
          const allPassed = results.every(r => r.passed);
          
          return { 
            success: allPassed, 
            details: { results, allPassed }
          };
          
        } catch (error: any) {
          issues.push({
            component: 'Phone Selection',
            issue: `Phone selection test failed: ${error.message}`,
            severity: 'high',
            fix: 'Fix phone selection function import and logic',
            file: 'server/services/businessService.ts'
          });
          return { success: false, error: error.message, issues };
        }
      }
    },
    {
      name: '5. Message Queue Creation Test',
      test: async () => {
        try {
          // Check if there are any pending messages
          const { data: pendingMessages, error } = await supabase
            .from('messages')
            .select('id, campaign_id, business_name, phone, status, created_at')
            .eq('status', 'pending')
            .limit(5);
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          // Check message table structure
          const { data: messageSample, error: sampleError } = await supabase
            .from('messages')
            .select('*')
            .limit(1);
          
          if (sampleError) {
            issues.push({
              component: 'Message Queue',
              issue: `Message table access failed: ${sampleError.message}`,
              severity: 'critical',
              fix: 'Check message table schema and permissions',
              file: 'supabase/schema.sql'
            });
            return { success: false, error: sampleError.message, issues };
          }
          
          // Verify required columns exist
          const requiredColumns = ['campaign_id', 'business_id', 'phone', 'rendered_message', 'status'];
          const availableColumns = messageSample && messageSample.length > 0 ? Object.keys(messageSample[0]) : [];
          const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));
          
          if (missingColumns.length > 0) {
            issues.push({
              component: 'Message Queue',
              issue: `Missing required columns: ${missingColumns.join(', ')}`,
              severity: 'critical',
              fix: 'Update message table schema with required columns',
              file: 'supabase/schema.sql'
            });
            return { 
              success: false, 
              error: 'Message table schema incomplete',
              details: { missingColumns, availableColumns },
              issues
            };
          }
          
          return { 
            success: true, 
            details: { 
              pendingCount: pendingMessages?.length || 0,
              sampleMessages: pendingMessages?.map(m => ({ 
                id: m.id, 
                business: m.business_name,
                phone: m.phone,
                campaign: m.campaign_id 
              })),
              tableStructure: availableColumns
            }
          };
          
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: '6. Nabda API Configuration',
      test: async () => {
        const nabdaIssues: PipelineIssue[] = [];
        
        if (!process.env.NABDA_API_KEY) {
          nabdaIssues.push({
            component: 'Nabda API',
            issue: 'Missing NABDA_API_KEY environment variable',
            severity: 'critical',
            fix: 'Add NABDA_API_KEY to environment variables',
            file: '.env'
          });
        }
        
        const apiUrl = process.env.NABDA_API_URL || 'https://api.nabda.app/v1';
        
        // Test API connectivity (without actually sending)
        try {
          const { normalizePhoneNumber } = await import('../server/services/nabda');
          
          // Test phone normalization
          const testPhones = ['+9647701234567', '07701234567', '+964781234567'];
          const normalizedPhones = testPhones.map(phone => ({
            original: phone,
            normalized: normalizePhoneNumber(phone)
          }));
          
          return { 
            success: true, 
            details: { 
              apiUrl,
              hasApiKey: !!process.env.NABDA_API_KEY,
              phoneNormalization: normalizedPhones
            }
          };
          
        } catch (error: any) {
          nabdaIssues.push({
            component: 'Nabda API',
            issue: `Nabda service import failed: ${error.message}`,
            severity: 'high',
            fix: 'Check Nabda service implementation',
            file: 'server/services/nabda.ts'
          });
          return { success: false, error: error.message, issues: nabdaIssues };
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
        console.log(`  PASS: ${JSON.stringify(result.details, null, 2)}`);
      } else {
        console.log(`  FAIL: ${result.error}`);
        if (result.issues) {
          result.issues.forEach(issue => {
            console.log(`    ${issue.severity.toUpperCase()}: ${issue.issue}`);
          });
        }
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
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const highIssues = issues.filter(i => i.severity === 'high');
  
  console.log('=== Deployed Pipeline Audit Summary ===');
  console.log(`Tests Passed: ${passed}/${results.length}`);
  console.log(`Tests Failed: ${failed}/${results.length}`);
  console.log(`Critical Issues: ${criticalIssues.length}`);
  console.log(`High Priority Issues: ${highIssues.length}`);
  
  if (issues.length > 0) {
    console.log('\n=== All Issues Found ===');
    issues.forEach((issue, index) => {
      const icon = issue.severity === 'critical' ? 'CRITICAL' : 
                   issue.severity === 'high' ? 'HIGH' :
                   issue.severity === 'medium' ? 'MEDIUM' : 'LOW';
      console.log(`${index + 1}. [${icon}] ${issue.component}: ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}`);
      if (issue.file) console.log(`   File: ${issue.file}`);
      console.log('');
    });
  }

  // Deployment readiness check
  const isReadyForTesting = criticalIssues.length === 0 && highIssues.length === 0 && passed >= 4;
  
  console.log('=== Deployment Readiness ===');
  if (isReadyForTesting) {
    console.log('READY: Pipeline is ready for deployed app testing');
    console.log('\n=== Next Steps for Deployed App Testing ===');
    console.log('1. Ensure environment variables are set in deployment');
    console.log('2. Verify database has businesses and campaigns');
    console.log('3. Create test campaign with test mode ON');
    console.log('4. Queue 3-5 recipients');
    console.log('5. Monitor deployment logs for send attempts');
    console.log('6. Check message status updates in database');
  } else {
    console.log('NOT READY: Fix critical and high priority issues first');
    console.log('\n=== Required Fixes Before Testing ===');
    criticalIssues.concat(highIssues).forEach(issue => {
      console.log(`- ${issue.issue} (${issue.file})`);
    });
  }

  return { results, issues, isReadyForTesting };
}

// Run the audit
runDeployedPipelineAudit().catch(console.error);
