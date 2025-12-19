# Customer Data Protection Strategy

## Overview
Customer data comes from multiple sources and manual corrections are critical for commission accuracy. This document explains how we protect manually edited data from being overwritten.

## Data Sources (Priority Order)

### 1. **Manual CSV Bulk Edits** (HIGHEST PRIORITY)
- Source: Admin bulk CSV imports via Customer Management
- Fields Tracked: All 21 customer fields
- Protection: Fields marked with `manuallyEdited: true` and `lastManualEdit` timestamp
- **Fishbowl imports will NOT overwrite these fields**

### 2. **Copper CRM Sync**
- Source: Copper API → `copper_companies` → `fishbowl_customers`
- Fields Written: `accountType`, `copperId`, `accountTypeSource`
- Protection: Only overwrites if `accountTypeSource !== 'manual_edit'`
- Run via: Settings → Data & Sync → Sync Copper to Fishbowl

### 3. **Fishbowl Sales Order Import** (LOWEST PRIORITY)
- Source: Fishbowl CSV export → `fishbowl_sales_orders`
- Current Behavior: **Does NOT update existing customer records**
- Protection Strategy: Complete customer record protection
- Note: Only creates NEW customers with `needsReview: true` flag

## How Manual Edits Are Protected

### When You Bulk Import CSV:
```typescript
{
  manuallyEdited: true,           // Flag indicating manual override
  lastManualEdit: Timestamp.now(), // When edited
  editSource: 'csv_bulk_import'   // How edited
}
```

### When Fishbowl Imports Run:
The import checks `existingData.manuallyEdited`:
- If `true` → **SKIP CUSTOMER UPDATE** (preserve your edits)
- If `false` → Allow address updates from Fishbowl
- NEW customers → Create with `needsReview: true`

### When Copper Syncs Run:
Copper sync respects manual edits:
- `accountType` only updated if not manually set
- `copperId` always updated (link to CRM)
- `accountTypeSource` shows data origin

## CSV Export/Import Workflow

### ✅ Complete Field List (21 fields):
1. Customer # (identifier)
2. Name
3. Account Number
4. Shipping Address
5. Shipping City
6. Shipping State (use 2-letter abbreviations)
7. Shipping Zip
8. Billing Address
9. Billing City
10. Billing State (use 2-letter abbreviations)
11. Billing Zip
12. Sales Rep (display name)
13. Fishbowl Username (sales rep ID)
14. Account Type (Wholesale/Distributor/Retail)
15. Transfer Status (own/transferred/new)
16. Original Owner
17. Copper ID (read-only)
18. Account Type Source (read-only)
19. First Order Date (read-only)
20. Last Order Date (read-only)
21. Total Orders (read-only)

### 📝 Recommended Edit Process:
1. **Export** → Download current customer data
2. **Edit in Excel** → Make corrections (addresses, sales reps, account types, etc.)
3. **Save as CSV** → Keep all 21 columns
4. **Import CSV** → Upload edited file
5. **Preview** → Review all changes before committing
6. **Approve** → Commit changes to database

### 🛡️ Data Protection Guarantees:
- ✅ Your CSV edits are PERMANENT (marked as `manuallyEdited`)
- ✅ Fishbowl re-imports will NOT overwrite your edits
- ✅ Copper sync will NOT overwrite manually set account types
- ✅ Preview shows exactly what will change before committing

## Field-Level Protection Rules

| Field | Manual CSV | Copper Sync | Fishbowl Import |
|-------|-----------|-------------|-----------------|
| Customer Name | ✅ Protected | ❌ No access | ❌ Skipped if exists |
| Account Number | ✅ Protected | ✅ Can fill missing | ❌ Skipped if exists |
| Shipping Address | ✅ Protected | ❌ No access | ❌ Skipped if exists |
| Billing Address | ✅ Protected | ❌ No access | ❌ Skipped if exists |
| Sales Rep | ✅ Protected | ✅ Can update | ❌ Skipped if exists |
| Account Type | ✅ Protected | ✅ Can update* | ❌ Skipped if exists |
| Transfer Status | ✅ Protected | ❌ No access | ❌ Skipped if exists |
| Original Owner | ✅ Protected | ✅ Auto-tracked | ❌ Skipped if exists |

*Copper only updates accountType if not manually set

## Troubleshooting

### "My edits keep getting overwritten!"
- Check if `manuallyEdited: true` is set on the customer document
- CSV imports should automatically set this flag
- If missing, use UI single-customer edit or re-import via CSV

### "Fishbowl has updated addresses, how do I get them?"
- Current behavior: Fishbowl does NOT update existing customers
- To update: Delete the customer record and re-import (will lose manual edits)
- Better: Use CSV bulk import to update addresses manually

### "How do I know what's been manually edited?"
- Check Firestore document for `manuallyEdited: true`
- Check `lastManualEdit` timestamp
- Check `editSource` field (shows 'csv_bulk_import' or 'ui_edit')

## Future Enhancements

### Potential Improvements:
1. **Field-level tracking** - Track which specific fields are manually edited
2. **Hybrid updates** - Allow Fishbowl to update non-edited fields only
3. **Edit history** - Log all changes to customer records
4. **Conflict resolution UI** - Show when Fishbowl data differs from manual edits
5. **Bulk review** - Flag customers that need manual review after Fishbowl import

### Current Limitations:
- All-or-nothing protection (entire customer record)
- No edit history or change tracking
- No conflict detection or warnings
- Manual edits require CSV re-export/import cycle
