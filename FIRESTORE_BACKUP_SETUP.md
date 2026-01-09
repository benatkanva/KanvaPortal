# Firestore Backend Backup Setup Guide

## Overview

Your code is backed up to Git, but your Firestore database needs a separate backup strategy. Here are your options:

---

## Option 1: Automated Daily Backups (Recommended)

### Using Cloud Scheduler + gcloud

**1. Enable Required APIs:**
```bash
gcloud services enable cloudscheduler.googleapis.com --project=kanvaportal
gcloud services enable cloudscheduler.googleapis.com --project=silkdistro
```

**2. Create a Cloud Scheduler Job:**

For **KanvaPortal**:
```bash
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/kanvaportal/databases/(default):exportDocuments" \
  --message-body="{\"outputUriPrefix\":\"gs://kanvaportal-backups/$(date +%Y-%m-%d)\"}" \
  --oauth-service-account-email="firebase-adminsdk@kanvaportal.iam.gserviceaccount.com" \
  --project=kanvaportal
```

For **Silk Distro**:
```bash
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/silkdistro/databases/(default):exportDocuments" \
  --message-body="{\"outputUriPrefix\":\"gs://silkdistro-backups/$(date +%Y-%m-%d)\"}" \
  --oauth-service-account-email="firebase-adminsdk-fbsvc@silkdistro.iam.gserviceaccount.com" \
  --project=silkdistro
```

**3. Create Backup Storage Buckets:**
```bash
# For KanvaPortal
gsutil mb -p kanvaportal -l us-central1 gs://kanvaportal-backups

# For Silk Distro
gsutil mb -p silkdistro -l us-central1 gs://silkdistro-backups
```

**4. Set Lifecycle Policy (Auto-delete old backups after 30 days):**

Create `lifecycle.json`:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
```

Apply to buckets:
```bash
gsutil lifecycle set lifecycle.json gs://kanvaportal-backups
gsutil lifecycle set lifecycle.json gs://silkdistro-backups
```

---

## Option 2: Manual Backups (Simple)

### Weekly/Monthly Manual Exports

**For KanvaPortal:**
```bash
# Create backup bucket (one-time)
gsutil mb -p kanvaportal -l us-central1 gs://kanvaportal-backups

# Export data (run weekly/monthly)
gcloud firestore export gs://kanvaportal-backups/$(date +%Y-%m-%d) --project=kanvaportal
```

**For Silk Distro:**
```bash
# Create backup bucket (one-time)
gsutil mb -p silkdistro -l us-central1 gs://silkdistro-backups

# Export data (run weekly/monthly)
gcloud firestore export gs://silkdistro-backups/$(date +%Y-%m-%d) --project=silkdistro
```

---

## Option 3: Firestore Managed Backups (Easiest - Recommended for Beginners)

Google Cloud Console has a built-in backup feature:

**For KanvaPortal:**
1. Go to: https://console.cloud.google.com/firestore/databases/-default-/backup-schedules?project=kanvaportal
2. Click **"Create backup schedule"**
3. Configure:
   - **Frequency**: Daily
   - **Time**: 2:00 AM (your timezone)
   - **Retention**: 30 days
   - **Location**: us-central1
4. Click **"Create"**

**For Silk Distro:**
1. Go to: https://console.cloud.google.com/firestore/databases/-default-/backup-schedules?project=silkdistro
2. Click **"Create backup schedule"**
3. Configure:
   - **Frequency**: Daily
   - **Time**: 2:00 AM (your timezone)
   - **Retention**: 30 days
   - **Location**: us-central1
4. Click **"Create"**

---

## Backup Verification

### Check if backups are running:

**For KanvaPortal:**
```bash
# List backups
gsutil ls gs://kanvaportal-backups/

# Check scheduler jobs
gcloud scheduler jobs list --project=kanvaportal
```

**For Silk Distro:**
```bash
# List backups
gsutil ls gs://silkdistro-backups/

# Check scheduler jobs
gcloud scheduler jobs list --project=silkdistro
```

---

## Restore from Backup

### If you ever need to restore:

**1. List available backups:**
```bash
gsutil ls gs://kanvaportal-backups/
```

**2. Import from backup:**
```bash
gcloud firestore import gs://kanvaportal-backups/2026-01-08 --project=kanvaportal
```

**⚠️ Warning:** Import uses "upsert" - it will overwrite existing documents with the same IDs.

---

## Recommended Setup

**For Production (KanvaPortal & Silk Distro):**
1. ✅ **Use Option 3** (Managed Backups) - Easiest to set up via console
2. ✅ **Daily backups** at 2:00 AM
3. ✅ **30-day retention** (keeps last 30 days of backups)
4. ✅ **Verify backups monthly** - Check that backups are being created

**For Extra Safety:**
- Consider weekly manual exports to a separate bucket
- Download critical backups locally for off-cloud storage
- Test restore process quarterly to ensure backups work

---

## Backup Costs

**Storage Costs:**
- ~$0.026 per GB per month (us-central1)
- Your 407K documents ≈ 550 MB ≈ $0.01/month per backup
- 30 days of backups ≈ $0.30/month

**Export/Import Costs:**
- Export: $0.10 per GB
- Import: $0.10 per GB
- Daily export of 550 MB ≈ $0.05/day ≈ $1.50/month

**Total estimated cost: ~$2/month per project**

---

## Quick Start (Recommended)

**Do this now for both projects:**

1. **Go to Firestore Backup Schedules:**
   - KanvaPortal: https://console.cloud.google.com/firestore/databases/-default-/backup-schedules?project=kanvaportal
   - Silk Distro: https://console.cloud.google.com/firestore/databases/-default-/backup-schedules?project=silkdistro

2. **Click "Create backup schedule"**

3. **Configure:**
   - Frequency: Daily
   - Time: 2:00 AM
   - Retention: 30 days

4. **Click "Create"**

Done! Your Firestore data will now be backed up automatically every day.

---

## Additional Recommendations

### Point-in-Time Recovery (PITR)

For critical production data, consider enabling Point-in-Time Recovery:
- Allows restore to any point in the last 7 days
- More expensive but provides better protection
- Enable in Firestore settings

### Cross-Region Backups

For disaster recovery, consider copying backups to a different region:
```bash
# Copy backup to different region
gsutil -m cp -r gs://kanvaportal-backups/2026-01-08 gs://kanvaportal-backups-eu/2026-01-08
```

---

## Summary

**Code Backup:** ✅ Git (already set up)  
**Database Backup:** ⚠️ Needs setup (use Option 3 - Managed Backups)  

**Action Items:**
1. Set up managed backups for kanvaportal (5 minutes)
2. Set up managed backups for silkdistro (5 minutes)
3. Verify backups are created after 24 hours
4. Test restore process once to ensure it works

Your backend data will then be safe with automated daily backups!
