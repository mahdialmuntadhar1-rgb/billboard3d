const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const config = require('./pipeline_config');

class EnhancedSupabasePipeline {
    constructor() {
        this.targetClient = createClient(config.target.url, config.target.serviceKey);
        
        // Source client (if available)
        this.sourceClient = null;
        if (config.source.serviceKey !== 'YOUR_SOURCE_SERVICE_ROLE_KEY_HERE') {
            this.sourceClient = createClient(config.source.url, config.source.serviceKey);
        }
    }

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
            
            // Prepare records for database
            const businessesToInsert = [];
            
            for (const business of data) {
                const name = business['Business Name'] || business['English Name'] || '';
                const category = business['Category'] || '';
                const city = business['City'] || '';
                const phone = business['Phone 1'] || business['Phone 2'] || '';
                const governorate = business['Governorate'] || '';
                
                if (!name.trim() || !category.trim() || !city.trim() || !governorate.trim()) {
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
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
            
            console.log(`Prepared ${businessesToInsert.length} businesses for insertion`);
            
            // Insert in batches
            const batchSize = config.settings.batchSize;
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < businessesToInsert.length; i += batchSize) {
                const batch = businessesToInsert.slice(i, i + batchSize);
                const batchNum = Math.floor(i/batchSize) + 1;
                const totalBatches = Math.ceil(businessesToInsert.length/batchSize);
                
                console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
                
                try {
                    const { error } = await this.targetClient
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

    async syncFromSource() {
        if (!this.sourceClient) {
            console.error('❌ Source database not configured. Please update pipeline_config.js');
            return false;
        }
        
        console.log('🔄 Syncing from source database...');
        
        try {
            // Get source data count
            const { count: sourceCount, error: sourceError } = await this.sourceClient
                .from('businesses')
                .select('*', { count: 'exact', head: true });
            
            if (sourceError) throw sourceError;
            
            console.log(`Source database has ${sourceCount} records`);
            
            // Fetch all data from source
            const { data: sourceData, error: fetchError } = await this.sourceClient
                .from('businesses')
                .select('*');
            
            if (fetchError) throw fetchError;
            
            console.log(`Fetched ${sourceData.length} records from source`);
            
            // Transform data (remove old IDs, create new ones)
            const transformedData = sourceData.map(record => {
                const { id, ...rest } = record;
                return {
                    ...rest,
                    id: uuidv4(),
                    created_at: record.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            });
            
            // Clear target and insert new data
            console.log('🧹 Clearing target database...');
            await this.targetClient.from('businesses').delete().gte('id', '');
            
            console.log('📥 Inserting data into target...');
            const { error: insertError } = await this.targetClient
                .from('businesses')
                .insert(transformedData);
            
            if (insertError) throw insertError;
            
            console.log(`✅ Successfully synced ${transformedData.length} records`);
            return true;
            
        } catch (error) {
            console.error('❌ Sync failed:', error.message);
            return false;
        }
    }

    async exportToExcel(filePath) {
        console.log(`📤 Exporting data to Excel: ${filePath}`);
        
        try {
            // Get all data from target
            const { data, error } = await this.targetClient
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

    async getStatus() {
        console.log('📊 Pipeline Status:');
        
        // Target database status
        const { count: targetCount } = await this.targetClient
            .from('businesses')
            .select('*', { count: 'exact', head: true });
        
        console.log(`Target database: ${targetCount} records`);
        
        // Source database status (if available)
        if (this.sourceClient) {
            try {
                const { count: sourceCount } = await this.sourceClient
                    .from('businesses')
                    .select('*', { count: 'exact', head: true });
                
                console.log(`Source database: ${sourceCount} records`);
                console.log(`Sync status: ${targetCount === sourceCount ? '✅ In sync' : '⚠️ Out of sync'}`);
            } catch (error) {
                console.log('Source database: ❌ Connection failed');
            }
        } else {
            console.log('Source database: ❌ Not configured');
        }
    }

    async clearTarget() {
        console.log('🧹 Clearing target database...');
        
        try {
            const { error } = await this.targetClient
                .from('businesses')
                .delete()
                .gte('id', '');
            
            if (error) throw error;
            console.log('✅ Target database cleared');
            
        } catch (error) {
            console.error('❌ Failed to clear target:', error.message);
        }
    }
}

// Command line interface
async function main() {
    const pipeline = new EnhancedSupabasePipeline();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'status';
    
    switch (command) {
        case 'import-excel':
            const excelPath = args[1] || 'C:\\Users\\HB LAPTOP STORE\\Documents\\iraq_directory_all1800_combined.xlsx';
            await pipeline.importFromExcel(excelPath);
            break;
            
        case 'sync-source':
            await pipeline.syncFromSource();
            break;
            
        case 'export-excel':
            const exportPath = args[1] || './exported_businesses.xlsx';
            await pipeline.exportToExcel(exportPath);
            break;
            
        case 'status':
            await pipeline.getStatus();
            break;
            
        case 'clear':
            await pipeline.clearTarget();
            break;
            
        default:
            console.log(`
Enhanced Supabase Pipeline

Usage: node enhanced_pipeline.js <command> [options]

Commands:
  import-excel [path]    - Import data from Excel file
  sync-source           - Sync from source Supabase database
  export-excel [path]   - Export target data to Excel
  status                - Show pipeline status
  clear                 - Clear target database

Examples:
  node enhanced_pipeline.js import-excel "C:\\path\\to\\file.xlsx"
  node enhanced_pipeline.js sync-source
  node enhanced_pipeline.js export-excel "./backup.xlsx"
  node enhanced_pipeline.js status
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = EnhancedSupabasePipeline;
