const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSchema() {
  try {
    console.log('Testing Supabase connection and schema...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('staging_businesses')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error accessing staging_businesses:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Available columns in staging_businesses:');
      console.log(Object.keys(data[0]));
    } else {
      console.log('No data in staging_businesses, but connection successful');
      
      // Try to get column information by inserting a test record
      const testRecord = {
        name: 'Test Business',
        category: 'Test Category',
        city: 'Test City',
        governorate: 'Test Governorate',
        requested_category: 'Test Requested Category',
        confidence: 0.8,
        status: 'validated'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('staging_businesses')
        .insert(testRecord)
        .select();
      
      if (insertError) {
        console.error('Insert test failed:', insertError);
        
        // Try without requested_category
        const testRecord2 = {
          name: 'Test Business',
          category: 'Test Category',
          city: 'Test City',
          governorate: 'Test Governorate',
          confidence: 0.8,
          status: 'validated'
        };
        
        const { data: insertData2, error: insertError2 } = await supabase
          .from('staging_businesses')
          .insert(testRecord2)
          .select();
        
        if (insertError2) {
          console.error('Insert test 2 failed:', insertError2);
        } else {
          console.log('Insert test 2 successful!');
          console.log('Record inserted:', insertData2[0]);
          
          // Clean up
          await supabase
            .from('staging_businesses')
            .delete()
            .eq('id', insertData2[0].id);
        }
      } else {
        console.log('Insert test successful!');
        console.log('Record inserted:', insertData[0]);
        
        // Clean up
        await supabase
          .from('staging_businesses')
          .delete()
          .eq('id', insertData[0].id);
      }
    }
    
  } catch (error) {
    console.error('Schema test failed:', error);
  }
}

testSchema();
