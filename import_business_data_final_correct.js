const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

// Supabase configuration
const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importBusinessDataFinal() {
    try {
        console.log('Starting FINAL business data import...');
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
        
        // Convert to proper JSON format and filter valid records
        const data = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        }).filter(row => row['Business Name'] && row['Business Name'].trim());
        
        console.log(`Valid businesses after filtering: ${data.length}`);
        
        // Prepare all records for bulk insert - ONLY using columns that exist in the schema
        const businessesToInsert = [];
        let skippedCount = 0;
        
        for (const business of data) {
            const name = business['Business Name'] || business['English Name'] || '';
            const category = business['Category'] || '';
            const city = business['City'] || '';
            const phone = business['Phone 1'] || business['Phone 2'] || '';
            const governorate = business['Governorate'] || '';
            
            // Skip if missing required fields
            if (!name.trim() || !category.trim() || !city.trim() || !governorate.trim()) {
                skippedCount++;
                continue;
            }
            
            businessesToInsert.push({
                id: uuidv4(),
                name: name.trim(),
                category: category.trim(),
                city: city.trim(),
                phone: phone.trim(),
                governorate: governorate.trim(),
                requested_category: category.trim(),
                // Remove confidence as it doesn't exist in the schema
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        console.log(`Prepared ${businessesToInsert.length} businesses for insertion`);
        console.log(`Skipped ${skippedCount} businesses due to missing data`);
        
        // Insert in larger batches (100 records at a time)
        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < businessesToInsert.length; i += batchSize) {
            const batch = businessesToInsert.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(businessesToInsert.length/batchSize);
            
            console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
            
            try {
                const { error, data: insertedData } = await supabase
                    .from('businesses')
                    .insert(batch)
                    .select('id');
                
                if (error) {
                    console.error(`Batch ${batchNum} error:`, error.message);
                    
                    // If bulk insert fails, try individual inserts for this batch
                    console.log(`Trying individual inserts for batch ${batchNum}...`);
                    for (const business of batch) {
                        try {
                            const { error: individualError } = await supabase
                                .from('businesses')
                                .insert([business]);
                            
                            if (individualError) {
                                if (individualError.message.includes('unique_business_name_phone')) {
                                    skippedCount++;
                                } else {
                                    console.error(`Error inserting ${business.name}:`, individualError.message);
                                    errorCount++;
                                }
                            } else {
                                successCount++;
                            }
                        } catch (err) {
                            console.error(`Error with individual insert:`, err.message);
                            errorCount++;
                        }
                    }
                } else {
                    successCount += batch.length;
                    console.log(`✓ Batch ${batchNum} completed successfully (${batch.length} records)`);
                }
            } catch (err) {
                console.error(`Batch ${batchNum} exception:`, err.message);
                errorCount += batch.length;
            }
        }
        
        console.log(`\nImport completed!`);
        console.log(`✓ Successfully imported: ${successCount} businesses`);
        console.log(`⚠️  Skipped (duplicates/missing data): ${skippedCount} businesses`);
        console.log(`✗ Failed to import: ${errorCount} businesses`);
        
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

// Run the final import
importBusinessDataFinal();
