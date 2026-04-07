const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

// Supabase configuration
const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importBusinessData() {
    try {
        console.log('Starting business data import...');
        
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        const worksheet = workbook.Sheets['All 1800 Businesses'];
        
        // Convert to JSON with proper headers
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`Found ${data.length} businesses to import`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Process businesses in batches
        const batchSize = 50;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${batch.length} records)`);
            
            for (const business of batch) {
                try {
                    // Map Excel data to database schema
                    const businessData = {
                        id: uuidv4(),
                        business_id: business['ID'] || `BIZ_${Math.random().toString(36).substr(2, 9)}`,
                        business_name: business['Business Name'] || '',
                        arabic_name: business['Arabic Name'] || '',
                        english_name: business['English Name'] || business['Business Name'] || '',
                        category: business['Category'] || '',
                        subcategory: business['Subcategory'] || '',
                        governorate: business['Governorate'] || '',
                        city: business['City'] || '',
                        neighborhood: business['Neighborhood'] || '',
                        phone1: business['Phone 1'] || '',
                        phone2: business['Phone 2'] || '',
                        whatsapp: business['WhatsApp'] || '',
                        email1: business['Email 1'] || '',
                        website: business['Website'] || '',
                        facebook: business['Facebook'] || '',
                        instagram: business['Instagram'] || '',
                        tiktok: business['Tiktok'] || '',
                        telegram: business['Telegram'] || '',
                        opening_hours: business['Opening Hours'] || '',
                        status: business['Status'] || 'Unknown',
                        rating: parseFloat(business['Rating']) || null,
                        verification: business['Verification'] || '',
                        confidence: parseInt(business['Confidence']) || null,
                        has_whatsapp: business['Type'] && business['Type'].includes('WhatsApp'),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    // Insert into database
                    const { error } = await supabase
                        .from('businesses')
                        .insert([businessData]);
                    
                    if (error) {
                        console.error(`Error inserting business "${businessData.business_name}":`, error);
                        errorCount++;
                    } else {
                        successCount++;
                        if (successCount % 100 === 0) {
                            console.log(`✓ Successfully imported ${successCount} businesses`);
                        }
                    }
                    
                } catch (err) {
                    console.error(`Error processing business:`, err);
                    errorCount++;
                }
            }
            
            // Small delay to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`\nImport completed!`);
        console.log(`✓ Successfully imported: ${successCount} businesses`);
        console.log(`✗ Failed to import: ${errorCount} businesses`);
        console.log(`Total processed: ${successCount + errorCount} businesses`);
        
        // Verify import
        const { count } = await supabase
            .from('businesses')
            .select('*', { count: 'exact', head: true });
        
        console.log(`\nVerification: Total businesses in database: ${count}`);
        
    } catch (error) {
        console.error('Fatal error during import:', error);
    }
}

// Install uuid package if needed
async function checkDependencies() {
    try {
        require('uuid');
    } catch (e) {
        console.log('Installing uuid package...');
        const { execSync } = require('child_process');
        execSync('npm install uuid', { stdio: 'inherit' });
    }
}

checkDependencies().then(() => {
    importBusinessData();
});
