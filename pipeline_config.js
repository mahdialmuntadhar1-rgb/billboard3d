// Pipeline configuration file
// Update these values with your actual Supabase credentials

module.exports = {
    // Source database (where data comes FROM)
    source: {
        url: 'https://ujdsxzvvgaugypwtugdl.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZHN4enZ2Z2F1Z3lwdHVnZGwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.XWDbzIPZNPk6j1GXixcIJKUb4lp48ipC7jExG2Q09Ns',
        serviceKey: 'YOUR_SOURCE_SERVICE_ROLE_KEY_HERE' // Get this from Supabase dashboard
    },
    
    // Target database (where data goes TO)
    target: {
        url: 'https://hsadukhmcclwixuntqwu.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODMzNjgsImV4cCI6MjA4ODY1OTM2OH0.XWDbzIPZNPk6j1GXixcIJKUb4lp48ipC7jExG2Q09Ns',
        serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYWR1a2htY2Nsd2l4dW50cXd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MzM2OCwiZXhwIjoyMDg4NjU5MzY4fQ.2YpuPKrlv4jQNG-5dDlnzWzFqjqRbO_bxXksWh4PRZY'
    },
    
    // Pipeline settings
    settings: {
        batchSize: 100,
        syncInterval: 60000, // milliseconds (1 minute)
        retryAttempts: 3,
        retryDelay: 5000 // milliseconds
    }
};
