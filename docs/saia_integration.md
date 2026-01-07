# Windsurf AI Prompt: Integrate SAIA Shipping Data into KanvaPortal

## Context

We have a working SAIA shipping automation that stores data in Firebase Realtime Database at `/shipping/saia/`. This data needs to be integrated into our existing KanvaPortal Next.js application under the Tools sidebar's shipping tab.

## Current System Architecture

### Firebase Database Structure

```
kanvaportal (Firebase Realtime Database)
└── shipping/
    └── saia/
        ├── shipments/
        │   └── {proNumber}/
        │       ├── proNumber: string
        │       ├── customerName: string
        │       ├── customerCode: string
        │       ├── customerAddress: string
        │       ├── customerCity: string
        │       ├── customerState: string
        │       ├── customerZip: string
        │       ├── weight: number
        │       ├── pieces: number
        │       ├── charges: number
        │       ├── netCharges: number
        │       ├── fuelSurcharge: number
        │       ├── pickupDate: string
        │       ├── deliveryDate: string
        │       ├── deliveryTime: string
        │       ├── status: string (e.g., "Delivered", "In Transit")
        │       ├── onTime: boolean
        │       ├── latePickup: boolean
        │       ├── actualDays: number
        │       ├── standardDays: number
        │       ├── signature: string
        │       ├── timeArrive: string
        │       ├── timeDepart: string
        │       ├── bolNumber: string
        │       ├── poNumber: string
        │       ├── originTerminal: string
        │       ├── destTerminal: string
        │       └── importedAt: string (ISO timestamp)
        └── customers/
            └── {sanitizedCustomerName}/
                ├── name: string
                ├── code: string
                ├── address: string
                ├── city: string
                ├── state: string
                ├── zip: string
                ├── totalShipments: number
                ├── totalWeight: number
                ├── totalCharges: number
                ├── totalNetCharges: number
                ├── totalFuelSurcharge: number
                ├── deliveredShipments: number
                ├── onTimeShipments: number
                ├── lateShipments: number
                ├── inTransitShipments: number
                ├── onTimePercentage: number
                ├── avgWeight: number
                ├── avgCharges: number
                ├── avgNetCharges: number
                ├── firstShipmentDate: string
                ├── lastShipmentDate: string
                ├── lastUpdated: string (ISO timestamp)
                └── recentShipments: Array<{
                    proNumber: string,
                    pickupDate: string,
                    deliveryDate: string,
                    status: string,
                    weight: number,
                    charges: number
                }>
```

### Existing Firebase Configuration

The app already has Firebase initialized. The config is:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q",
  authDomain: "kanvaportal.firebaseapp.com",
  databaseURL: "https://kanvaportal-default-rtdb.firebaseio.com",
  projectId: "kanvaportal",
  storageBucket: "kanvaportal.firebasestorage.app",
  messagingSenderId: "829835149823",
  appId: "1:829835149823:web:500d938c7c6ed3addf67ca"
};
```

## Task Requirements

### 1. Create SAIA Shipping Components

Create the following components in the appropriate directory (likely `/components/shipping/` or `/components/tools/shipping/`):

#### A. `SAIAShippingDashboard.tsx`

Main dashboard component that displays:

* **Summary Statistics Cards** (at top):
  * Total Customers
  * Total Shipments
  * Total Weight (lbs)
  * Total Charges ($)
* **Search & Filter Bar** :
* Search input for customer name, city, or state
* Filter buttons:
  * All Customers
  * High Volume (5+ shipments)
  * Recent Activity (last 7 days)
  * Best On-Time % (90%+)
* **Customer Cards Grid** :
* Display all customers as cards
* Each card shows:
  * Customer name and location
  * Total shipments count
  * Total weight
  * Total charges
  * Average charge per shipment
  * On-time delivery percentage with color coding:
    * Green (≥90%): Excellent
    * Orange (75-89%): Warning
    * Red (<75%): Needs attention
* Cards should be clickable to view details

#### B. `SAIACustomerDetail.tsx`

Modal or detail view component that displays when a customer card is clicked:

* **Customer Information Section** :
* Full name
* Customer code
* Complete address
* City, state, zip
* **Performance Metrics Section** :
* Total shipments
* Delivered shipments
* On-time deliveries (count and percentage)
* Late deliveries
* In-transit shipments
* First shipment date
* Last shipment date
* **Financial Summary Section** :
* Total charges
* Total net charges
* Total fuel surcharge
* Average charge per shipment
* Average weight per shipment
* **Recent Shipments List** :
* Last 20 shipments
* For each shipment display:
  * PRO number
  * Status badge (color-coded by status)
  * Weight and charges
  * Pickup and delivery dates
  * Signature (if available)
  * Origin → Destination terminals

#### C. `SAIAShipmentSearch.tsx`

Component for searching specific shipments:

* Search by PRO number
* Display single shipment details:
  * All tracking information
  * Customer details
  * Pickup and delivery timeline
  * Charges breakdown
  * Terminal routing
  * Signature and delivery confirmation

### 2. Create Firebase Hooks

Create custom hooks in `/hooks/` or `/lib/hooks/`:

#### `useSAIACustomers.ts`

```typescript
// Hook to fetch and listen to customer data
// Returns: { customers, loading, error, refetch }
// Should use Firebase onValue for real-time updates
```

#### `useSAIAShipments.ts`

```typescript
// Hook to fetch and listen to shipment data
// Optional filtering by customer, date range, status
// Returns: { shipments, loading, error, refetch }
```

#### `useSAIACustomerDetail.ts`

```typescript
// Hook to fetch single customer with all shipments
// Accepts: customerKey
// Returns: { customer, shipments, loading, error }
```

### 3. Update Existing Shipping Page/Tab

Locate the existing shipping tab component (likely under `/pages/tools/shipping` or `/app/tools/shipping`) and:

#### Add SAIA Section

* Add a new tab or section labeled "SAIA Shipping"
* Import and render the `SAIAShippingDashboard` component
* Ensure styling is consistent with existing tools/components
* Add loading states and error handling

#### Navigation Structure

```
Tools Sidebar
└── Shipping
    ├── [Existing shipping tools/sections]
    └── SAIA Tracking (NEW)
        ├── Dashboard (default view)
        ├── Search Shipment (by PRO number)
        └── [Customer Detail - opens in modal]
```

### 4. Styling Requirements

Use the existing KanvaPortal design system:

* Follow existing color scheme and component patterns
* Use Tailwind CSS classes (already in the project)
* Ensure responsive design (mobile, tablet, desktop)
* Match existing card, button, and form styles
* Use existing loading spinners and error states

**Color Coding for On-Time Performance:**

* Green: `bg-green-500` or `text-green-600` (≥90%)
* Orange/Yellow: `bg-yellow-500` or `text-yellow-600` (75-89%)
* Red: `bg-red-500` or `text-red-600` (<75%)

### 5. Data Fetching Pattern

Use Firebase Realtime Database with real-time listeners:

```typescript
import { getDatabase, ref, onValue, query, orderByChild } from 'firebase/database';

// Example pattern for customers
const database = getDatabase();
const customersRef = ref(database, 'shipping/saia/customers');

onValue(customersRef, (snapshot) => {
  const data = snapshot.val();
  // Process data
});
```

**Important:**

* Use real-time listeners (onValue) for dashboard data that should auto-update
* Use get() for one-time fetches (like individual shipment lookup)
* Implement proper cleanup in useEffect hooks
* Handle loading and error states appropriately

### 6. Features to Implement

#### Dashboard Features:

* [X] Real-time data updates from Firebase
* [X] Search functionality (client-side filtering)
* [X] Filter by volume, recency, performance
* [X] Sort customers by various metrics
* [X] Click to view customer details
* [X] Responsive grid layout

#### Customer Detail Features:

* [X] Modal or slide-out panel view
* [X] Complete customer information
* [X] Performance metrics with visual indicators
* [X] Financial summary
* [X] Scrollable recent shipments list
* [X] Click shipment PRO number to view full details

#### Shipment Search Features:

* [X] Search by PRO number
* [X] Display complete shipment details
* [X] Show customer information
* [X] Display delivery timeline
* [X] Show charges breakdown

### 7. Performance Considerations

* **Pagination or Virtual Scrolling** : If customer list grows large (50+ customers), implement virtual scrolling or pagination
* **Memoization** : Use React.memo and useMemo for expensive calculations (like filtering and sorting)
* **Debounce Search** : Debounce the search input to avoid excessive filtering
* **Lazy Loading** : Consider lazy loading customer details only when clicked

### 8. Error Handling

Implement proper error handling for:

* Firebase connection issues
* Missing or malformed data
* Database permission errors
* Network timeouts

Display user-friendly error messages with retry options.

### 9. TypeScript Types

Create type definitions (likely in `/types/` or `/lib/types/`):

```typescript
// types/saia.ts

export interface SAIAShipment {
  proNumber: string;
  customerName: string;
  customerCode: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  weight: number;
  pieces: number;
  charges: number;
  netCharges: number;
  fuelSurcharge: number;
  pickupDate: string;
  deliveryDate: string;
  deliveryTime: string;
  status: string;
  onTime: boolean;
  latePickup: boolean;
  actualDays: number;
  standardDays: number;
  signature: string;
  timeArrive: string;
  timeDepart: string;
  bolNumber: string;
  poNumber: string;
  originTerminal: string;
  destTerminal: string;
  importedAt: string;
}

export interface SAIAShipmentSummary {
  proNumber: string;
  pickupDate: string;
  deliveryDate: string;
  status: string;
  weight: number;
  charges: number;
}

export interface SAIACustomer {
  id: string; // Firebase key
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalShipments: number;
  totalWeight: number;
  totalCharges: number;
  totalNetCharges: number;
  totalFuelSurcharge: number;
  deliveredShipments: number;
  onTimeShipments: number;
  lateShipments: number;
  inTransitShipments: number;
  onTimePercentage: number;
  avgWeight: number;
  avgCharges: number;
  avgNetCharges: number;
  firstShipmentDate: string;
  lastShipmentDate: string;
  lastUpdated: string;
  recentShipments: SAIAShipmentSummary[];
}
```

### 10. Testing Checklist

Before considering complete, verify:

* [ ] Dashboard loads and displays customer cards
* [ ] Summary statistics are calculated correctly
* [ ] Search filters customers properly
* [ ] Filter buttons work (High Volume, Recent, Best On-Time)
* [ ] Customer cards are clickable
* [ ] Customer detail view displays all information
* [ ] Recent shipments list is scrollable and shows correct data
* [ ] Shipment search by PRO number works
* [ ] Real-time updates work (test by manually updating Firebase)
* [ ] Loading states display during data fetch
* [ ] Error states display when Firebase is unreachable
* [ ] Mobile responsive design works properly
* [ ] Styling matches existing KanvaPortal design
* [ ] No TypeScript errors
* [ ] No console errors or warnings

## Implementation Notes

### Suggested File Structure

```
/components/shipping/saia/
├── SAIAShippingDashboard.tsx
├── SAIACustomerCard.tsx
├── SAIACustomerDetail.tsx
├── SAIAShipmentSearch.tsx
├── SAIASummaryStats.tsx
└── SAIAShipmentItem.tsx

/hooks/
├── useSAIACustomers.ts
├── useSAIAShipments.ts
└── useSAIACustomerDetail.ts

/types/
└── saia.ts

/pages/ or /app/
└── tools/
    └── shipping/
        └── [integrate SAIA components here]
```

### Integration Steps

1. Create all type definitions first
2. Create Firebase hooks
3. Build individual components (start with smaller ones)
4. Integrate into existing shipping page/tab
5. Test thoroughly
6. Add polish (animations, loading states, etc.)

### Design System Alignment

* Use existing button components
* Use existing card/modal components
* Use existing input/form components
* Follow existing spacing and typography patterns
* Match existing color palette

### Data Access Pattern Example

```typescript
// In your component or hook
const database = getDatabase();

// For dashboard
const customersRef = ref(database, 'shipping/saia/customers');
useEffect(() => {
  const unsubscribe = onValue(customersRef, (snapshot) => {
    const data = snapshot.val();
    const customersArray = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));
    setCustomers(customersArray);
  });
  
  return () => unsubscribe();
}, []);

// For single shipment
const shipmentRef = ref(database, `shipping/saia/shipments/${proNumber}`);
const snapshot = await get(shipmentRef);
const shipment = snapshot.val();
```

## Expected Result

After implementation, users should be able to:

1. Navigate to Tools → Shipping → SAIA Tracking
2. See a dashboard with all customers and summary statistics
3. Search and filter customers by various criteria
4. Click any customer to see detailed metrics and shipment history
5. Search for specific shipments by PRO number
6. See real-time updates when new data arrives from the daily automation
7. Experience a polished, responsive interface that matches the existing KanvaPortal design

## Additional Context

* The data is updated daily via Google Apps Script automation (already working)
* Data structure is fixed and won't change
* Dashboard should handle 50-200 customers comfortably
* Real-time updates are important - use Firebase listeners, not polling
* This is an internal tool for Kanva Botanicals sales team
* Users need quick access to customer shipping metrics and history
* On-time performance is a critical metric for account management

Please implement this integration following Next.js and React best practices, ensuring TypeScript safety throughout, and maintaining consistency with the existing KanvaPortal application architecture.
