# Google Cloud SQL Setup Guide
## Migrating KanvaPortal CRM from Firestore to PostgreSQL

This guide will walk you through setting up Google Cloud SQL PostgreSQL and migrating your CRM data.

---

## 📋 Prerequisites

- Google Cloud account (same as Firebase)
- Firebase Admin SDK credentials
- ~30 minutes of time

---

## Phase 1: Create Cloud SQL Instance (15 minutes)

### Step 1: Access Google Cloud Console

1. Go to https://console.cloud.google.com
2. Select project: **kanvaportal**
3. Search for "SQL" in the top search bar
4. Click **SQL** from the results

### Step 2: Create PostgreSQL Instance

Click **Create Instance** → **Choose PostgreSQL**

**Configuration:**
```
Instance ID: kanvaportal-crm-db
Password: [Click "Generate" and SAVE IT!]
Database version: PostgreSQL 15
Region: us-central1 (same as Firebase)
Zonal availability: Single zone

Machine Configuration:
  Development: db-f1-micro (FREE tier - for testing)
  Production: db-custom-2-7680 (2 vCPU, 7.5GB RAM) ~$100/month

Storage:
  Type: SSD
  Capacity: 10 GB
  ✅ Enable automatic storage increases

Connections:
  ✅ Public IP
  ✅ Private IP
  
Authorized networks:
  Click "Add Network"
  Name: Development
  Network: 0.0.0.0/0
  (We'll restrict this later)

Backup:
  ✅ Automated backups
  Backup window: 3:00 AM (your timezone)
```

Click **CREATE INSTANCE** (takes ~5-10 minutes)

### Step 3: Create Database

Once the instance is running:

1. Click on your instance name: **kanvaportal-crm-db**
2. Go to **Databases** tab
3. Click **Create Database**
   - Database name: `crm`
   - Click **CREATE**

### Step 4: Get Connection Details

In your Cloud SQL instance overview, copy these values:

```
Public IP address: [Copy this - looks like 34.123.45.67]
Connection name: kanvaportal:us-central1:kanvaportal-crm-db
```

---

## Phase 2: Local Setup (10 minutes)

### Step 1: Update Environment Variables

Create or update `.env.local`:

```bash
# Enable SQL mode
USE_SQL=true

# Cloud SQL Connection (use your actual values)
CLOUD_SQL_HOST=34.123.45.67  # Your public IP from Step 4
CLOUD_SQL_PORT=5432
CLOUD_SQL_USER=postgres
CLOUD_SQL_PASSWORD=your_generated_password  # From Step 2
CLOUD_SQL_DATABASE=crm
INSTANCE_CONNECTION_NAME=kanvaportal:us-central1:kanvaportal-crm-db

# Firebase Service Account (for migration)
# Get from: https://console.firebase.google.com/project/kanvaportal/settings/serviceaccounts/adminsdk
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"kanvaportal",...}'
```

### Step 2: Install Dependencies

Already done! ✅ (pg and @types/pg are installed)

### Step 3: Create Database Schema

Connect to your database and run the schema:

**Option A: Using psql (if installed)**
```bash
psql -h YOUR_PUBLIC_IP -U postgres -d crm -f lib/db/schema.sql
```

**Option B: Using Cloud Console**
1. Go to your Cloud SQL instance
2. Click **Cloud Shell** button (top right)
3. Run:
```bash
gcloud sql connect kanvaportal-crm-db --user=postgres --database=crm
```
4. Enter your password
5. Copy and paste the contents of `lib/db/schema.sql`

**Option C: Using pgAdmin or DBeaver**
1. Download pgAdmin: https://www.pgadmin.org/download/
2. Connect using your public IP and credentials
3. Open `lib/db/schema.sql` and execute

---

## Phase 3: Migrate Data (30 minutes)

### Step 1: Prepare Firebase Service Account

1. Go to https://console.firebase.google.com/project/kanvaportal/settings/serviceaccounts/adminsdk
2. Click **Generate New Private Key**
3. Download the JSON file
4. Copy the ENTIRE contents and add to `.env.local`:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"kanvaportal","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}'
```

### Step 2: Run Migration

```bash
npm run migrate-to-sql
```

You'll see output like:
```
╔════════════════════════════════════════╗
║  Firestore → PostgreSQL Migration     ║
║  KanvaPortal CRM Database             ║
╚════════════════════════════════════════╝

🔄 Starting accounts migration...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Found 2847 accounts in Firestore

✅ Migrated 100/2847 accounts (45.2 accounts/sec, 2.2s elapsed)
✅ Migrated 200/2847 accounts (47.1 accounts/sec, 4.2s elapsed)
...
✅ Migrated 2847/2847 accounts (46.8 accounts/sec, 60.8s elapsed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Accounts migration complete!
   Total: 2847
   Migrated: 2847
   Errors: 0
   Time: 60.8s
   Rate: 46.8 accounts/sec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Verifying migration...

📊 PostgreSQL Database Stats:
   Total accounts: 2847
   Active customers: 1923
   With region: 2456
   With segment: 2134

✅ Migration completed successfully!
```

### Step 3: Verify Data

Connect to your database and run:

```sql
-- Check total accounts
SELECT COUNT(*) FROM accounts;

-- Check active customers
SELECT COUNT(*) FROM accounts WHERE is_active_customer = true;

-- Sample some data
SELECT id, name, region, segment, status FROM accounts LIMIT 10;

-- Check filters work
SELECT COUNT(*) FROM accounts WHERE region = 'Pacific Northwest';
```

---

## Phase 4: Update Application Code (5 minutes)

### Step 1: Update dataService.ts

Add this at the top of `lib/crm/dataService.ts`:

```typescript
import { loadUnifiedAccountsSQL, getTotalAccountsCountSQL } from './dataServiceSQL';

// At the start of loadUnifiedAccounts function
export async function loadUnifiedAccounts(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedAccount>> {
  // Use SQL if enabled
  if (process.env.USE_SQL === 'true' || process.env.NEXT_PUBLIC_USE_SQL === 'true') {
    return loadUnifiedAccountsSQL(options);
  }
  
  // Fallback to Firestore (existing code below)
  // ... rest of existing function
}

// Update getTotalAccountsCount
export async function getTotalAccountsCount(): Promise<{
  total: number;
  active: number;
  fishbowl: number;
}> {
  if (process.env.USE_SQL === 'true' || process.env.NEXT_PUBLIC_USE_SQL === 'true') {
    return getTotalAccountsCountSQL();
  }
  
  // Fallback to Firestore (existing code)
  // ... rest of existing function
}
```

### Step 2: Add Environment Variable to Next.js

Update `next.config.js` to expose the SQL flag:

```javascript
env: {
  NEXT_PUBLIC_USE_SQL: process.env.USE_SQL,
},
```

---

## Phase 5: Test Locally (10 minutes)

### Step 1: Start Dev Server

```bash
npm run dev
```

### Step 2: Test Filtering

1. Go to http://localhost:3000/accounts
2. Click the Filter button
3. Create a filter (e.g., Region = "Pacific Northwest")
4. Save the filter
5. Apply the filter
6. **Should work instantly with NO index errors!** ✅

### Step 3: Verify Console Logs

You should see:
```
✅ Database pool created
📊 Query executed in 234ms (50 rows)
✅ Loaded 50 accounts from PostgreSQL (hasMore: true)
```

---

## Phase 6: Deploy to Production (15 minutes)

### Step 1: Update Firebase Functions Config

```bash
firebase functions:config:set \
  cloudsql.password="YOUR_PASSWORD" \
  cloudsql.connection="kanvaportal:us-central1:kanvaportal-crm-db" \
  use_sql="true"
```

### Step 2: Update next.config.js for Production

```javascript
module.exports = {
  env: {
    NEXT_PUBLIC_USE_SQL: 'true',
  },
  // ... rest of config
}
```

### Step 3: Deploy

```bash
npm run build
firebase deploy
```

### Step 4: Verify Production

1. Go to your production URL
2. Test filtering
3. Check performance (should be <500ms)
4. Monitor Cloud SQL metrics in Google Cloud Console

---

## 🎉 Success Checklist

- ✅ Cloud SQL instance created
- ✅ Database schema created
- ✅ Data migrated from Firestore
- ✅ Filters work without index errors
- ✅ Page loads in <1 second
- ✅ Production deployment successful

---

## 💰 Cost Breakdown

| Component | Development | Production |
|-----------|-------------|------------|
| Cloud SQL Instance | FREE (db-f1-micro) | $100/month |
| Storage (10GB SSD) | $2/month | $2/month |
| Backups | $0.08/GB/month | ~$1/month |
| **Total** | **~$2/month** | **~$103/month** |

---

## 🔧 Troubleshooting

### Can't connect to Cloud SQL
- Check your public IP is correct
- Verify password is correct
- Ensure 0.0.0.0/0 is in authorized networks
- Check firewall rules

### Migration fails
- Verify FIREBASE_SERVICE_ACCOUNT is correct JSON
- Check Firebase Admin SDK has permissions
- Ensure Cloud SQL has enough storage

### Queries are slow
- Check indexes are created (run schema.sql again)
- Upgrade to production instance size
- Enable query insights in Cloud Console

### "Pool is closed" error
- Restart your dev server
- Check connection pool settings in config.ts

---

## 📚 Next Steps

1. **Monitor Performance**: Check Cloud SQL metrics in Google Cloud Console
2. **Optimize Queries**: Add indexes for your most common filters
3. **Set Up Backups**: Configure automated backups (already enabled)
4. **Restrict Access**: Remove 0.0.0.0/0 from authorized networks, add your specific IPs
5. **Scale Up**: When ready, upgrade from db-f1-micro to production size

---

## 🆘 Need Help?

- Cloud SQL Docs: https://cloud.google.com/sql/docs/postgres
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Firebase + Cloud SQL: https://cloud.google.com/sql/docs/postgres/connect-instance-cloud-functions

---

**You're all set! Your CRM now runs on production-grade PostgreSQL with unlimited filtering capabilities.** 🚀
