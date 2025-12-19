# ShipStation Orders Component - Transfer to Commissions App

## Overview
Transfer the ShipStation orders tracking component from SalesPortal to the Commissions application as a standalone page/tab (NOT a modal). Implement Firestore caching with hourly Cloud Function syncs for performance.

---

## FILES TO COPY

### Source Files (from SalesPortal)
```
c:\Projects\SalesPortal\js\shipstation-integration.js
c:\Projects\SalesPortal\server.js (ShipStation proxy endpoints only)
```

### Key Code Sections to Extract

**1. ShipStationIntegration Class** (`shipstation-integration.js` lines 1-510)
- API methods: `listOrders`, `listShipments`, `listShipmentsV2`, `listLabelsV2`, `getTrackingV2`
- Tracking URL generation: `getTrackingUrl()`

**2. Server Proxy Endpoints** (`server.js`)
- `/api/shipstation/*` - v1 API proxy (Basic Auth)
- `/api/shipstation-v2/*` - v2 API proxy (API-Key header)

---

## TARGET STRUCTURE (Commissions App)

```
/src
  /pages
    /shipstation
      ShipStationOrders.tsx        # Main page component
      ShipStationOrders.module.css # Styles
  /services
    shipstationService.ts          # API calls (or Firestore reads)
  /types
    shipstation.ts                 # TypeScript interfaces
/functions
  /src
    shipstationSync.ts             # Cloud Function for hourly sync
```

---

## DESIRED RESULTS

### 1. Standalone Page (NOT Modal)
Convert the modal-based viewer to a full page:
- Route: `/shipstation` or `/orders/shipstation`
- Add to app navigation/sidebar
- Full-width layout with filters at top

### 2. UI Features (Already Implemented)
- **Date range picker** (start/end dates)
- **Source filter buttons**: All, Shopify, RepRally, Fishbowl
- **Status filter buttons**: All, Delivered, In Transit, Label, Awaiting
- **Search input** for order lookup
- **Expandable rows** - click to show order details
- **Infinite scroll** - auto-load more on scroll
- **Tracking links** - clickable tracking numbers
- **Color-coded status badges**:
  - Delivered: Dark green (#155724)
  - In Transit: Green (#28a745)
  - Label Purchased: Blue (#17a2b8)
  - Awaiting: Yellow (#ffc107)

### 3. Data Display Columns
| Column | Source |
|--------|--------|
| Order # | orderNumber |
| Date | orderDate |
| Customer | billTo.name or shipTo.name |
| Email | customerEmail |
| Ship To | shipTo.city, shipTo.state |
| Carrier | carrierCode |
| Tracking | trackingNumber (clickable) |
| Status | tracking_status from labels API |
| Total | orderTotal |
| Items | items count |

### 4. Expanded Row Details
- Ship To / Bill To addresses
- All shipments with tracking links
- Items table (SKU, Name, Qty, Price)
- Customer/Internal notes

---

## FIRESTORE CACHING IMPLEMENTATION

### Firestore Collections
```
/shipstation_orders/{orderId}
  - orderNumber: string
  - orderDate: timestamp
  - orderStatus: string
  - customerEmail: string
  - billTo: { name, street1, city, state, postalCode }
  - shipTo: { name, street1, city, state, postalCode }
  - items: array
  - orderTotal: number
  - shipments: array (with tracking info)
  - trackingStatus: string (from labels API)
  - lastSyncedAt: timestamp
  - expiresAt: timestamp (for TTL)

/shipstation_sync_meta/lastSync
  - lastRunAt: timestamp
  - ordersProcessed: number
  - status: 'success' | 'error'
```

### Cloud Function: Hourly Sync
```typescript
// functions/src/shipstationSync.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const syncShipStationOrders = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    
    // 1. Fetch orders from ShipStation API (last 15 days)
    // 2. Fetch shipments and match to orders
    // 3. Fetch labels for tracking_status
    // 4. Batch write to Firestore
    // 5. Delete orders older than 15 days (TTL)
    
    // ... implementation
  });
```

### Frontend Service (Read from Firestore)
```typescript
// services/shipstationService.ts
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export async function getOrders(startDate: Date, endDate: Date) {
  const ordersRef = collection(db, 'shipstation_orders');
  const q = query(
    ordersRef,
    where('orderDate', '>=', startDate),
    where('orderDate', '<=', endDate),
    orderBy('orderDate', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

## SHIPSTATION API CREDENTIALS

Store in Firebase environment config or Secret Manager:
```
SHIPSTATION_API_KEY=xxxxx
SHIPSTATION_API_SECRET=xxxxx
SHIPSTATION_API_KEY_V2=xxxxx  (for v2 endpoints)
```

### API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| GET /orders | List orders by date range |
| GET /shipments | Get tracking numbers |
| GET /v2/shipments | Get shipment_status |
| GET /v2/labels | Get tracking_status (delivered, in_transit) |

---

## MIGRATION STEPS

### Phase 1: Basic Transfer
1. Create ShipStationOrders page component
2. Copy core logic from shipstation-integration.js
3. Set up API proxy routes (or use Cloud Functions as proxy)
4. Add page to routing and navigation
5. Test direct API calls work

### Phase 2: Firestore Caching
1. Create Firestore collections
2. Implement Cloud Function for hourly sync
3. Update frontend to read from Firestore
4. Add manual "Refresh" button to trigger sync
5. Implement 15-day TTL cleanup

### Phase 3: Optimization
1. Add Firestore indexes for query performance
2. Implement real-time listeners for live updates
3. Add loading skeletons
4. Cache filter results locally

---

## SOURCE FILTER LOGIC
```javascript
// Shopify orders: start with "Sh"
orderNum.toLowerCase().startsWith('sh')

// RepRally orders: start with "#"
orderNum.startsWith('#')

// Fishbowl orders: 4-5 digit numbers
/^\d{4,5}$/.test(orderNum)
```

## STATUS FILTER LOGIC
```javascript
// Delivered: tracking_status = 'delivered'
// In Transit: tracking_status = 'in_transit'
// Label: shipment_status = 'label_purchased' or 'label_created'
// Awaiting: status = 'awaiting_shipment' or no tracking
```

---

## TRACKING URL PATTERNS
```javascript
const trackingUrls = {
  'ups': 'https://www.ups.com/track?tracknum=',
  'usps': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  'fedex': 'https://www.fedex.com/fedextrack/?trknbr=',
  'stamps_com': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  'dhl': 'https://www.dhl.com/en/express/tracking.html?AWB='
};
```

---

## NOTES
- The v2 labels API provides the real carrier tracking status (delivered, in_transit)
- Match shipments to orders by orderId AND orderNumber
- Some external_shipment_ids have "S" prefix that needs stripping for matching
- Infinite scroll loads 100 orders per page
- Filters are client-side on loaded data
