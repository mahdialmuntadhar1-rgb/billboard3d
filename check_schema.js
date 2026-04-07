const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hsadukhmcclwixuntqwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('Checking database tables...');
    
    try {
        // Get all tables
        const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .neq('table_name', '_prisma_migrations');
        
        if (error) {
            console.log('Error getting tables:', error);
            
            // Try alternative approach - list common table names
            const commonTables = ['businesses', 'agents', 'sync_runs', 'agent_tasks', 'users'];
            
            for (const table of commonTables) {
                try {
                    const { data: tableData, error: tableError } = await supabase
                        .from(table)
                        .select('*')
                        .limit(1);
                    
                    if (!tableError) {
                        console.log(`✓ Found table: ${table}`);
                        
                        // Get row count
                        const { count } = await supabase
                            .from(table)
                            .select('*', { count: 'exact', head: true });
                        
                        console.log(`  Rows: ${count || 0}`);
                    } else {
                        console.log(`✗ Table not found: ${table}`);
                    }
                } catch (e) {
                    console.log(`✗ Error checking table ${table}:`, e.message);
                }
            }
        } else {
            console.log('Tables found:', data);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTables();
