# Discovered Relationships Report

**Generated:** 2026-01-20T21:38:59.305Z

**This is your CURRENT SETUP - what exists in your codebase right now**

---

## Summary

- **Collections Found:** 33
- **Relationships Discovered:** 6
  - High Confidence: 2
  - Medium Confidence: 4
  - Low Confidence: 0
- **Subcollections Found:** 1

---

## Discovered Collections

### accounts

**Fields found:** id

### activities

**Fields found:** filter, forEach, map, push

### collection

### commission_entries

**Fields found:** forEach

### contacts

### copper_companies

**Fields found:** Name, State, Street, accountId, accountNumber, accountOrderId, accountType, accountTypeSource, activeCustomer, add, address, allFields, arrayBuffer, assignee_id, avgCharges, avgDiscount, avgDiscountPercent, avgOrderValue, billingAddress, billingCity, billingState, billingZip, businessModel, businessName, byCopperCompanies, byCopperSync, byExisting, byFishbowl, carrierName, cf_698467, city, code, collection, commissionRate, company, companyName, concat, copperAccountId, copperCompanyId, copperCompanyName, copperCount, copperId, copperName, country, created, createdAt, currentAccountOrderId, custom_fields, custom_fields_raw, customerId, customerName, customerNum, customerPriority, customerSegment, customerStatus, data, date_created, date_modified, daysSinceLastOrder, details, directOrders, directRevenue, distributor, docId, docs, email, email_domain, empty, entries, errors, exists, filter, firestoreDocId, firstDirectDate, firstOrderDate, firstRepRallyDate, firstRetailDate, firstShipmentDate, fishbowlAccountId, fishbowlCustomerId, fishbowlId, fishbowlName, fishbowlUsername, forEach, get, has, id, importedAt, inTransitShipments, includes, interaction_count, isActive, isSwitcher, json, keys, lastDirectDate, lastOrderAmount, lastOrderDate, lastRepRallyDate, lastRetailDate, lastShipmentDate, lat, lateShipments, length, lifetimeValue, limit, lineItems, lng, map, match, matchReason, matchedFbCustomer, metrics, name, noSource, notes, onTimePercentage, onTimeShipments, orderCount, orderCountYTD, orders, orders_30d, orders_90d, organizationLevel, originalOwner, ownedBy, paymentTerms, phone, phone_numbers, postalCode, processedCompanies, push, recentOrders, recentShipments, reduce, ref, region, regionColor, repRallyOrders, repRallyRevenue, reprallyOrders, reprallyRevenue, retail, retailOrders, retailRevenue, salesPerson, salesPersonName, salesRepEmail, salesRepName, salesRepRegion, sales_30d, sales_90d, sampleKitDate, sampleKitSent, segment, set, shipToZip, shippingAddress, shippingCity, shippingCountry, shippingState, shippingStreet, shippingTerms, shippingZip, size, skuMix, slice, socials, sort, source, stagingId, startsWith, state, stats, status, street, suggestedAccountType, syncError, tags, toLocaleString, toLowerCase, topSkus, total, totalCharges, totalCommission, totalCompanies, totalDiscount, totalFuelSurcharge, totalNetCharges, totalOrders, totalRepRallyOrders, totalRepRallyRevenue, totalRevenue, totalSales, totalSalesYTD, totalShipments, totalSpent, totalWeight, transferStatus, trend, trim, updated, values, velocity, website, websites, wholesale, wouldCreate, wouldSkip, wouldUpdate, zip

### copper_leads

**Fields found:** data, exists, forEach, id, size

### copper_opportunities

### copper_people

**Fields found:** accountId, address, assignee_id, city, company, companyId, companyName, company_id, company_name, contact_type_id, copperId, custom_fields, data, date_created, date_modified, email, emails, entries, filter, find, firstName, first_name, forEach, get, has, hasOwnProperty, id, interaction_count, lastName, last_name, length, name, phone, phone_numbers, push, set, socials, source, state, street, title, toLocaleString, toLowerCase, trim, values, websites

### customer_sales_summary

**Fields found:** forEach

### fishbowl_customers

**Fields found:** forEach, size

### fishbowl_sales_orders

**Fields found:** 8, X, _displayStatus, _v2Status, accountNumber, accountType, accountTypeSource, add, amount, amountPaid, arrayBuffer, billTo, businessName, carrierCode, collection, commissionAmount, commissionMonth, commissionNote, commissionRate, commissionYear, commit, createDate, createdAt, csv, customerEmail, customerId, customerName, customerNotFound, customerNotes, customerNum, customerSegment, data, date, dateCompleted, dateCreated, dateIssued, dateScheduled, directOrders, docs, duplicatesDeleted, empty, entries, excludeFromCommission, excludedItemCount, excludedItems, exists, filter, find, fishbowlNum, forEach, get, getFullYear, getMonth, getTime, grandTotal, has, hasSpiff, id, importedAt, includedItemCount, includedItems, includes, internalNotes, isOverride, items, keys, length, lineItemCount, lineItems, manuallyLinked, map, matched, mismatched, mismatches, moveReason, movedFromMonth, num, orderAmount, orderDate, orderId, orderNum, orderNumber, orderRevenue, orderStatus, orderTotal, orderType, orderValue, orders, overrideReason, page, pages, postingDate, postingDateStr, push, reduce, ref, repName, reprallyOrders, retail, revenue, salesOrderId, salesOrderNum, salesPerson, salesRep, salesman, seconds, set, shipTo, shipments, shippingAmount, size, slice, soNum, soNumber, sort, startsWith, stats, status, statusName, subTotal, subtotal, taxAmount, toDate, toFixed, toISOString, toLocaleString, toLowerCase, toString, total, totalAmount, totalIncludingTax, totalPrice, trim, update, values, where

### fishbowl_soitems

### goals

### import_logs

### metrics

**Fields found:** averageDuration, callsByDay, callsByStatus, completedCalls, id, inboundCalls, inboundSMS, missedCalls, outboundCalls, outboundSMS, smsByDay, smsByStatus, totalCalls, totalDuration

### monthly_commission_summary

### monthly_commissions

**Fields found:** forEach

### notifications

**Fields found:** add, filter, forEach, length

### pipeline_deals

### pipelines

**Fields found:** find, id, length, map

### pricing_tiers

### product_import_history

**Fields found:** docs

### products

**Fields found:** docs, filter, forEach, get, map, push, size

### prospects

### quarters

**Fields found:** forEach, includes, length, map

### quote_activities

### quotes

**Fields found:** push

### regions

**Fields found:** find, flatMap, forEach, length, map, some

### saia_shipments

### shipstation_orders

### spiffs

**Fields found:** docs, length, map

### users

**Fields found:** active, add, calls, copperUserEmail, copperUserId, copper_user_id, createdAt, customClaims, data, displayName, distribution, division, docs, email, emails, empty, entries, exists, filter, find, forEach, get, getAllUsers, getIdToken, getUser, has, id, inactive, includes, isActive, json, leads, length, map, name, notes, ok, orgRole, passwordChanged, phone, photoURL, photoUrl, push, region, role, sales, salesPerson, set, size, slice, some, split, territory, title, toLowerCase, uid, user, userEmail, userId, users, wholesale

---

## Discovered Relationships

### High Confidence

#### 1. users.email → users.email

**Type:** `where_clause`
**Found in 1 location(s):**

- `C:\Projects\KanvaPortal\app\(modules)\commissions\page.tsx:74`
  ```typescript
  const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
  ```

#### 2. users.email → notifications.userEmail

**Type:** `where_clause`
**Found in 1 location(s):**

- `C:\Projects\KanvaPortal\hooks\useNotifications.ts:44`
  ```typescript
  where('userEmail', '==', user.email),
  ```

### Medium Confidence

#### 1. fishbowl_sales_orders.accountType → copper_companies.accountType

**Type:** `field_reference`
**Found in:** `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:64`

#### 2. fishbowl_sales_orders.accountTypeSource → copper_companies.accountTypeSource

**Type:** `field_reference`
**Found in:** `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:65`

#### 3. fishbowl_sales_order_items.accountType → copper_companies.accountType

**Type:** `field_reference`
**Found in:** `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:120`

#### 4. fishbowl_sales_order_items.accountTypeSource → copper_companies.accountTypeSource

**Type:** `field_reference`
**Found in:** `C:\Projects\KanvaPortal\app\api\fix-order-account-types\route.ts:121`

---

## Subcollections

### 1. user_emails → emails

**Found in 3 location(s):**

- `C:\Projects\KanvaPortal\app\api\dashboard\activities\route.ts:126`
- `C:\Projects\KanvaPortal\app\api\dashboard\stats\route.ts:124`
- `C:\Projects\KanvaPortal\app\api\gmail\callback\route.ts:101`

