# AI Agent Backend

Simple Node.js backend for AI-powered business data collection.

## Features

- **AI-Powered Search**: Uses Google Gemini AI to find businesses
- **Data Cleaning**: Automatic duplicate removal and normalization
- **Confidence Scoring**: Rates data quality from 0-1
- **Database Storage**: Saves to Supabase with deduplication
- **Simple API**: Single endpoint for running agents

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Set up database**
   - Create a Supabase project
   - Run the `database-schema.sql` in your Supabase SQL editor
   - Copy your Supabase URL and anon key to `.env`

4. **Get Gemini API key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env` file

5. **Start the server**
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

## API Usage

### POST /api/run-agent

Run an AI agent to collect business data.

**Request:**
```json
{
  "governorate": "Baghdad",
  "category": "restaurants"
}
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "uuid",
      "name": "Al-Mansour Restaurant",
      "category": "restaurants",
      "city": "Baghdad",
      "phone": "+9647701234567",
      "governorate": "Baghdad",
      "requested_category": "restaurants",
      "confidence": 0.85,
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## Data Processing Flow

1. **AI Search**: Gemini AI searches for businesses in the specified location and category
2. **Data Cleaning**: Removes duplicates, normalizes names, validates required fields
3. **Confidence Scoring**: Calculates data quality score based on completeness
4. **Deduplication**: Checks against existing database records
5. **Storage**: Saves new businesses to Supabase

## Confidence Score Factors

- **Name presence** (+0.3): Must have a valid business name
- **Phone number** (+0.2): Phone numbers increase confidence
- **City match** (+0.1): City should match governorate
- **Category match** (+0.1): Category should match requested category

## Environment Variables

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3000
NODE_ENV=development
```

## Health Check

- `GET /health` - Server health status

## Development

The project is intentionally simple:
- No queues or message brokers
- Synchronous execution
- Single API endpoint
- Minimal dependencies

Perfect for getting started with AI-powered data collection!
