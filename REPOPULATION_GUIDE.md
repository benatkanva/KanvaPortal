# Data Repopulation Guide

## 🎯 Overview
This guide documents the complete data pipeline and how to safely repopulate all collections after a nuclear deletion.

---

## 📦 Collections & Dependencies

### **Primary Collections (Source Data)**

#### 1. `fishbowl_customers`
- **Source:** Copper CRM sync or manual customer management
- **Repopulation:** 
  - Automatic via Copper sync (if enabled)
  - Manual via Settings → Customers tab
- **Dependencies:** None (independent)
- **Safe to delete:** ⚠️ Only if you have Copper sync or customer export

#### 2. `fishbowl_sales_orders`
- **Source:** Fishbowl CSV import via `/api/fishbowl/import-unified`
- **Repopulation:** Import Fishbowl export CSV files
- **Dependencies:** None (independent)
- **Safe to delete:** ✅ Yes - can reimport from Fishbowl exports

#### 3. `fishbowl_soitems` (line items)
- **Source:** Fishbowl CSV import via `/api/fishbowl/import-unified`
- **Repopulation:** Automatically created during order import
- **Dependencies:** Created alongside `fishbowl_sales_orders`
- **Safe to delete:** ✅ Yes - recreated during order import

---

### **Derived Collections (Calculated from Primary)**

#### 4. `monthly_commissions`
- **Source:** Calculated via `/api/calculate-monthly-commissions`
- **Repopulation:** Run commission calculation for each month
- **Dependencies:** 
  - `fishbowl_sales_orders` (required)
  - `fishbowl_customers` (optional - for transfer status)
  - `commission_rates` (required - for rate lookup)
- **Safe to delete:** ✅ Yes - can recalculate anytime

#### 5. `monthly_commission_summary`
- **Source:** Aggregated via `/api/recalculate-month-summary`
- **Repopulation:** Run summary calculation for each month
- **Dependencies:** 
  - `monthly_commissions` (required)
- **Safe to delete:** ✅ Yes - can recalculate from commissions

#### 6. `customer_sales_summary`
- **Source:** Migrated via `/api/migrate-customer-summary`
- **Repopulation:** Run migration endpoint
- **Dependencies:** 
  - `fishbowl_sales_orders` (required)
  - `fishbowl_customers` (optional)
- **Safe to delete:** ✅ Yes - can remigrate from orders

---

## 🔄 Complete Repopulation Workflow

### **Scenario 1: Delete Commissions Only (Fastest)**
**What to delete:**
- `monthly_commissions`
- `monthly_commission_summary`

**Repopulation steps:**
1. Recalculate commissions for each month:
   - Settings → Commissions tab
   - Select month → Calculate Commissions
   - Repeat for each month (Jan-Dec)

2. Summary auto-updates during calculation
   - No additional action needed

**Time estimate:** ~5-10 minutes per month

---

### **Scenario 2: Delete Orders + Commissions (Clean Slate)**
**What to delete:**
- `fishbowl_sales_orders`
- `fishbowl_soitems`
- `monthly_commissions`
- `monthly_commission_summary`
- `customer_sales_summary` (optional)

**Repopulation steps:**
1. **Import Fishbowl Data:**
   - Go to Settings → Import tab
   - Upload Fishbowl CSV export for each month
   - System creates `fishbowl_sales_orders` and `fishbowl_soitems`
   - Repeat for all months (Jan-Dec 2024, Jan-Dec 2025)

2. **Recalculate Commissions:**
   - Settings → Commissions tab
   - Calculate for each month (Jan-Dec 2024, Jan-Dec 2025)
   - Creates `monthly_commissions` and `monthly_commission_summary`

3. **Rebuild Customer Summary (Optional):**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/migrate-customer-summary" -Method POST
   ```
   - Creates/updates `customer_sales_summary`

**Time estimate:** ~2-4 hours total

---

### **Scenario 3: Nuclear Everything (Most Thorough)**
**What to delete:**
- All collections from Scenario 2
- `fishbowl_customers` (if you have Copper sync or export)

**Repopulation steps:**
1. **Restore Customers:**
   - If Copper sync enabled: Trigger sync
   - If manual: Import customer CSV or recreate via UI

2. Follow Scenario 2 steps (Import → Calculate → Migrate)

**Time estimate:** ~3-5 hours total

---

## 🛡️ Safety Checklist

Before deleting any collections:

- [ ] **Backup Fishbowl CSV exports** for all months
- [ ] **Verify Copper sync** is working (if using)
- [ ] **Export customer list** from Settings → Customers
- [ ] **Test with one month first** (e.g., December 2025)
- [ ] **Document current commission totals** for verification
- [ ] **Ensure commission_rates collection** has all rate rules

---

## 🧪 Testing Workflow (Recommended)

### **Test with December 2025 Only:**

1. **Delete December data:**
   ```powershell
   # Dry run first
   Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary&year=2025" -Method POST
   
   # Actually delete
   Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary&year=2025&confirmation=true" -Method POST
   ```

2. **Reimport December orders:**
   - Settings → Import → Upload December Fishbowl CSV

3. **Recalculate December commissions:**
   - Settings → Commissions → Select December → Calculate

4. **Verify results:**
   - Check Customer 1684: Should show 6% rate, $2,242 commission
   - Compare total commissions to previous calculation
   - Verify all reps have correct amounts

5. **If successful:** Proceed with full year deletion

---

## 📊 Verification Queries

After repopulation, verify data integrity:

### **Check Order Counts:**
```
Navigate to: http://localhost:3000/api/debug-customer-1684
Verify: Only 2025 orders exist, no phantom 2024 orders
```

### **Check Commission Totals:**
- Compare monthly totals before/after
- Verify Customer 1684 shows 6% rate
- Check for any "transferred" flags that seem incorrect

### **Check Customer Summary:**
- Verify first/last order dates are correct
- Check lifetime values match order totals

---

## 🚨 Common Issues & Solutions

### **Issue: Orders not importing**
- **Cause:** CSV format mismatch
- **Solution:** Verify CSV has all required columns (see import-unified route)

### **Issue: Commissions calculating at wrong rates**
- **Cause:** Missing commission_rates or incorrect transfer detection
- **Solution:** Verify commission_rates collection, check transfer status in customers

### **Issue: Customer summary not updating**
- **Cause:** Migration endpoint not run
- **Solution:** Run `/api/migrate-customer-summary`

### **Issue: Phantom old orders appearing**
- **Cause:** Incomplete deletion or duplicate imports
- **Solution:** Use debug endpoint to identify, delete specific orders

---

## 🔧 Useful Endpoints

### **Delete Data:**
```powershell
# Dry run (see what would be deleted)
Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary&year=2025" -Method POST

# Delete commissions only (2025)
Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary&year=2025&confirmation=true" -Method POST

# Delete everything including orders (2025)
Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary,fishbowl_sales_orders&year=2025&confirmation=true" -Method POST

# Delete 2024 data
Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary,fishbowl_sales_orders&year=2024&confirmation=true" -Method POST
```

### **Debug Specific Customer:**
```
http://localhost:3000/api/debug-customer-1684
```

### **Rebuild Customer Summary:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/migrate-customer-summary" -Method POST
```

---

## ✅ Recommended Approach

**For your situation (phantom 2024 orders):**

1. **Delete 2024 + 2025 orders and commissions:**
   ```powershell
   # 2024
   Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary,fishbowl_sales_orders&year=2024&confirmation=true" -Method POST
   
   # 2025 (already done)
   Invoke-WebRequest -Uri "http://localhost:3000/api/nuke-ytd-data?collections=monthly_commissions,monthly_commission_summary,fishbowl_sales_orders&year=2025&confirmation=true" -Method POST
   ```

2. **Reimport Fishbowl data:**
   - Import all 2024 months (if needed for historical data)
   - Import all 2025 months (Jan-Dec)

3. **Recalculate commissions:**
   - Calculate each month in order (Jan → Dec)
   - Verify totals match expected amounts

4. **Verify Customer 1684:**
   - Should only show June + December 2025 orders
   - Should show 6% rate
   - No phantom 2024 orders

---

## 📝 Notes

- **Commission rates:** Stored in `commission_rates` collection - DO NOT DELETE
- **Spiff rules:** Stored in `spiff_rules` collection - DO NOT DELETE
- **User accounts:** Stored in `users` collection - DO NOT DELETE
- **Settings:** Various settings collections - DO NOT DELETE

**Only delete transaction/calculation data, never configuration data!**
