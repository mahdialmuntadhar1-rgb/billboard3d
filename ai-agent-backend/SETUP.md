# Setup Instructions for New Supabase Project

## 1. Environment Configuration

Create a `.env` file with your new Supabase project details:

```env
# Supabase Configuration
SUPABASE_URL=https://ujdsxzvvgaugypwtugdl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZHN4enZ2Z2F1Z3lwd3R1Z2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzQ3NjYsImV4cCI6MjA5MDk1MDc2Nn0.XlWRSUAFTBYq3udqmBSkXI2bA73MlyriC1nWuwP4C7c

# Google AI Configuration
GEMINI_API_KEY=AIzaSyC9pda88kTF2Gpdj4geMB68OUEHUotcX8U

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 2. Get Service Role Key

1. Go to your Supabase project: https://ujdsxzvvgaugypwtugdl.supabase.co
2. Navigate to Project Settings → API
3. Copy the `service_role` key (NOT the anon key)
4. Add it to your `.env` file as `SUPABASE_SERVICE_ROLE_KEY`

## 3. Database Setup

Run the `database-schema.sql` in your Supabase SQL editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `database-schema.sql`
3. Click "Run" to execute

This will create:
- `jobs` table - for tracking agent runs
- `staging_businesses` table - for immediate persistence
- `businesses` table - for final approved data
- All necessary indexes and RLS policies

## 4. Install Dependencies

```bash
npm install
```

## 5. Start Server

```bash
npm start
```

The server will:
- Connect to your new Supabase project
- Resume any interrupted jobs from previous runs
- Start accepting API requests

## 6. Verify Setup

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Test a single agent run:
```bash
node test-api.js
```

## Key Features

### ✅ New Architecture
- **Service Role Access**: Server bypasses RLS for writes
- **Staging Table**: Immediate persistence of all validated records
- **Job Resumption**: Automatically resumes interrupted jobs on restart
- **Deduplication**: Checks against final businesses table only

### 📊 Data Flow
```
AI Search → Validation → Staging Table → Duplicate Check → Final Table
```

### 🔄 Job Recovery
- Server startup checks for `pending`/`running` jobs
- Automatically resumes from where they left off
- No data loss during server restarts

## Security Notes

- **Service Role Key**: Gives full database access - keep it secret
- **RLS Policies**: Allow public reads but restrict writes
- **Staging Table**: Stores all validated records before deduplication
- **Final Table**: Only contains unique, approved businesses

## Troubleshooting

### "Missing Supabase configuration"
- Check your `.env` file exists
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set

### "Permission denied" errors
- Ensure you're using the `service_role` key, not `anon` key
- Check database schema was applied correctly

### Jobs not resuming
- Check jobs table for `pending`/`running` status
- Verify database connection is working
