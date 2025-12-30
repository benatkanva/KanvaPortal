# Commission Calculation Process

## Overview
This document explains how monthly commissions are calculated after the app consolidation.

## ✅ Fishbowl Import - CORRECT DATA NOW

**After the fix deployed today:**

When you import Fishbowl data (Step 3: Import Fishbowl Sales Orders), the system will now create:

### Collections Created/Updated:

1. **`fishbowl_customers`** - Customer records
   - `currentOwner`: Current account owner (from "Sales Rep" column) ✅
   - `salesRep`: Current account owner (legacy field) ✅
   - `salesPerson`: Display name (legacy compatibility) ✅
   - **Fixed:** No longer uses "Sales person" (originator) for customer ownership

2. **`fishbowl_sales_orders`** - Sales order records
   - `salesPerson`: Who originated THIS sale (from "Sales person" column) ✅
   - `salesRep`: Account owner at time of order (from "Sales Rep" column) ✅
   - `customerId`: Link to customer
   - `postingDate`: Order date
   - `totalPrice`: Order total
   - `commissionMonth`: Format "YYYY-MM" for filtering

3. **`fishbowl_soitems`** - Line item records
   - `salesPerson`: Who originated the sale ✅
   - `salesRep`: Account owner at time of order ✅
   - `productNum`: Product number
   - `quantity`: Quantity sold
   - `totalPrice`: Line item total
   - `commissionMonth`: Format "YYYY-MM"

## Commission Calculation Process

### API Endpoint: `/api/calculate-monthly-commissions`

**Request:**
```json
{
  "month": "12",
  "year": 2024,
  "salesPerson": "BenW"  // Optional - calculates for all if omitted
}
```

### Step-by-Step Process:

#### 1. **Load Configuration**
- Loads commission rates from `settings` collection
- Loads commission rules from `settings` collection
- Loads active spiffs from `spiffs` collection

#### 2. **Load Users (Sales Reps)**
```typescript
// Query: users where isCommissioned == true AND isActive == true
// Maps by salesPerson field (e.g., "BenW", "JaredM")
```

#### 3. **Clear Previous Month Data**
Deletes existing records for the month from:
- `monthly_commissions` - Individual commission records
- `monthly_commission_summary` - Summary by rep

#### 4. **Load Customers**
```typescript
// Loads fishbowl_customers
// Maps by customerId, accountNumber, customerNum
// Gets accountType (Distributor, Wholesale, Retail)
```

#### 5. **Query Sales Orders**
```typescript
// Query: fishbowl_sales_orders
// WHERE commissionMonth == "2024-12"
// AND salesPerson == "BenW" (if filtering by rep)
// 
// CRITICAL: Uses salesPerson field (order originator)
// This is WHO GETS THE COMMISSION
```

#### 6. **Process Each Order**
For each order:

a. **Skip if:**
   - Duplicate order number
   - Zero quantity
   - Admin/House account
   - Shopify/Commerce order
   - Retail account (unless rules allow)

b. **Get Customer Info:**
   - Account type (Distributor, Wholesale, Retail)
   - Customer status (New Business, 6-month active, 12-month active)

c. **Get Commission Rate:**
   - Based on rep's title (Account Executive, Sr. AE, etc.)
   - Based on account type (Distributor, Wholesale, Retail)
   - Based on customer status (New, Active, etc.)

d. **Calculate Commission Base:**
   - Order total MINUS shipping MINUS CC processing
   - Apply commission rate percentage
   - Add any applicable spiffs

e. **Create Commission Record:**
   - Writes to `monthly_commissions` collection
   - Links to order, customer, rep

#### 7. **Create Summary**
Aggregates all commissions for each rep:
- Writes to `monthly_commission_summary` collection
- Total commission amount
- Total revenue
- Number of orders
- By rep and month

### Collections Used (READ):
1. `settings` - Commission rates and rules
2. `spiffs` - Active spiff bonuses
3. `users` - Sales rep information (isCommissioned, isActive, salesPerson)
4. `fishbowl_customers` - Customer account types
5. `fishbowl_sales_orders` - Order data with salesPerson field

### Collections Written (WRITE):
1. `monthly_commissions` - Individual commission records per order
2. `monthly_commission_summary` - Aggregated totals per rep per month
3. `commission_calc_progress` - Real-time calculation progress
4. `commission_calculation_logs` - Calculation audit trail

## Key Fields for Commission Attribution

### ✅ CORRECT (After Fix):

**For Commission Calculation:**
- Uses `salesPerson` from **`fishbowl_sales_orders`** (order originator)
- This determines WHO GETS THE COMMISSION
- Example: Order has `salesPerson: "BenW"` → Ben gets commission

**For Customer Management:**
- Uses `currentOwner` or `salesRep` from **`fishbowl_customers`** (current account owner)
- This determines WHO MANAGES THE ACCOUNT
- Example: Customer has `currentOwner: "JaredM"` → Jared manages account

**These are SEPARATE concepts and should never be mixed!**

## Testing December Commissions

### Pre-Test Checklist:
1. ✅ Fishbowl import fix deployed
2. ✅ Customer filtering fix deployed
3. ⏳ Re-import Fishbowl data (to fix customer ownership)
4. ⏳ Recalculate December commissions

### Expected Results:
- Commissions attributed to correct sales person (order originator)
- Customer filtering shows correct account ownership
- No mixing of originator vs current owner

### Verification Steps:
1. Check Ben's commission report
2. Verify order count matches
3. Verify commission amounts are correct
4. Check that only Ben's originated orders appear
5. Verify customer filtering shows Ben's assigned accounts

## Migration Verification

### What Changed After Consolidation:
1. ✅ User management centralized in Admin
2. ✅ Single `users` collection for all modules
3. ✅ Commission calculation uses correct fields
4. ✅ Customer management uses correct fields
5. ✅ Clear separation between originator and owner

### What Stayed the Same:
- Commission calculation logic (rates, rules, spiffs)
- Order processing and filtering
- Customer account type handling
- Spiff application logic

### Potential Issues Fixed:
- ✅ Customer filtering showing wrong accounts
- ✅ Field confusion between salesPerson and salesRep
- ✅ Fishbowl import using wrong field for customers
- ✅ Mixed concepts of originator vs owner

## Summary

**Commission Calculation = Order Originator (salesPerson from orders)**
**Customer Management = Current Owner (currentOwner/salesRep from customers)**

The system now correctly separates these two concepts throughout the entire application.
