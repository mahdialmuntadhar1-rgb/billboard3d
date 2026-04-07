# WhatsApp CRM / Outreach System

A production-ready WhatsApp CRM system with campaign management, template engine, A/B testing, and inbox management. Built with React + Vite frontend and Node.js/Express backend.

## System Architecture

```
Frontend (React + Vite)
↓
Backend API (Express + TypeScript)
↓
Supabase (PostgreSQL)
↓
Nabda API (WhatsApp)
```

**Security Note:** All sensitive operations (API keys, database service role) are **backend-only**. Frontend never has access to secrets.

## Features

### 1. Campaign System
- Create campaigns with multiple templates
- 4 template strategies: single, random, even rotation, weighted A/B test
- Audience filtering by city/category
- Queue messages for bulk sending

### 2. Template System
- Create/edit message templates
- Placeholders: `{{business_name}}`, `{{city}}`, `{{category}}`
- CTA types: none, link, reply, call
- Weighted distribution for A/B testing
- Live preview with sample data

### 3. Message Queue
- Rate-limited sending (~15 messages/minute)
- Progress tracking (pending → sent → delivered → read)
- Batch sending with activity logs
- Campaign-specific or all-campaign sending

### 4. Inbox & Replies
- WhatsApp-style chat UI
- Conversation grouping by phone
- Suggested replies from FAQ matching
- Manual reply capability
- Auto-reply support (configurable)

### 5. FAQ / Auto-Reply Engine
- Keyword-based FAQ matching
- Confidence threshold system
- Auto-send or suggest-only modes
- Predefined FAQ presets for common questions

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign definitions and strategy settings |
| `message_templates` | Message templates with CTA and weights |
| `campaign_templates` | Junction table linking campaigns to templates |
| `messages` | Message queue with status tracking |
| `conversation_messages` | Inbound/outbound conversation history |
| `faq_answers` | FAQ entries for auto-reply |
| `template_stats` | A/B test performance metrics |

### Key Status Flow
```
pending → sent → delivered → read
   ↓
failed (with error message)
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd whatsapp-crm
npm install
```

### 2. Environment Variables
Create `.env` file:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NABDA_API_KEY=your_nabda_api_key
NABDA_API_URL=https://api.nabda.app/v1
PORT=3001
NODE_ENV=development
```

### 3. Database Setup
Run the SQL migration in Supabase:
```bash
# In Supabase SQL Editor, run:
supabase/schema.sql
```

### 4. Start Development
```bash
npm run dev
```
This starts:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 5. Configure Nabda Webhook
Set webhook URL in Nabda dashboard:
```
https://your-domain.com/api/webhook/nabda
```

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns/create` - Create campaign
- `GET /api/campaigns/:id` - Get campaign with templates
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `GET /api/campaigns/:id/stats` - Campaign statistics

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/activate` - Activate/deactivate

### Messages
- `GET /api/messages/status` - Queue status
- `POST /api/messages/queue` - Queue messages for campaign
- `POST /api/messages/send` - Send pending messages (batch)
- `GET /api/messages/pending` - Get pending count

### Inbox
- `GET /api/inbox` - List conversations
- `GET /api/inbox/conversation/:phone` - Get messages for phone
- `POST /api/inbox/reply` - Send reply
- `POST /api/inbox/suggest` - Get FAQ suggestion

### Webhooks
- `POST /api/webhook/nabda` - Incoming messages
- `POST /api/webhook/status` - Message status updates

## Template Strategies Explained

### 1. Single Template
Uses one selected template for all messages. Simple and consistent.

### 2. Random Template
Randomly selects from available templates for each recipient. Good for testing multiple approaches.

### 3. Even Rotation
Rotates through templates in order (A, B, C, A, B, C...). Ensures equal distribution.

### 4. Weighted A/B Test
Uses template `weight` field to determine probability. Template with weight=2 gets twice the sends as weight=1.

## Project Structure

```
whatsapp-crm/
├── src/
│   ├── pages/              # React pages
│   │   ├── Dashboard.tsx
│   │   ├── Campaigns.tsx
│   │   ├── MessageQueue.tsx
│   │   ├── Inbox.tsx
│   │   └── Templates.tsx
│   ├── services/         # Frontend API layer
│   │   ├── api.ts
│   │   └── templateEngine.ts
│   ├── types.ts          # TypeScript definitions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── server/
│   ├── routes/            # API routes
│   │   ├── campaigns.ts
│   │   ├── messages.ts
│   │   ├── templates.ts
│   │   ├── inbox.ts
│   │   └── webhook.ts
│   ├── services/          # Backend services
│   │   ├── supabase.ts
│   │   ├── nabda.ts
│   │   ├── templateEngine.ts
│   │   └── faqEngine.ts
│   └── index.ts           # Express server
├── supabase/
│   └── schema.sql         # Database schema
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── index.html
```

## Test Checklist

- [ ] Create a template with placeholders
- [ ] Create a campaign with template strategy
- [ ] Queue messages for businesses
- [ ] Start message sending (check rate limiting)
- [ ] Verify WhatsApp message received
- [ ] Reply to message and verify in Inbox
- [ ] Test FAQ suggestion appears
- [ ] Use suggested reply and verify sent

## Deployment

### Option 1: Vercel (Frontend) + Railway/Render (Backend)
1. Deploy backend to Railway/Render with environment variables
2. Update `vite.config.ts` proxy to point to deployed backend
3. Deploy frontend to Vercel

### Option 2: Single VPS
1. Build frontend: `npm run build`
2. Serve static files from `dist/` via Express
3. Deploy entire app to VPS

## Security Considerations

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- **NEVER** expose `NABDA_API_KEY` to frontend
- All API calls go through backend routes
- CORS configured for frontend domain only
- Row Level Security (RLS) enabled on all tables

## License

MIT - Use for multiple projects as needed.
