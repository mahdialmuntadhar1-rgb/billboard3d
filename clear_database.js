const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAllData() {
    console.log('Starting database cleanup...');
    
    try {
        // List of tables to clear (order matters due to foreign key constraints)
        const tables = [
            'businesses',
            'agents',
            'discovery_runs',
            'orchestrator_runs',
            'governor_states',
            'agent_logs'
        ];
        
        for (const table of tables) {
            console.log(`Clearing table: ${table}`);
            
            // Delete all data from the table
            const { error } = await supabase
                .from(table)
                .delete()
                .neq('id', 0); // This deletes all rows
            
            if (error) {
                console.error(`Error clearing ${table}:`, error);
            } else {
                console.log(`✓ Successfully cleared ${table}`);
            }
        }
        
        // Reset auto-increment counters (PostgreSQL specific)
        console.log('Resetting auto-increment counters...');
        
        const resetQueries = [
            'ALTER SEQUENCE businesses_id_seq RESTART WITH 1',
            'ALTER SEQUENCE agents_id_seq RESTART WITH 1',
            'ALTER SEQUENCE discovery_runs_id_seq RESTART WITH 1',
            'ALTER SEQUENCE orchestrator_runs_id_seq RESTART WITH 1',
            'ALTER SEQUENCE governor_states_id_seq RESTART WITH 1',
            'ALTER SEQUENCE agent_logs_id_seq RESTART WITH 1'
        ];
        
        for (const query of resetQueries) {
            try {
                const { error } = await supabase.rpc('exec_sql', { sql_query: query });
                if (error) {
                    console.log(`Note: Could not reset sequence (${query}): ${error.message}`);
                }
            } catch (e) {
                console.log(`Note: Sequence reset may not be necessary for ${query}`);
            }
        }
        
        console.log('✓ Database cleanup completed successfully!');
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Run the cleanup
clearAllData();
