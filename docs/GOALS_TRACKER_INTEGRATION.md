# Goals Tracker Integration - Implementation Guide

## Overview
Full integration of the copper-goals-tracker goals tracking system into KanvaPortal, adapted to use KanvaPortal's existing data sources (Fishbowl, JustCall, Copper) and authentication system.

## ✅ Phase 1 Complete (Current Status)

### 1. Core Infrastructure
- **Types & Interfaces** (`types/goals.ts`)
  - Goal, Metric, User, GoalType, GoalPeriod
  - Achievement, TeamComparison, UserSettings
  
- **Firebase Services** (`lib/firebase/services/goals.ts`)
  - `userService`: User management and profiles
  - `settingsService`: User settings and team goals
  - `goalService`: Goal CRUD operations with real-time subscriptions
  - `metricService`: Metrics tracking, aggregation, and team analytics

### 2. API Endpoints
- **`/api/goals/user-goals`** (GET/POST)
  - Fetch user's goals by period
  - Create/update individual goals
  
- **`/api/goals/team-goals`** (GET/POST)
  - Fetch team-wide goals and aggregates
  - Update team goals (admin only)
  
- **`/api/goals/metrics`** (GET/POST)
  - Fetch metrics by date range and type
  - Log new metrics manually or via sync
  
- **`/api/goals/sync-justcall`** (POST)
  - Sync phone calls and SMS from JustCall activities
  - Aggregates by date and logs to metrics
  
- **`/api/goals/sync-sales`** (POST)
  - Sync sales data from monthly_commissions
  - Categorizes by wholesale vs distribution
  - Maps salesPerson to userId

### 3. Goals Dashboard Page
**Location:** `app/(modules)/goals/page.tsx`

**Features:**
- ✅ No login bar (uses KanvaPortal auth context)
- ✅ No "Sharpening the Saw" section (removed as requested)
- ✅ Period selection: Weekly/Monthly/Quarterly
- ✅ My Active Goals grid with progress tracking
- ✅ Weekly Activity visualization (7-day view)
- ✅ Team Performance overview
- ✅ Goals Calendar with completion color coding
- ✅ Quick Actions: Set Goal, Sync JustCall

### 4. Goal Types Supported

#### Activity Metrics (JustCall/Copper)
- `phone_call_quantity` - Phone calls made (JustCall)
- `sms_quantity` - SMS messages sent (JustCall)
- `email_quantity` - Emails sent (Copper/future KanvaPortal)

#### Pipeline Metrics (Copper CRM)
- `lead_progression_a` - Fact Finding Stage
- `lead_progression_b` - Contact Stage
- `lead_progression_c` - Closing Stage

#### Sales Metrics (Fishbowl)
- `new_sales_wholesale` - Wholesale sales revenue
- `new_sales_distribution` - Distribution sales revenue

## 🚧 Phase 2 Required (Next Steps)

### 1. Role-Based Data Filtering
**Current:** All users see their own data only
**Required:** Admin sees all users' data

**Implementation:**
```typescript
// In goals page, check user role
const { user, customClaims } = useAuth();
const isAdmin = customClaims?.role === 'admin';

// If admin, fetch all users' goals
if (isAdmin) {
  const allUsers = await userService.getAllUsers();
  // Display dropdown to select user or show all
}
```

### 2. Automated Data Sync Processes

#### A. Fishbowl Import Hook
**Trigger:** After each Fishbowl CSV import completes
**Action:** Call `/api/goals/sync-sales` with current month/year

**Implementation Location:** `app/api/fishbowl/import-unified/route.ts`
```typescript
// After successful import, sync sales metrics
await fetch('/api/goals/sync-sales', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}` },
  body: JSON.stringify({ 
    month: currentMonth, 
    year: currentYear 
  })
});
```

#### B. JustCall Webhook
**Required:** Set up webhook endpoint to receive JustCall events
**Endpoint:** `/api/webhooks/justcall`
**Events:** Call completed, SMS sent

**Implementation:**
```typescript
// Create app/api/webhooks/justcall/route.ts
export async function POST(request: NextRequest) {
  const event = await request.json();
  
  // Map JustCall user to KanvaPortal userId
  // Log metric to goals system
  await metricService.logMetric({
    userId: mappedUserId,
    type: event.type === 'call' ? 'phone_call_quantity' : 'sms_quantity',
    value: 1,
    date: new Date(event.timestamp),
    source: 'justcall'
  });
}
```

#### C. Copper Email Sync
**Required:** Periodic sync of email activities from Copper
**Frequency:** Daily or on-demand
**Endpoint:** `/api/goals/sync-copper-emails`

**Implementation:**
```typescript
// Fetch emails from Copper API
// Map to KanvaPortal users
// Log email_quantity metrics
```

### 3. Pipeline Integration
**Current:** Lead progression goals exist but no data source
**Required:** Connect to Copper CRM pipeline stages

**Data Source:** Copper CRM Opportunities API
**Mapping:**
- Stage "Fact Finding" → `lead_progression_a`
- Stage "Contact" → `lead_progression_b`
- Stage "Closing" → `lead_progression_c`

### 4. Navigation Integration
**Required:** Add Goals link to main navigation

**Location:** Find and update navigation component
```typescript
// Add to navigation items
{
  name: 'Goals',
  href: '/goals',
  icon: TargetIcon
}
```

### 5. UI Enhancements (Future)
- Detailed drill-down on goal tiles
- Historical trend charts
- Goal achievement notifications
- Leaderboard view for team competition
- Export goals data to CSV
- Custom goal types for specific business needs

## Data Flow Architecture

### Sales Goals Flow
```
Fishbowl CSV Import
  ↓
monthly_commissions collection
  ↓
/api/goals/sync-sales (triggered post-import)
  ↓
Aggregates by salesPerson + accountType
  ↓
Logs metrics to 'metrics' collection
  ↓
Goals dashboard displays progress
```

### Activity Goals Flow
```
JustCall/Copper Activity
  ↓
Webhook/Sync API
  ↓
/api/goals/sync-justcall or /api/goals/sync-copper-emails
  ↓
Logs metrics to 'metrics' collection
  ↓
Goals dashboard displays progress
```

### Real-time Updates
```
User sets goal via GoalSetter component
  ↓
POST /api/goals/user-goals
  ↓
Firestore 'goals' collection
  ↓
Real-time subscription updates UI
```

## Firestore Collections

### `goals`
```typescript
{
  id: string; // userId_type_period
  userId: string;
  type: GoalType;
  period: GoalPeriod;
  target: number;
  current: number; // Auto-calculated from metrics
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `metrics`
```typescript
{
  id: string; // Auto-generated
  userId: string;
  type: GoalType;
  value: number;
  date: Timestamp;
  source: 'manual' | 'copper' | 'justcall' | 'fishbowl';
  metadata: {
    month?: string;
    syncDate?: string;
    [key: string]: any;
  };
  createdAt: Timestamp;
}
```

### `settings` (team_goals document)
```typescript
{
  weekly: {
    phone_call_quantity: number;
    email_quantity: number;
    // ... other goal types
  };
  monthly: { ... };
  quarterly: { ... };
  updatedAt: Timestamp;
}
```

## Testing Checklist

### Manual Testing
- [ ] Create a new goal via UI
- [ ] View goals for different periods (weekly/monthly/quarterly)
- [ ] Sync JustCall data (requires JustCall activities in DB)
- [ ] Sync sales data (requires monthly_commissions data)
- [ ] View team performance (requires multiple users with goals)
- [ ] Check calendar color coding
- [ ] Test goal setter modal

### Admin Testing
- [ ] View all users' goals (when role-based filtering implemented)
- [ ] Set team goals
- [ ] View team aggregates

### Integration Testing
- [ ] Fishbowl import triggers sales sync
- [ ] JustCall webhook creates metrics
- [ ] Copper email sync creates metrics
- [ ] Real-time updates work across multiple sessions

## Known Issues & Limitations

1. **Customer Account Type Mapping**
   - Firestore 'in' query limited to 10 items
   - Need to batch process for large customer sets
   - Consider caching customer types

2. **User Mapping**
   - Relies on exact name match between salesPerson and user.name
   - Should add fallback mapping by email or custom field

3. **Pipeline Data**
   - Lead progression goals exist but no data source yet
   - Requires Copper CRM API integration

4. **Performance**
   - Large date ranges may be slow
   - Consider pre-aggregating metrics by period

## Configuration

### Environment Variables Required
```env
# Existing KanvaPortal vars
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# JustCall (if using webhook)
JUSTCALL_API_KEY=
JUSTCALL_WEBHOOK_SECRET=

# Copper CRM (for email/pipeline sync)
COPPER_API_KEY=
COPPER_USER_EMAIL=
```

## Deployment Notes

1. **Firestore Indexes Required**
   - `metrics`: (userId, type, date)
   - `metrics`: (type, date)
   - `goals`: (userId, period)

2. **Security Rules**
   - Users can read/write their own goals
   - Users can read their own metrics
   - Admins can read all goals/metrics
   - Team goals are publicly readable

3. **Cloud Functions** (Optional)
   - Scheduled function to sync Copper emails daily
   - Scheduled function to calculate goal progress
   - Trigger function on Fishbowl import completion

## Support & Maintenance

### Regular Maintenance Tasks
- Monitor sync API success rates
- Review and update goal targets quarterly
- Clean up old metrics (>1 year)
- Update user mappings as team changes

### Troubleshooting
- **Goals not updating:** Check metrics are being logged correctly
- **Sync failing:** Verify API credentials and data source availability
- **Wrong user attribution:** Check user name mapping in sync APIs

## Future Enhancements

1. **Advanced Analytics**
   - Trend analysis and forecasting
   - Correlation between activities and sales
   - Team performance benchmarking

2. **Gamification**
   - Achievement badges
   - Streak tracking
   - Team challenges

3. **Notifications**
   - Daily/weekly goal reminders
   - Achievement celebrations
   - Behind-pace alerts

4. **Mobile App**
   - Quick metric logging
   - Push notifications
   - Voice-to-metric logging

---

**Last Updated:** January 19, 2026
**Status:** Phase 1 Complete, Phase 2 In Progress
**Maintainer:** Development Team
