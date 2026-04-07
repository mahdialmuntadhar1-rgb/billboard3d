const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearUUIDTables() {
    console.log('Clearing UUID-based tables...');
    
    try {
        // Tables that likely use UUID primary keys
        const uuidTables = ['agents', 'agent_tasks'];
        
        for (const table of uuidTables) {
            console.log(`Processing table: ${table}`);
            
            // Get all records first
            const { data: records, error: fetchError } = await supabase
                .from(table)
                .select('*');
            
            if (fetchError) {
                console.error(`Error fetching from ${table}:`, fetchError);
                continue;
            }
            
            if (!records || records.length === 0) {
                console.log(`✓ ${table} is already empty`);
                continue;
            }
            
            console.log(`Found ${records.length} records in ${table}`);
            
            // Delete each record individually by ID
            let deletedCount = 0;
            for (const record of records) {
                const { error: deleteError } = await supabase
                    .from(table)
                    .delete()
                    .eq('id', record.id);
                
                if (deleteError) {
                    console.error(`Error deleting record ${record.id}:`, deleteError);
                } else {
                    deletedCount++;
                }
            }
            
            console.log(`✓ Successfully deleted ${deletedCount}/${records.length} records from ${table}`);
        }
        
        // Final verification
        console.log('\nFinal verification:');
        const allTables = ['agents', 'businesses', 'sync_runs', 'agent_tasks', 'users'];
        
        for (const table of allTables) {
            const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            console.log(`${table}: ${count || 0} rows`);
        }
        
        console.log('\n✓ Database cleanup completed successfully!');
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

clearUUIDTables();
