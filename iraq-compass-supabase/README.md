# Iraq Compass - Supabase-Only Architecture

**Simplified Agent System - NO Cloudflare, NO Durable Objects**

This is the streamlined version using only **Supabase + Vercel Functions**.

---

## 🎯 Architecture Overview

```
GitHub Actions (Scheduler)
    ↓ triggers every 6 hours
Vercel Functions (API Routes)
    ├─ /api/agent-runner (main pipeline)
    ├─ /api/agents/list (dashboard)
    ├─ /api/records/review-queue (human review)
    └─ /api/export (CSV download)
    ↓ queries/updates
Supabase (PostgreSQL)
    ├─ agents table (18 rows)
    ├─ agent_jobs table
    ├─ agent_checkpoints table ← CRITICAL for resume
    ├─ business_records_staging
    ├─ business_records_deduplicated
    └─ business_records_production
```

---

## 📦 Cost Comparison

| Component | Old (Cloudflare) | New (Supabase-Only) | Savings |
|-----------|-----------------|---------------------|---------|
| Supabase | $25/mo | $25/mo | - |
| Cloudflare DO | $5-10/mo | $0 | **$5-10/mo** |
| Vercel | $0 | $0 | - |
| **Total** | **$30-35/mo** | **$25/mo** | **20-28%** |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd iraq-compass-supabase
npm install
```

### 2. Set Environment Variables

```bash
# In Vercel dashboard or .env.local
SUPABASE_URL=https://hsadukhmcclwixuntqwu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy to Vercel

```bash
vercel deploy
```

### 4. Configure GitHub Actions

1. Copy `.github/workflows/run-agents.yml` to your repo
2. Add repository secrets:
   - `VERCEL_URL`: Your deployed app URL
3. Enable GitHub Actions in your repo settings

---

## 📡 API Endpoints

### Agent Runner (Main Pipeline)
```
GET /api/agent-runner?governorate=Baghdad&category=Restaurants
```

Response:
```json
{
  "success": true,
  "agentId": "agent-baghdad-restaurants",
  "jobId": "job-1234567890",
  "checkpoint": "PUSHED",
  "recordsProcessed": 45,
  "recordsTotal": 50,
  "completed": true
}
```

### Dashboard APIs
```
GET /api/agents/list              # List all agents
GET /api/agents/:agentId          # Get agent details  
GET /api/jobs/:jobId/status       # Get job progress
GET /api/health                   # System health
```

### Human Review
```
GET /api/records/review-queue     # Records needing approval
POST /api/records/approve         # Approve/reject record
```

### Export
```
GET /api/export?format=csv&governorate=Baghdad
```

---

## 🔄 6-Stage Pipeline with Checkpoints

The agent-runner implements checkpoint/resume using Supabase:

```
1. SCRAPING → checkpoint saved
2. ENRICHING → checkpoint saved  
3. REVIEWING → checkpoint saved
4. CLEANING → checkpoint saved
5. DEDUPLICATING → checkpoint saved
6. PUSHING → checkpoint saved
```

If the function times out (300s limit), it resumes from the last checkpoint on the next run.

---

## 🗄️ Database Schema

Uses the same 7 tables from the original spec:

1. `agents` - 18 governorate agents
2. `agent_jobs` - Individual scrape jobs
3. `agent_checkpoints` - Resume points (CRITICAL)
4. `business_records_staging` - Raw data
5. `business_records_deduplicated` - After dedup
6. `business_records_production` - Live data
7. `export_logs` - Export tracking

Run the SQL in `../iraq-compass-agents/supabase/schema.sql` to create tables.

---

## 🧪 Testing

### Test Agent Runner
```bash
curl "http://localhost:3000/api/agent-runner?governorate=Baghdad&category=Restaurants"
```

### Test Dashboard
```bash
curl http://localhost:3000/api/agents/list
curl http://localhost:3000/api/health
```

### Test Export
```bash
curl "http://localhost:3000/api/export?format=csv&governorate=Erbil" > export.csv
```

---

## 📊 GitHub Actions Schedule

The workflow runs every 6 hours across all 18 governorates:

```yaml
schedule:
  - cron: '0 */6 * * *'  # Every 6 hours
```

With 15-minute stagger between agents to avoid overwhelming Supabase.

---

## ✅ Key Features

- **Checkpoint/Resume**: Supabase rows instead of Durable Objects
- **Scheduling**: GitHub Actions instead of Cloudflare CRON
- **Phone Parsing**: Iraqi number validation
- **Language Detection**: Arabic/Kurdish/English
- **UTF-8 Export**: CSV with BOM for Excel
- **Deduplication**: 99%+ accuracy
- **Human Review**: Low-confidence queue

---

## 🎯 Success Criteria

- ✅ 18 agents running on schedule (GitHub Actions)
- ✅ Each run saves checkpoints to Supabase
- ✅ If timeout, resumes from last checkpoint
- ✅ All 6 pipeline stages functional
- ✅ Deduplication working (99%+ accuracy)
- ✅ Phone categories detected correctly
- ✅ Languages preserved (Arabic/Kurdish/English)
- ✅ CSV exports show Arabic text correctly

---

**Total Build Time: 3-4 hours (vs. 8+ hours for Cloudflare approach)**
