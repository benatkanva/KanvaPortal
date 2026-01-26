# CRM Data Migration Guide

## 🎯 Overview

This script migrates all CRM data from Firebase to Supabase:
- **People** (75,716 contacts)
- **Tasks** (1,328 tasks)
- **Opportunities** (357 deals)
- **Leads** (4,328 prospects)

## 📋 Prerequisites

1. ✅ Supabase tables created (you've done this)
2. ✅ Environment variables set in `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## 🚀 How to Run

### Option 1: Using tsx (Recommended)

```bash
npx tsx scripts/migrate-crm-to-supabase.ts
```

### Option 2: Compile and Run

```bash
npx tsc scripts/migrate-crm-to-supabase.ts
node scripts/migrate-crm-to-supabase.js
```

## 📊 What It Does

1. **Reads** Firebase collections:
   - `copper_people`
   - `copper_tasks`
   - `copper_opportunities`
   - `copper_leads`

2. **Transforms** data to match Supabase schema:
   - Maps Firebase field names to snake_case
   - Converts timestamps to proper format
   - Handles custom fields (cf_* fields)
   - Sets company_id to 'kanva-botanicals'

3. **Inserts** in batches of 100 records

4. **Shows** progress in real-time

## ⏱️ Expected Time

- **People**: ~10-15 minutes (75,716 records)
- **Tasks**: ~1 minute (1,328 records)
- **Opportunities**: ~30 seconds (357 records)
- **Leads**: ~2-3 minutes (4,328 records)

**Total**: ~15-20 minutes

## 🔍 Monitoring

The script outputs progress:
```
🔄 Starting people migration...
📊 Found 75716 people to migrate
✅ Migrated 100/75716 people
✅ Migrated 200/75716 people
...
✅ People migration complete: 75716/75716
```

## ⚠️ Important Notes

1. **Run once** - Script doesn't check for duplicates
2. **Company ID** - Set to 'kanva-botanicals' (change in script if needed)
3. **Custom fields** - Mapped based on complete-schema.md
4. **Timestamps** - Firebase timestamps converted to ISO strings

## 🛑 If Errors Occur

1. **Check Supabase connection**:
   ```bash
   # Test in browser console
   const { data, error } = await supabase.from('people').select('count');
   console.log(data, error);
   ```

2. **Check Firebase access**:
   - Verify Firebase credentials in `.env.local`
   - Ensure Firestore has read permissions

3. **Check for duplicate IDs**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT id, COUNT(*) FROM people GROUP BY id HAVING COUNT(*) > 1;
   ```

## ✅ Verify Migration

After migration, check counts in Supabase SQL Editor:

```sql
SELECT 
  (SELECT COUNT(*) FROM people) as people_count,
  (SELECT COUNT(*) FROM tasks) as tasks_count,
  (SELECT COUNT(*) FROM opportunities) as opportunities_count,
  (SELECT COUNT(*) FROM leads) as leads_count;
```

Expected results:
- people_count: ~75,716
- tasks_count: ~1,328
- opportunities_count: ~357
- leads_count: ~4,328

## 🎉 After Migration

Once complete, I'll build all 4 pages:
1. Contacts (People)
2. Tasks
3. Opportunities
4. Leads

All pages will use the same pattern as Accounts with filtering, sorting, and infinite scroll.
