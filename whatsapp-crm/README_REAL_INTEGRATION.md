# WhatsApp CRM - Real Supabase Integration

## Overview

This WhatsApp CRM system has been converted from mock/demo mode to real Supabase-backed TEST MODE for WhatsApp outreach. The system now reads real businesses and phone numbers from Supabase and provides comprehensive testing capabilities.

## Key Changes Made

### 1. Database Schema
- **Added `businesses` table** with proper phone fields:
  - `phone_1` - Primary phone number
  - `phone_2` - Secondary phone number  
  - `whatsapp` - WhatsApp number
  - `governorate`, `city`, `category` - Filter fields
  - `status` - Business approval status

### 2. Phone Selection Logic
- **Preferred order**: whatsapp > phone_1 > phone_2
- **Phone validation**: Iraqi phone number patterns (+9647..., 07...)
- **Invalid phone handling**: Businesses without valid phones are excluded

### 3. Real Test Mode
- **Boolean test mode toggle** in the UI
- **Configurable limits**: 5, 10, or 20 recipients
- **Clear visual indicators**: Yellow test mode banner
- **Protected sending**: No full campaign sending while test mode is enabled

### 4. Live Audience Statistics
- **Real-time counts**: Total businesses, with/without valid phones
- **Filter-based stats**: Updates based on selected filters
- **Sample preview**: Shows first 5 recipients with selected phone numbers

### 5. API Enhancements
- **New `/api/businesses/*` endpoints**:
  - `GET /api/businesses/preview` - Get audience stats
  - `GET /api/businesses/preview/sample` - Get sample businesses
  - `GET /api/businesses/filters` - Get filter options
  - `POST /api/businesses/queue` - Queue businesses with test mode
- **Updated `/api/messages/queue`** - Handles real business data
- **Phone field tracking** - Shows which phone field was selected

## Setup Instructions

### 1. Database Setup
```bash
# Run the updated schema in Supabase
# Execute the contents of supabase/schema.sql in your Supabase project
```

### 2. Environment Variables
Create `.env` file with:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Test Data
```bash
# Populate businesses table with sample data
npm run seed:businesses
```

### 5. Run System Tests
```bash
# Verify the system works correctly
npm run test:crm
```

### 6. Start Development Server
```bash
npm run dev
```

## Testing Guide

### Step 1: Verify Database Connection
1. Navigate to `http://localhost:3000`
2. Open browser console to check for Supabase connection errors
3. If you see "Missing Supabase Configuration" warning, check your `.env` file

### Step 2: Create Test Campaign
1. Go to Campaigns page
2. Click "Create Campaign"
3. Fill in campaign details
4. Select at least one template (create one first if needed)

### Step 3: Test Real Business Loading
1. Click the "Queue Messages" button on your campaign
2. **Test Mode should be ON by default**
3. Select filter options (governorate, city, category)
4. **Verify live statistics appear**:
   - Total businesses matched
   - Businesses with valid phones
   - Businesses excluded for missing phones

### Step 4: Verify Phone Selection
1. Check the "Sample Recipients" section
2. **Verify each business shows**:
   - Business name and location
   - Selected phone number
   - Which phone field was used (whatsapp/phone_1/phone_2)

### Step 5: Test Safe Message Queuing
1. With Test Mode ON, click "Queue Test (X) Messages"
2. **Verify success message** shows test mode indication
3. Check browser console for detailed logging

### Step 6: Test Different Scenarios
```bash
# Test different filters to verify phone validation:
- Baghdad governorate only
- Restaurant category only  
- Baghdad + Technology (should show fewer results)
- No filters (should show all approved businesses)
```

## Safety Features

### 1. Test Mode Protection
- **Default enabled**: Test mode is ON by default
- **Visual indicators**: Yellow banner and clear labeling
- **Limited recipients**: Configurable 5/10/20 recipient limits
- **Button text**: Shows "Queue Test (X) Messages" vs "Queue All Messages"

### 2. Data Validation
- **Phone validation**: Only valid Iraqi phone numbers accepted
- **Business status**: Only 'approved' businesses included
- **Empty state handling**: Clear warnings when no recipients found

### 3. Error Handling
- **Supabase connection**: Clear warning if environment variables missing
- **No businesses**: Helpful message when filters return no results
- **No valid phones**: Specific warning about phone number issues

## API Endpoints

### Businesses API
```
GET /api/businesses/preview?governorate=Baghdad&category=Restaurant
GET /api/businesses/preview/sample?limit=5
GET /api/businesses/filters
POST /api/businesses/queue
```

### Messages API (Updated)
```
POST /api/messages/queue - Now requires real business data
```

## Phone Number Validation

### Supported Formats
- `+9647701234567` (Iraqi international format)
- `07701234567` (Iraqi local format)
- `+9647801234567` (Other Iraqi carriers)

### Validation Rules
- Minimum 10-15 digits
- Must start with +9647 or 07
- Rejects obvious placeholders (12345, etc.)

## Sample Data

The seed script creates 16 sample businesses:
- **15 with valid phones** across different governorates and categories
- **1 with invalid phone** (for testing exclusion)
- **1 with no phone** (for testing exclusion)

## Troubleshooting

### "No valid recipients found"
1. Check if businesses table has data: `npm run test:crm`
2. Verify phone numbers are in correct format
3. Check if businesses have 'approved' status

### "Missing Supabase Configuration"
1. Verify `.env` file exists
2. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values
3. Ensure Supabase project is accessible

### "Failed to queue messages"
1. Check browser console for detailed error logs
2. Verify campaign has linked templates
3. Ensure test mode limits are reasonable

## Production Considerations

### Before Full Campaign Sending
1. **Disable test mode**: Uncheck the test mode toggle
2. **Verify filters**: Double-check audience filters are correct
3. **Review sample**: Check sample recipients match expectations
4. **Test small batch**: Run with small test limit first

### Rate Limiting
- System respects WhatsApp rate limits (~15 messages/minute)
- Built-in 4-second delays between messages
- Automatic retry on failed messages

## File Changes Summary

### Database
- `supabase/schema.sql` - Added businesses table with indexes and RLS

### Backend
- `server/services/businessService.ts` - Phone selection and business fetching
- `server/routes/businesses.ts` - New business API endpoints  
- `server/routes/messages.ts` - Updated to handle real business data
- `server/services/supabase.ts` - Added Business interface
- `server/index.ts` - Added businesses route

### Frontend  
- `src/services/api.ts` - Added businessesApi methods
- `src/pages/Campaigns.tsx` - Complete UI overhaul with test mode

### Scripts
- `scripts/seed-businesses.ts` - Sample data generation
- `scripts/test-crm.ts` - System validation tests

### Configuration
- `package.json` - Added seed and test scripts

## Next Steps

1. **Run the test suite**: `npm run test:crm`
2. **Seed sample data**: `npm run seed:businesses`
3. **Test the UI**: Verify all features work as expected
4. **Create real templates**: Add message templates for your campaigns
5. **Test with real data**: Replace sample data with your actual business data

The system is now ready for safe, controlled testing with real business data!
