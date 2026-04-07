const { createClient } = require('@supabase/supabase-js');

// Source database (where data comes from)
const SOURCE_URL = 'https://ujdsxzvvgaugypwtugdl.supabase.co';
const SOURCE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZHN4enZ2Z2F1Z3lwdHVnZGwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.XWDbzIPZNPk6j1GXixcIJKUb4lp48ipC7jExG2Q09Ns';

// Target database (where data goes to)
const TARGET_URL = 'https://hsadukhmcclwixuntqwu.supabase.co';
const TARGET_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const sourceClient = createClient(SOURCE_URL, SOURCE_ANON_KEY);
const targetClient = createClient(TARGET_URL, TARGET_SERVICE_KEY);

class SupabasePipeline {
    constructor() {
        this.sourceClient = sourceClient;
        this.targetClient = targetClient;
    }

    async testConnections() {
        console.log('Testing database connections...');
        
        try {
            // Test source connection
            const { data: sourceData, error: sourceError } = await this.sourceClient
                .from('businesses')
                .select('count')
                .limit(1);
            
            if (sourceError) {
                console.error('❌ Source database connection failed:', sourceError.message);
                return false;
            }
            console.log('✅ Source database connected successfully');

            // Test target connection
            const { data: targetData, error: targetError } = await this.targetClient
                .from('businesses')
                .select('count')
                .limit(1);
            
            if (targetError) {
                console.error('❌ Target database connection failed:', targetError.message);
                return false;
            }
            console.log('✅ Target database connected successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }

    async getSourceDataCount() {
        try {
            const { count, error } = await this.sourceClient
                .from('businesses')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return count;
        } catch (error) {
            console.error('Error getting source data count:', error.message);
            return 0;
        }
    }

    async getTargetDataCount() {
        try {
            const { count, error } = await this.targetClient
                .from('businesses')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return count;
        } catch (error) {
            console.error('Error getting target data count:', error.message);
            return 0;
        }
    }

    async fetchSourceData(batchSize = 100, offset = 0) {
        try {
            const { data, error } = await this.sourceClient
                .from('businesses')
                .select('*')
                .range(offset, offset + batchSize - 1)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching source data:', error.message);
            return [];
        }
    }

    async transformData(sourceData) {
        // Transform data to match target schema if needed
        return sourceData.map(record => {
            // Remove fields that don't exist in target
            const { id, ...transformed } = record;
            
            // Generate new UUID for target
            transformed.id = require('uuid').v4();
            
            // Ensure timestamps are properly formatted
            transformed.created_at = record.created_at || new Date().toISOString();
            transformed.updated_at = new Date().toISOString();
            
            return transformed;
        });
    }

    async insertTargetData(data) {
        try {
            const { error } = await this.targetClient
                .from('businesses')
                .insert(data);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error inserting target data:', error.message);
            return false;
        }
    }

    async syncData(options = {}) {
        const {
            batchSize = 100,
            dryRun = false,
            clearTarget = false
        } = options;

        console.log(`\n🚀 Starting pipeline sync...`);
        console.log(`Batch size: ${batchSize}`);
        console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
        console.log(`Clear target first: ${clearTarget ? 'YES' : 'NO'}`);

        // Test connections first
        const connectionsOk = await this.testConnections();
        if (!connectionsOk) return;

        // Get data counts
        const sourceCount = await this.getSourceDataCount();
        const targetCount = await this.getTargetDataCount();
        
        console.log(`\n📊 Data counts:`);
        console.log(`Source: ${sourceCount} records`);
        console.log(`Target: ${targetCount} records`);

        if (clearTarget && !dryRun) {
            console.log('\n🧹 Clearing target database...');
            const { error } = await this.targetClient
                .from('businesses')
                .delete()
                .gte('id', '');
            
            if (error) {
                console.error('Error clearing target:', error.message);
                return;
            }
            console.log('✅ Target database cleared');
        }

        // Sync data in batches
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalErrors = 0;

        for (let offset = 0; offset < sourceCount; offset += batchSize) {
            const currentBatch = Math.min(batchSize, sourceCount - offset);
            console.log(`\n📦 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(sourceCount/batchSize)} (${currentBatch} records)...`);

            // Fetch from source
            const sourceData = await this.fetchSourceData(batchSize, offset);
            if (sourceData.length === 0) {
                console.log('No more data to process');
                break;
            }

            // Transform data
            const transformedData = await this.transformData(sourceData);
            totalProcessed += transformedData.length;

            if (dryRun) {
                console.log(`🔍 DRY RUN: Would insert ${transformedData.length} records`);
                totalSuccess += transformedData.length;
            } else {
                // Insert to target
                const success = await this.insertTargetData(transformedData);
                if (success) {
                    console.log(`✅ Successfully inserted ${transformedData.length} records`);
                    totalSuccess += transformedData.length;
                } else {
                    console.log(`❌ Failed to insert batch`);
                    totalErrors += transformedData.length;
                }
            }

            // Progress
            const progress = Math.round((offset + batchSize) / sourceCount * 100);
            console.log(`📈 Progress: ${progress}% (${totalSuccess}/${sourceCount})`);
        }

        // Final report
        console.log(`\n🎉 Pipeline completed!`);
        console.log(`📊 Final results:`);
        console.log(`Total processed: ${totalProcessed}`);
        console.log(`✅ Successful: ${totalSuccess}`);
        console.log(`❌ Errors: ${totalErrors}`);
        console.log(`📈 Success rate: ${Math.round(totalSuccess/totalProcessed * 100)}%`);

        // Verify final counts
        const finalTargetCount = await this.getTargetDataCount();
        console.log(`\n📊 Final counts:`);
        console.log(`Source: ${sourceCount}`);
        console.log(`Target: ${finalTargetCount}`);
        console.log(`Difference: ${Math.abs(sourceCount - finalTargetCount)}`);
    }

    async createRealtimeSync() {
        console.log('🔄 Setting up realtime sync...');
        
        // This would require setting up Supabase Realtime subscriptions
        // For now, we'll implement a polling-based approach
        const syncInterval = 60000; // 1 minute
        
        setInterval(async () => {
            console.log('🔄 Running scheduled sync...');
            await this.syncData({ batchSize: 50, dryRun: false, clearTarget: false });
        }, syncInterval);
        
        console.log(`✅ Realtime sync enabled (polling every ${syncInterval/1000} seconds)`);
    }
}

// Command line interface
async function main() {
    const pipeline = new SupabasePipeline();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'sync';
    
    switch (command) {
        case 'test':
            await pipeline.testConnections();
            break;
            
        case 'count':
            const sourceCount = await pipeline.getSourceDataCount();
            const targetCount = await pipeline.getTargetDataCount();
            console.log(`Source: ${sourceCount}, Target: ${targetCount}`);
            break;
            
        case 'dry-run':
            await pipeline.syncData({ dryRun: true });
            break;
            
        case 'sync':
            const clearTarget = args.includes('--clear');
            await pipeline.syncData({ dryRun: false, clearTarget });
            break;
            
        case 'realtime':
            await pipeline.createRealtimeSync();
            break;
            
        default:
            console.log(`
Usage: node supabase_pipeline.js <command>

Commands:
  test       - Test database connections
  count      - Show record counts for both databases
  dry-run    - Show what would be synced without actually doing it
  sync       - Sync data from source to target
  sync --clear - Clear target before syncing
  realtime   - Start continuous sync (polls every minute)
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SupabasePipeline;
