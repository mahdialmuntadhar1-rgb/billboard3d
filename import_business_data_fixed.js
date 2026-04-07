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
        console.log(`Target database: ${supabaseUrl}`);
        
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        const worksheet = workbook.Sheets['All 1800 Businesses'];
        
        // Convert to raw data first to handle the header issue
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip the first row (merged title) and use the second row as headers
        const headers = rawData[1];
        const dataRows = rawData.slice(2); // Skip first two rows (title + headers)
        
        console.log(`Found ${dataRows.length} businesses to import`);
        console.log('Headers:', headers);
        
        // Convert to proper JSON format
        const data = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        }).filter(row => row['Business Name'] && row['Business Name'].trim()); // Filter out empty rows
        
        console.log(`Valid businesses after filtering: ${data.length}`);
        
        // Check current count
        const { count: currentCount } = await supabase
            .from('businesses')
            .select('*', { count: 'exact', head: true });
        
        console.log(`Current businesses in database: ${currentCount}`);
        
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        // Process businesses in batches
        const batchSize = 25;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${batch.length} records)`);
            
            for (const business of batch) {
                try {
                    // Extract required fields according to the actual schema
                    const name = business['Business Name'] || business['English Name'] || '';
                    const category = business['Category'] || '';
                    const city = business['City'] || '';
                    const phone = business['Phone 1'] || business['Phone 2'] || '';
                    const governorate = business['Governorate'] || '';
                    
                    // Skip if missing required fields
                    if (!name.trim() || !category.trim() || !city.trim() || !governorate.trim()) {
                        console.log(`⚠️  Skipping business with missing required fields: "${name}"`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Map Excel data to actual database schema
                    const businessData = {
                        id: uuidv4(),
                        name: name.trim(),
                        category: category.trim(),
                        city: city.trim(),
                        phone: phone.trim(),
                        governorate: governorate.trim(),
                        requested_category: category.trim(), // Use the same category as requested
                        confidence: business['Confidence'] ? parseFloat(business['Confidence']) / 100 : 0.5, // Convert to decimal
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    // Insert into database
                    const { error } = await supabase
                        .from('businesses')
                        .insert([businessData]);
                    
                    if (error) {
                        // Check if it's a duplicate error
                        if (error.message.includes('unique_business_name_phone')) {
                            console.log(`⚠️  Skipping duplicate business: ${name} (${phone})`);
                            skippedCount++;
                        } else {
                            console.error(`Error inserting business "${name}":`, error.message);
                            errorCount++;
                        }
                    } else {
                        successCount++;
                        if (successCount % 50 === 0) {
                            console.log(`✓ Successfully imported ${successCount} businesses`);
                        }
                    }
                    
                } catch (err) {
                    console.error(`Error processing business:`, err.message);
                    errorCount++;
                }
            }
            
            // Small delay to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`\nImport completed!`);
        console.log(`✓ Successfully imported: ${successCount} businesses`);
        console.log(`⚠️  Skipped (duplicates/missing data): ${skippedCount} businesses`);
        console.log(`✗ Failed to import: ${errorCount} businesses`);
        console.log(`Total processed: ${successCount + skippedCount + errorCount} businesses`);
        
        // Verify import
        const { count: finalCount } = await supabase
            .from('businesses')
            .select('*', { count: 'exact', head: true });
        
        console.log(`\nFinal verification: Total businesses in database: ${finalCount}`);
        
        // Show sample of imported data
        const { data: sample } = await supabase
            .from('businesses')
            .select('name, category, city, governorate')
            .limit(5);
        
        if (sample && sample.length > 0) {
            console.log('\nSample imported businesses:');
            sample.forEach((biz, index) => {
                console.log(`${index + 1}. ${biz.name} - ${biz.category} (${biz.city}, ${biz.governorate})`);
            });
        }
        
    } catch (error) {
        console.error('Fatal error during import:', error);
    }
}

// Run the import
importBusinessData();
