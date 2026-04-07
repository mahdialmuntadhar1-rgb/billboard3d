const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

// Target database configuration
const TARGET_URL = 'https://hsadukhmcclwixuntqwu.supabase.co';
const TARGET_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const targetClient = createClient(TARGET_URL, TARGET_SERVICE_KEY);

class WorkingPipeline {
    async importFromExcel(filePath) {
        console.log(`📁 Importing data from Excel: ${filePath}`);
        
        try {
            // Read the Excel file
            const workbook = XLSX.readFile(filePath);
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
            
            // Prepare records for database - ONLY using existing columns
            const businessesToInsert = [];
            
            for (const business of data) {
                const name = business['Business Name'] || business['English Name'] || '';
                const category = business['Category'] || '';
                const city = business['City'] || '';
                const governorate = business['Governorate'] || '';
                
                if (!name.trim() || !category.trim() || !city.trim() || !governorate.trim()) {
                    continue;
                }
                
                businessesToInsert.push({
                    id: uuidv4(),
                    name: name.trim(),
                    category: category.trim(),
                    city: city.trim(),
                    governorate: governorate.trim()
                    // ONLY the columns that actually exist
                });
            }
            
            console.log(`Prepared ${businessesToInsert.length} businesses for insertion`);
            
            // Insert in batches
            const batchSize = 100;
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < businessesToInsert.length; i += batchSize) {
                const batch = businessesToInsert.slice(i, i + batchSize);
                const batchNum = Math.floor(i/batchSize) + 1;
                const totalBatches = Math.ceil(businessesToInsert.length/batchSize);
                
                console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
                
                try {
                    const { error } = await targetClient
                        .from('businesses')
                        .insert(batch);
                    
                    if (error) {
                        console.error(`Batch ${batchNum} error:`, error.message);
                        errorCount += batch.length;
                    } else {
                        successCount += batch.length;
                        console.log(`✅ Batch ${batchNum} completed successfully`);
                    }
                } catch (err) {
                    console.error(`Batch ${batchNum} exception:`, err.message);
                    errorCount += batch.length;
                }
            }
            
            console.log(`\n📊 Import completed!`);
            console.log(`✅ Successfully imported: ${successCount} businesses`);
            console.log(`❌ Failed to import: ${errorCount} businesses`);
            
            return successCount;
            
        } catch (error) {
            console.error('❌ Excel import failed:', error.message);
            return 0;
        }
    }

    async getStatus() {
        console.log('📊 Pipeline Status:');
        
        try {
            // Get target database status
            const { count: targetCount, error } = await targetClient
                .from('businesses')
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Error getting status:', error.message);
            } else {
                console.log(`Target database: ${targetCount} records`);
                
                // Show sample data
                if (targetCount > 0) {
                    const { data: sample } = await targetClient
                        .from('businesses')
                        .select('name, category, city, governorate')
                        .limit(3);
                    
                    console.log('\nSample records:');
                    sample.forEach((biz, index) => {
                        console.log(`${index + 1}. ${biz.name} - ${biz.category} (${biz.city}, ${biz.governorate})`);
                    });
                }
            }
        } catch (error) {
            console.error('❌ Status check failed:', error.message);
        }
    }

    async clearTarget() {
        console.log('🧹 Clearing target database...');
        
        try {
            const { error } = await targetClient
                .from('businesses')
                .delete()
                .gte('id', '');
            
            if (error) throw error;
            console.log('✅ Target database cleared');
            
        } catch (error) {
            console.error('❌ Failed to clear target:', error.message);
        }
    }

    async exportToExcel(filePath) {
        console.log(`📤 Exporting data to Excel: ${filePath}`);
        
        try {
            // Get all data from target
            const { data, error } = await targetClient
                .from('businesses')
                .select('*');
            
            if (error) throw error;
            
            console.log(`Exporting ${data.length} records`);
            
            // Convert to Excel format
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Businesses');
            
            XLSX.writeFile(wb, filePath);
            console.log(`✅ Successfully exported to ${filePath}`);
            
        } catch (error) {
            console.error('❌ Export failed:', error.message);
        }
    }
}

// Command line interface
async function main() {
    const pipeline = new WorkingPipeline();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'status';
    
    switch (command) {
        case 'import':
            const excelPath = args[1] || 'C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx';
            await pipeline.importFromExcel(excelPath);
            break;
            
        case 'status':
            await pipeline.getStatus();
            break;
            
        case 'clear':
            await pipeline.clearTarget();
            break;
            
        case 'export':
            const exportPath = args[1] || './exported_businesses.xlsx';
            await pipeline.exportToExcel(exportPath);
            break;
            
        default:
            console.log(`
Working Pipeline - Uses only confirmed existing columns

Usage: node pipeline_working.js <command> [options]

Commands:
  import [path]         - Import data from Excel file
  status               - Show pipeline status and sample data
  clear                - Clear target database
  export [path]        - Export target data to Excel

Examples:
  node pipeline_working.js import
  node pipeline_working.js status
  node pipeline_working.js clear
  node pipeline_working.js export "./backup.xlsx"
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WorkingPipeline;
