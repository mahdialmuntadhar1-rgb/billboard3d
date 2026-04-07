const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function discoverSchema() {
  try {
    console.log('Discovering actual schema...');
    
    // Try to get table info through a describe query
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: 'staging_businesses' });
    
    if (error) {
      console.log('RPC method not available, trying alternative...');
      
      // Try inserting with different field combinations to discover required fields
      const testFields = [
        { name: 'Test', category: 'Test', city: 'Test', governorate: 'Test', source: 'excel_upload' },
        { name: 'Test', category: 'Test', city: 'Test', governorate: 'Test', source: 'excel_upload', status: 'validated' },
        { name: 'Test', category: 'Test', city: 'Test', governorate: 'Test', source: 'excel_upload', confidence: 0.8 },
      ];
      
      for (let i = 0; i < testFields.length; i++) {
        console.log(`\nTesting combination ${i + 1}:`, Object.keys(testFields[i]));
        
        const { data: insertData, error: insertError } = await supabase
          .from('staging_businesses')
          .insert(testFields[i])
          .select();
        
        if (insertError) {
          console.error('❌ Failed:', insertError.message);
        } else {
          console.log('✅ Success!');
          console.log('Record created:', insertData[0]);
          
          // Clean up
          await supabase
            .from('staging_businesses')
            .delete()
            .eq('id', insertData[0].id);
          
          break;
        }
      }
    } else {
      console.log('Table columns:', data);
    }
    
  } catch (error) {
    console.error('Schema discovery failed:', error);
  }
}

discoverSchema();
