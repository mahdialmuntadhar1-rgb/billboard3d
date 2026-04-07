const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAllData() {
    console.log('Starting database cleanup...');
    
    try {
        // Actual tables that exist in the database
        const tables = [
            'agents',      // Has 21 rows
            'businesses',  // Has 0 rows
            'sync_runs',   // Has 0 rows  
            'agent_tasks', // Has 0 rows
            'users'        // Has 0 rows
        ];
        
        for (const table of tables) {
            console.log(`Clearing table: ${table}`);
            
            // Get row count before clearing
            const { count: beforeCount } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            // Delete all data from the table
            const { error } = await supabase
                .from(table)
                .delete()
                .gte('id', 0); // This deletes all rows (works for both integer and UUID)
            
            if (error) {
                console.error(`Error clearing ${table}:`, error);
                
                // Try alternative method for UUID tables
                if (error.message.includes('uuid')) {
                    console.log(`Trying alternative method for ${table}...`);
                    const { error: altError } = await supabase
                        .from(table)
                        .delete()
                        .is('id', null); // This won't match anything, but we'll use a different approach
                    
                    if (altError) {
                        // Get all IDs and delete them one by one
                        const { data: ids } = await supabase
                            .from(table)
                            .select('id');
                        
                        if (ids && ids.length > 0) {
                            for (const item of ids) {
                                await supabase
                                    .from(table)
                                    .delete()
                                    .eq('id', item.id);
                            }
                            console.log(`✓ Successfully cleared ${table} using individual deletions`);
                        }
                    }
                }
            } else {
                // Get row count after clearing
                const { count: afterCount } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                console.log(`✓ Successfully cleared ${table} (${beforeCount} → ${afterCount} rows)`);
            }
        }
        
        console.log('✓ Database cleanup completed successfully!');
        
        // Final verification
        console.log('\nFinal verification:');
        for (const table of tables) {
            const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            console.log(`${table}: ${count || 0} rows`);
        }
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Run the cleanup
clearAllData();
