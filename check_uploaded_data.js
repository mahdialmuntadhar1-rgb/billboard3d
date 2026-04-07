const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUploadedData() {
    console.log('🔍 Checking uploaded data details...');
    
    try {
        // Get sample records with all available columns
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .limit(5);
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('\n📊 Available columns in database:');
        if (data.length > 0) {
            console.log(Object.keys(data[0]));
        }
        
        console.log('\n📋 Sample records (first 5):');
        data.forEach((record, index) => {
            console.log(`\n${index + 1}. ${JSON.stringify(record, null, 2)}`);
        });
        
        // Check categories distribution
        const { data: categories } = await supabase
            .from('businesses')
            .select('category')
            .limit(1000);
        
        if (categories) {
            const categoryCount = {};
            categories.forEach(item => {
                const cat = item.category || 'Unknown';
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            });
            
            console.log('\n📈 Categories distribution:');
            Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([category, count]) => {
                    console.log(`  ${category}: ${count} businesses`);
                });
            
            console.log(`\nTotal categories: ${Object.keys(categoryCount).length}`);
        }
        
        // Check for missing data
        const { data: phoneCheck } = await supabase
            .from('businesses')
            .select('name, phone')
            .limit(10);
        
        console.log('\n📞 Phone numbers check:');
        phoneCheck.forEach((record, index) => {
            console.log(`${index + 1}. ${record.name}: "${record.phone || 'NO PHONE'}"`);
        });
        
    } catch (error) {
        console.error('Error checking data:', error);
    }
}

checkUploadedData();
