const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMinimalSchema() {
    console.log('Testing minimal schema...');
    
    // Try the absolute minimum required fields based on the schema we saw
    const testRecord = {
        id: uuidv4(),
        name: 'Test Business',
        category: 'Test Category',
        city: 'Test City',
        governorate: 'Test Governorate'
    };
    
    console.log('Trying minimal insert with:', Object.keys(testRecord));
    
    try {
        const { error } = await supabase
            .from('businesses')
            .insert([testRecord]);
        
        if (error) {
            console.error('❌ Minimal insert failed:', error.message);
            
            // Try adding phone field
            console.log('Trying with phone field...');
            const testRecord2 = {
                ...testRecord,
                id: uuidv4(),
                phone: '1234567890'
            };
            
            const { error: error2 } = await supabase
                .from('businesses')
                .insert([testRecord2]);
            
            if (error2) {
                console.error('❌ Insert with phone failed:', error2.message);
            } else {
                console.log('✅ Insert with phone succeeded!');
            }
        } else {
            console.log('✅ Minimal insert succeeded!');
        }
        
    } catch (error) {
        console.error('❌ Exception:', error.message);
    }
}

testMinimalSchema();
