# Customer Data Sync Architecture

## 🎯 Overview

**NEW ARCHITECTURE (November 2024)**: Copper is now the **single source of truth** for customer data in the Commission Calculator. The Goals App maintains the `copper_companies` collection, and the Commission Calculator syncs from it to populate `fishbowl_customers`.

## 📊 Data Flow

```
Copper CRM (External)
    ↓
Goals App → copper_companies (Firestore)
    ↓
Commission Calculator → fishbowl_customers (Firestore)
    ↓
Commission Calculations
```

## 🔄 Sync Process

### Step 0: Sync Customers from Copper
**Route:** `/api/sync-copper-customers`

**Purpose:** Pull active customer data from `copper_companies` into `fishbowl_customers`

**Features:**
- ✅ **DRY RUN MODE** (default): Analyzes changes without writing to database
- ✅ **LIVE MODE**: Applies changes after approval
- ✅ **Data Preservation**: Never overwrites commission-specific fields
- ✅ **Sales Rep Mapping**: Uses `assignee_id` from Copper → maps to `users` collection by `copperUserId`

### Step 1: Import Fishbowl Data
**Route:** `/api/fishbowl/import-unified` or `/api/fishbowl/import-chunked`

**Purpose:** Import sales orders and line items from Conversight exports

**Modified Behavior:**
- ❌ **NO LONGER creates/updates customers** (handled by Step 0)
- ✅ Creates/updates `fishbowl_sales_orders`
- ✅ Creates `fishbowl_soitems` (line items)
- ✅ Links orders to existing customers by `customerId` from CSV

### Step 2: Sync Copper → Fishbowl (Legacy)
**Route:** `/api/sync-copper-to-fishbowl`

**Purpose:** Bidirectional sync for accountType updates (will be deprecated)

## 📋 Field Mappings

### copper_companies → fishbowl_customers

| Copper Field | Copper ID | fishbowl_customers Field | Notes |
|--------------|-----------|-------------------------|-------|
| `name` | - | `name` | Company name |
| `Account Order ID cf_698467` | 698467 | `accountNumber`, `accountId` | Fishbowl account number |
| `Account Type cf_675914` | 675914 | `accountType` | Distributor/Wholesale/Retail |
| `Active Customer cf_712751` | 712751 | (filter only) | Only sync active customers |
| `Region cf_680701` | 680701 | `region` | Territory/region |
| `Account ID cf_713477` | 713477 | (used for matching) | Copper internal ID |
| `assignee_id` | - | `salesRepId`, `salesPerson` | Via users lookup |
| `Street` | - | `billingAddress`, `shippingAddress` | Street address |
| `city` | - | `billingCity`, `shippingCity` | City |
| `State` | - | `billingState`, `shippingState` | State |
| `Postal Code` | - | `billingZip`, `shipToZip` | ZIP code |
| `country` | - | `shippingCountry` | Country |

### Preserved Fields (NEVER OVERWRITTEN)

These commission-specific fields are **NEVER** touched by the sync:
- `transferStatus` - Manual override for account transfers
- `originalOwner` - Original sales rep before transfer
- `fishbowlUsername` - Fishbowl system username
- Any other fields not in the sync mapping

## 🔒 Safety Features

1. **Dry Run Mode (Default)**
   - No writes to database
   - Detailed change report
   - Shows before/after for each field
   - Highlights critical changes (e.g., accountType)

2. **Live Mode (Explicit Opt-In)**
   - Requires confirmation dialog
   - Only enabled after dry-run review
   - Full audit logging

3. **Data Preservation**
   - Commission fields explicitly preserved
   - Merge strategy (update only synced fields)
   - No deletions (only creates/updates)

4. **Matching Strategy**
   - Primary: By Copper ID (`copperId` field)
   - Fallback 1: By Account Order ID (`accountNumber`)
   - Fallback 2: By Account ID (`accountId`)

## 🧪 Testing Workflow

### Initial Setup
1. Go to Settings → Monthly Commissions tab
2. Click **"🟢 DRY RUN (Safe)"** in Step 0
3. Review the detailed report:
   - How many customers would be created
   - How many would be updated
   - Which fields would change
   - Any critical changes (accountType)
4. Check console logs for first 10 sample changes
5. Verify no unexpected accountType changes

### Approval
1. If dry-run looks good, click **"🔴 LIVE MODE"**
2. Confirm the warning dialog
3. Wait for completion (~2-5 minutes)
4. Review results:
   - Customers created/updated
   - Any errors
5. Verify customers in the Customers tab

### Ongoing Use
1. Run Step 0 (Customer Sync) before each commission calculation
2. Or run daily via Cloud Function (future enhancement)

## 📝 API Response Format

### Dry Run Response
```json
{
  "dryRun": true,
  "copperCompaniesLoaded": 2000,
  "activeCompanies": 976,
  "fishbowlCustomersLoaded": 1482,
  "usersLoaded": 12,
  "wouldCreate": 5,
  "wouldUpdate": 843,
  "noChanges": 128,
  "errors": 0,
  "changes": [
    {
      "fishbowlCustomerId": "abc123",
      "copperCompanyId": "xyz789",
      "companyName": "ABC Wholesale",
      "action": "update",
      "fieldsChanged": ["accountType", "region"],
      "before": { "accountType": "Retail", "region": "" },
      "after": { "accountType": "Distributor", "region": "Central" },
      "concerns": [
        "⚠️ Account Type changing: \"Retail\" → \"Distributor\"",
        "✅ Preserving: transferStatus, originalOwner"
      ]
    }
  ],
  "errors_details": []
}
```

## 🚀 Future Enhancements

1. **Cloud Function** - Daily scheduled sync at 2 AM
2. **Webhook** - Real-time sync on Copper company updates
3. **Rollback** - Undo capability for last sync
4. **History** - Track sync history and changes over time
5. **Notifications** - Email alerts on critical changes

## 🔗 Related Files

- `/app/api/sync-copper-customers/route.ts` - Main sync endpoint
- `/app/settings/page.tsx` - UI (Step 0 section)
- `/app/api/fishbowl/import-unified/route.ts` - Import (to be modified)
- `/app/api/fishbowl/import-chunked/route.ts` - Import (to be modified)
- `/docs/Copper_Metadata_10.10.md` - Copper field definitions

## ⚠️ Important Notes

1. **Only Active Customers**: The sync filters by `Active Customer cf_712751 = checked`
2. **Sales Rep Mapping**: Requires `users` collection to have `copperUserId` populated
3. **Commission Data**: Manual edits (transferStatus, originalOwner) are always preserved
4. **Idempotent**: Safe to run multiple times (no duplicates)
5. **Performance**: ~2-5 minutes for 1000 customers

## 📞 Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify `copper_companies` collection has data
3. Verify `users` collection has `copperUserId` fields
4. Run dry-run first to diagnose
5. Contact developer if persistent errors
