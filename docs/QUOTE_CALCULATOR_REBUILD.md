# KanvaPortal Quote Calculator - Full Rebuild

## 🎯 Project Overview

Complete native React/Next.js rebuild of the quote calculator, replacing the iframe-embedded kanva-quotes application with a modern, integrated solution.

## ✅ Completed Components

### **1. TypeScript Types** (`types/quote.ts`)
- Complete type definitions for quotes, customers, line items, calculations
- Support for Fishbowl and Copper customer sources
- Quote status tracking (draft, sent, viewed, accepted, declined, expired)
- Version control and revision tracking
- Activity logging

### **2. Customer Lookup Service** (`lib/services/customerLookupService.ts`)
- **Smart Search Algorithm:**
  - Priority: Fishbowl (active) > Copper (all)
  - Fuzzy matching by company name, email, phone, account number
  - Match scoring system (100 = exact, 90 = starts with, 80 = contains)
  - Fishbowl results scored higher than Copper
- **Search Functions:**
  - `searchCustomers()` - Multi-source search
  - `searchFishbowlCustomers()` - Active customers
  - `searchCopperCompanies()` - All customers
  - `getCustomerById()` - Direct lookup
  - `getRecentCustomers()` - User's recent quotes
- **Account Type Normalization:**
  - Handles Copper's complex field formats (arrays, objects, IDs)
  - Maps to standard: Distributor, Wholesale, Retail

### **3. Quote Service** (`lib/services/quoteService.ts`)
- **CRUD Operations:**
  - `createQuote()` - Auto-generates quote numbers (Q-2025-001)
  - `updateQuote()` - Update existing quotes
  - `getQuoteById()` - Fetch single quote
  - `getUserQuotes()` - List user's quotes with filtering
- **Status Management:**
  - `markQuoteAsSent()` - Track when sent
  - `markQuoteAsViewed()` - Track customer views
  - `acceptQuote()` / `declineQuote()` - Customer actions
- **Versioning:**
  - `reviseQuote()` - Create new version with history
- **Activity Logging:**
  - `logQuoteActivity()` - Track all quote actions
  - `getQuoteActivities()` - Audit trail
- **Search:**
  - `searchQuotes()` - Find quotes by company, number, email

### **4. API Endpoints**
- `/api/quotes/customer-search` - Customer lookup API
- `/api/quotes/create` - Quote creation with auto-numbering

### **5. React Components**
- **CustomerLookup** (`components/quotes/CustomerLookup.tsx`)
  - Real-time search with debouncing (300ms)
  - Dropdown with search results
  - Recent customers quick access
  - Status indicators (Active in Fishbowl, Active in Copper, Copper Only)
  - Match reason display
  - Click-outside-to-close
  - Selected customer display card

## 🚧 In Progress / Next Steps

### **Phase 1: Core Quote Builder (NEXT)**
1. **ProductSelector Component**
   - Load products from kanva-quotes data
   - Category filtering
   - Product cards with images
   - Quick add functionality
   - Search by name/SKU

2. **QuoteBuilder Component**
   - Line item management
   - Add/remove products
   - Quantity inputs (master cases, display boxes)
   - Real-time calculation
   - Drag & drop reordering

3. **Pricing Engine**
   - Tier calculation logic
   - Distribution vs Retail pricing
   - Shipping zone detection
   - Payment method handling
   - Credit card fee calculation

### **Phase 2: Quote Management**
4. **Quote List Page** (`app/(modules)/quotes/page.tsx`)
   - Dashboard view
   - Filter by status
   - Search functionality
   - Quick actions (View, Edit, Send, Duplicate)

5. **New Quote Page** (`app/(modules)/quotes/new/page.tsx`)
   - Full quote builder
   - Customer lookup integration
   - Product selection
   - Calculation display
   - Save as draft
   - Generate & send

6. **Quote Detail Page** (`app/(modules)/quotes/[id]/page.tsx`)
   - View quote
   - Edit mode
   - Activity timeline
   - Send to customer
   - Create revision
   - Convert to opportunity

### **Phase 3: Integrations**
7. **Copper CRM Integration**
   - Automatic opportunity creation
   - Custom fields mapping
   - Activity logging in Copper
   - Quote attachment

8. **Pipeline Integration**
   - Create lead in existing pipeline tool
   - Link quote to pipeline stage
   - Status synchronization

9. **Notification System**
   - Quote sent notifications
   - Quote viewed alerts
   - Quote accepted/declined notifications
   - Follow-up reminders

### **Phase 4: Advanced Features**
10. **PDF Generation**
    - Professional quote PDF
    - Company branding
    - Product images
    - Terms & conditions

11. **Email Templates**
    - Initial proposal
    - Follow-up
    - Negotiation
    - Closing

12. **Analytics Dashboard**
    - Conversion rates
    - Average quote value
    - Time to close
    - Product popularity

## 📊 Data Structure

### **Firestore Collections**

```
quotes/
  {quoteId}/
    - quoteNumber: "Q-2025-001"
    - status: "sent"
    - customer: { ... }
    - lineItems: [ ... ]
    - calculation: { ... }
    - createdBy: userId
    - createdAt: timestamp

quote_activities/
  {activityId}/
    - quoteId: quoteId
    - type: "created" | "sent" | "viewed" | "accepted"
    - description: "Quote sent to customer"
    - createdAt: timestamp

quote_templates/
  {templateId}/
    - name: "Standard Product Bundle"
    - lineItems: [ ... ]
    - createdBy: userId
```

### **Customer Sources**

**Fishbowl Customers** (Priority 1):
- Collection: `fishbowl_customers`
- Status: Active customers only
- Match Score: 80-100
- Fields: name, email, phone, accountNumber, salesPerson

**Copper Companies** (Priority 2):
- Collection: `copper_companies`
- Status: Active and inactive
- Match Score: 50-70
- Fields: name, email_domain, phone, Account Order ID

## 🔄 Workflow

### **Quote Creation Flow**
```
1. User clicks "New Quote"
2. Search & select customer (Fishbowl/Copper)
3. Customer data auto-populates
4. Select products from catalog
5. Add to quote (master cases, display boxes)
6. System calculates:
   - Tier pricing
   - Shipping (based on state/zone)
   - Payment method fees
   - Total
7. Review quote
8. Save as draft OR Send to customer
9. System creates:
   - Quote in Firestore
   - Copper opportunity (if enabled)
   - Pipeline lead (if enabled)
   - Notification for sales rep
```

### **Customer Lookup Flow**
```
1. User types in search box
2. System searches (debounced 300ms):
   a. Fishbowl customers (active)
   b. Copper companies (all)
3. Results sorted by match score
4. User selects customer
5. All fields auto-populate:
   - Company name
   - Contact info
   - Address
   - Sales rep
   - Account type
   - Shipping zone (from state)
```

### **Opportunity Creation Flow**
```
1. Quote marked as "sent"
2. System creates Copper opportunity:
   - Name: "Quote Q-2025-001 - Acme Corp"
   - Value: Quote total
   - Stage: "Quote Sent"
   - Custom fields: Quote ID, Quote Number
   - Attach PDF
3. System creates pipeline lead:
   - Company: Acme Corp
   - Stage: "Quote Sent"
   - Value: Quote total
   - Assigned to: Sales rep
4. Notification sent to sales rep
```

## 🎨 UI/UX Improvements

### **vs. Old iframe Approach:**

**Before:**
- Separate authentication
- No access to KanvaPortal data
- Clunky iframe scrolling
- Disconnected from notifications
- No pipeline integration
- Manual customer entry

**After:**
- Unified authentication
- Direct Firestore access
- Native responsive design
- Integrated notifications
- Automatic pipeline creation
- Smart customer lookup
- Real-time collaboration
- Mobile-friendly
- Consistent with KanvaPortal design

## 🔐 Security & Permissions

### **Firestore Rules** (To Add)
```javascript
match /quotes/{quoteId} {
  // Users can read their own quotes
  allow read: if request.auth != null && 
                 (resource.data.createdBy == request.auth.uid ||
                  resource.data.assignedTo == request.auth.uid);
  
  // Users can create quotes
  allow create: if request.auth != null &&
                   request.resource.data.createdBy == request.auth.uid;
  
  // Users can update their own quotes
  allow update: if request.auth != null &&
                   resource.data.createdBy == request.auth.uid;
}

match /quote_activities/{activityId} {
  allow read: if request.auth != null;
  allow write: if true; // Server-side writes
}
```

## 📈 Performance Optimizations

1. **Debounced Search** - 300ms delay prevents excessive API calls
2. **Result Limiting** - Max 10 search results, 50 quotes per query
3. **Client-side Filtering** - Reduces Firestore reads
4. **Recent Customers Cache** - Faster access to frequent customers
5. **Indexed Queries** - Firestore composite indexes for fast searches

## 🧪 Testing Checklist

- [ ] Customer search (Fishbowl)
- [ ] Customer search (Copper)
- [ ] Customer search (no results)
- [ ] Recent customers display
- [ ] Quote creation
- [ ] Quote number generation
- [ ] Line item calculations
- [ ] Tier pricing
- [ ] Shipping calculation
- [ ] Quote status updates
- [ ] Activity logging
- [ ] Copper opportunity creation
- [ ] Pipeline lead creation
- [ ] Notifications
- [ ] PDF generation
- [ ] Email sending

## 🚀 Deployment Plan

### **Phase 1: MVP (Week 1-2)**
- Customer lookup ✅
- Basic quote creation ✅
- Simple product selection
- Manual calculations
- Save to Firestore

### **Phase 2: Full Features (Week 3-4)**
- Automated pricing engine
- Tier calculations
- Shipping zones
- Payment methods
- Quote list/detail pages

### **Phase 3: Integrations (Week 5-6)**
- Copper opportunity creation
- Pipeline integration
- Notification system
- Activity tracking

### **Phase 4: Polish (Week 7-8)**
- PDF generation
- Email templates
- Analytics dashboard
- Mobile optimization

## 📝 Migration Notes

### **Data Migration from kanva-quotes:**
- Products: Already in Firebase (no migration needed)
- Tiers: Already in Firebase (no migration needed)
- Shipping: Already in Firebase (no migration needed)
- Old quotes: Can remain in kanva-quotes or migrate to new format

### **Backward Compatibility:**
- Old kanva-quotes app remains accessible at `/quotes/index.html`
- New app at `/quotes` (native React)
- Gradual migration of users
- Both systems can coexist during transition

## 🎯 Success Metrics

1. **Adoption Rate** - % of sales reps using new system
2. **Quote Creation Time** - Target: < 5 minutes
3. **Customer Lookup Speed** - Target: < 1 second
4. **Conversion Rate** - Quotes sent → Quotes accepted
5. **User Satisfaction** - NPS score from sales team

## 🔗 Related Documentation

- [Notification System](./NOTIFICATION_SYSTEM.md)
- [SAIA Shipping Integration](./SAIA_SHIPPING_AUTOMATION.md)
- [Copper CRM Integration](./COPPER_INTEGRATION_ADVANCED.MD)
