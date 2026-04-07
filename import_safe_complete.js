const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importSafeComplete() {
    console.log('🔄 Clearing existing incomplete data...');
    
    // Clear the existing incomplete data
    await supabase.from('businesses').delete().gte('id', '');
    
    console.log('📁 Importing SAFE COMPLETE data from Excel...');
    
    try {
        // Read the Excel file
        const workbook = XLSX.readFile('C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx');
        const worksheet = workbook.Sheets['All 1800 Businesses'];
        
        // Convert to raw data first to handle the header issue
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip the first row (merged title) and use the second row as headers
        const headers = rawData[1];
        const dataRows = rawData.slice(2);
        
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
        
        // Prepare records with SAFE fields only
        const businessesToInsert = [];
        
        for (const business of data) {
            const name = business['Business Name'] || business['English Name'] || '';
            const arabicName = business['Arabic Name'] || '';
            const category = business['Category'] || '';
            const city = business['City'] || '';
            const governorate = business['Governorate'] || '';
            const phone1 = business['Phone 1'] || '';
            const phone2 = business['Phone 2'] || '';
            const whatsapp = business['WhatsApp'] || '';
            const website = business['Website'] || '';
            const openingHours = business['Opening Hours'] || '';
            const rating = business['Rating'] ? parseFloat(business['Rating']) : null;
            
            if (!name.trim() || !category.trim() || !city.trim() || !governorate.trim()) {
                continue;
            }
            
            // Only use safe, essential fields
            const businessRecord = {
                id: uuidv4(),
                name: name.trim(),
                nameAr: arabicName.trim() || null,
                category: category.trim(),
                governorate: governorate.trim(),
                city: city.trim(),
                phone: (phone1.trim() || phone2.trim() || null),
                whatsapp: whatsapp.trim() || null,
                website: website.trim() || null,
                openHours: openingHours.trim() || null,
                rating: rating && rating >= 0 && rating <= 5 ? rating : null,
                createdAt: new Date().toISOString()
            };
            
            businessesToInsert.push(businessRecord);
        }
        
        console.log(`Prepared ${businessesToInsert.length} safe complete businesses for insertion`);
        
        // Insert in smaller batches
        const batchSize = 25;
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < businessesToInsert.length; i += batchSize) {
            const batch = businessesToInsert.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(businessesToInsert.length/batchSize);
            
            console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
            
            try {
                const { error } = await supabase
                    .from('businesses')
                    .insert(batch);
                
                if (error) {
                    console.error(`Batch ${batchNum} error:`, error.message);
                    
                    // Try individual records to find the problematic one
                    console.log('Trying individual records...');
                    for (const record of batch) {
                        try {
                            const { error: individualError } = await supabase
                                .from('businesses')
                                .insert([record]);
                            
                            if (individualError) {
                                console.error(`Error with ${record.name}:`, individualError.message);
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        } catch (err) {
                            console.error(`Exception with ${record.name}:`, err.message);
                            errorCount++;
                        }
                    }
                } else {
                    successCount += batch.length;
                    console.log(`✅ Batch ${batchNum} completed successfully`);
                }
            } catch (err) {
                console.error(`Batch ${batchNum} exception:`, err.message);
                errorCount += batch.length;
            }
        }
        
        console.log(`\n📊 Safe Complete Import completed!`);
        console.log(`✅ Successfully imported: ${successCount} businesses`);
        console.log(`❌ Failed to import: ${errorCount} businesses`);
        
        // Show sample of imported data
        const { data: sample } = await supabase
            .from('businesses')
            .select('name, nameAr, category, phone, whatsapp, website, city, governorate, rating')
            .limit(5);
        
        if (sample && sample.length > 0) {
            console.log('\n📋 Sample imported businesses:');
            sample.forEach((biz, index) => {
                console.log(`${index + 1}. ${biz.name} (${biz.nameAr || 'No Arabic'})`);
                console.log(`   📱 ${biz.phone || 'No Phone'} | 💬 ${biz.whatsapp || 'No WhatsApp'}`);
                console.log(`   🌐 ${biz.website || 'No Website'} | ⭐ ${biz.rating || 'No Rating'}`);
                console.log(`   📍 ${biz.city}, ${biz.governorate} | 📂 ${biz.category}`);
                console.log('');
            });
        }
        
        // Check categories distribution
        const { data: categories } = await supabase
            .from('businesses')
            .select('category')
            .limit(2000);
        
        if (categories) {
            const categoryCount = {};
            categories.forEach(item => {
                const cat = item.category || 'Unknown';
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            });
            
            console.log('\n📈 Categories distribution:');
            Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .forEach(([category, count]) => {
                    console.log(`  ${category}: ${count} businesses`);
                });
            
            console.log(`\nTotal categories: ${Object.keys(categoryCount).length}`);
        }
        
    } catch (error) {
        console.error('❌ Safe complete import failed:', error.message);
    }
}

importSafeComplete();
