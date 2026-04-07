const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    try {
        console.log('Checking businesses table schema...');
        
        // Try to get one record to see the actual columns
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        if (data && data.length > 0) {
            console.log('Actual columns in businesses table:');
            console.log(Object.keys(data[0]));
        } else {
            console.log('No data in businesses table, trying to describe table...');
            
            // Alternative: Try to get column info from information_schema
            const { data: columns, error: colError } = await supabase
                .rpc('get_table_columns', { table_name: 'businesses' });
            
            if (colError) {
                console.log('Cannot get column info automatically');
                console.log('Trying to insert a test record to discover schema...');
                
                // Try a minimal insert to see what columns are required
                const testRecord = {
                    business_name: 'Test Business',
                    category: 'Test Category'
                };
                
                const { error: insertError } = await supabase
                    .from('businesses')
                    .insert([testRecord]);
                
                if (insertError) {
                    console.log('Insert error shows required columns:', insertError.message);
                } else {
                    console.log('Minimal insert succeeded');
                }
            } else {
                console.log('Columns:', columns);
            }
        }
        
    } catch (error) {
        console.error('Error checking schema:', error);
    }
}

checkSchema();
