# JustCall Integration - Quick Setup Guide

## ✅ Implementation Complete!

The JustCall integration is now fully implemented and ready to use. Follow these steps to get it working.

## Step 1: Get JustCall API Credentials

1. Log in to your **JustCall Admin Panel**
2. Navigate to **Settings → Integrations → API**
3. Click **Generate API Key** (if you don't have one)
4. Copy your **API Key** and **API Secret**

## Step 2: Add Credentials to Environment

Add these to your `.env.local` file:

```env
JUSTCALL_API_KEY=your_api_key_here
JUSTCALL_API_SECRET=your_api_secret_here
```

**Important:** Restart your Next.js dev server after adding these variables!

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Step 3: Test the Integration

### Option A: Test via Goals Page

1. Navigate to `http://localhost:3000/goals`
2. Click the **"Sync JustCall (30d)"** button
3. Check the browser console for logs
4. Metrics should appear in your goals dashboard

### Option B: Test via API Directly

Use this curl command (replace `YOUR_TOKEN` with a real Firebase auth token):

```bash
curl -X POST http://localhost:3000/api/goals/sync-justcall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "totalCalls": 45,
  "totalTalkTimeMinutes": 120,
  "metricsLogged": 60,
  "dateRange": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "callsByDate": {
    "2026-01-15": 5,
    "2026-01-16": 8,
    ...
  }
}
```

## What Gets Synced

### Metrics Tracked:
1. **phone_call_quantity** - Number of calls per day
2. **talk_time_minutes** - Total conversation time per day (in minutes)

### Data Mapping:
- **JustCall User Email** → **KanvaPortal User Email** → **userId**
- Calls are aggregated by date (YYYY-MM-DD)
- Only conversation time is counted (not ring time, hold time, etc.)

## Troubleshooting

### Error: "JustCall API not configured"
- Make sure you added `JUSTCALL_API_KEY` and `JUSTCALL_API_SECRET` to `.env.local`
- Restart your dev server after adding variables

### Error: "User not found"
- The logged-in user's email must match a JustCall user email
- Check that the user exists in both systems with the same email

### Error: "Failed to fetch calls"
- Verify your JustCall API credentials are correct
- Check that your JustCall account has API access enabled
- Look at server console logs for detailed error messages

### No Calls Returned
- Verify the date range includes dates when calls were made
- Check that the user has calls in JustCall during that period
- Ensure the user's email in KanvaPortal matches their JustCall email exactly

## Checking the Data

### View Metrics in Firestore:
1. Go to Firebase Console → Firestore Database
2. Navigate to `metrics` collection
3. Filter by `userId` and `type: 'phone_call_quantity'`
4. You should see daily call counts

### View in Goals Dashboard:
1. Navigate to `/goals`
2. Your call metrics should appear in the goal cards
3. Progress bars should update based on your goals
4. Calendar should show activity on days with calls

## Next Steps

### Automated Sync (Recommended)
Set up a daily cron job or Cloud Function to sync all users automatically:

```typescript
// Example: Daily sync for all users
const users = await getAllUsers();
for (const user of users) {
  await fetch('/api/goals/sync-justcall', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      startDate: yesterday,
      endDate: today
    })
  });
}
```

### SMS Tracking (Future)
JustCall also tracks SMS messages. To add SMS tracking:
1. Implement `/api/justcall/sms` endpoint
2. Fetch SMS records from JustCall API
3. Log `sms_quantity` metrics
4. Update goals dashboard to show SMS metrics

### JustCall Dialer Widget (Future)
Embed JustCall dialer in KanvaPortal:
1. Research JustCall Click-to-Call widget
2. Add widget next to notification bell
3. Enable click-to-call from customer pages
4. Show call history and controls

## API Reference

### POST /api/goals/sync-justcall

**Headers:**
- `Authorization: Bearer <firebase_token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "totalCalls": 45,
  "totalTalkTimeMinutes": 120,
  "metricsLogged": 60,
  "dateRange": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "callsByDate": {
    "2026-01-15": 5,
    "2026-01-16": 8
  }
}
```

## Support

If you encounter issues:
1. Check server console logs for detailed errors
2. Verify JustCall API credentials
3. Ensure user emails match between systems
4. Review `docs/JUSTCALL_INTEGRATION.md` for detailed documentation

---

**Status:** ✅ Ready for Production
**Last Updated:** January 19, 2026
