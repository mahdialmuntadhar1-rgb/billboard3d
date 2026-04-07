const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMinimalInsert() {
  try {
    console.log('Testing minimal insert...');
    
    // Try with just the absolutely required fields
    const testRecord = {
      name: 'Test Business',
      category: 'Test Category',
      city: 'Test City',
      governorate: 'Test Governorate'
    };
    
    const { data, error } = await supabase
      .from('staging_businesses')
      .insert(testRecord)
      .select();
    
    if (error) {
      console.error('Minimal insert failed:', error);
      return;
    }
    
    console.log('✅ Minimal insert successful!');
    console.log('Record:', data[0]);
    
    // Clean up
    await supabase
      .from('staging_businesses')
      .delete()
      .eq('id', data[0].id);
    
    console.log('✅ Test record cleaned up');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMinimalInsert();
