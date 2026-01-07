# SAIA Shipping Automation System

## Overview

Automated system to process daily SAIA LTL shipping reports from Gmail and track shipping metrics in KanvaPortal with customer linking.

## System Architecture

### 1. Data Flow
```
Gmail (ben@kanvabotanicals.com)
  ↓ Daily SAIA CSV Email
Gmail API Webhook
  ↓ Automatic Detection
CSV Parser & Import
  ↓ Customer Matching
Firestore (saia_shipments)
  ↓ Real-time Sync
Shipping Dashboard
```

### 2. Components

#### API Endpoints

**`/api/saia/import-shipping` (POST)**
- Imports SAIA CSV files to Firestore
- Automatically matches consignees to customers
- Returns import statistics

**`/api/saia/import-shipping` (GET)**
- Query shipments by PRO number, customer ID, date range
- Supports filtering and pagination

**`/api/gmail/saia-webhook` (POST)**
- Receives Gmail push notifications
- Detects SAIA CSV attachments
- Triggers automatic import

#### Frontend Component

**`ShippingDashboard.tsx`**
- Real-time shipping metrics dashboard
- Customer-specific shipment tracking
- On-time delivery analytics
- Detailed shipment views

### 3. Firestore Collections

**`saia_shipments`**
- Document ID: PRO Number
- Fields: All SAIA CSV columns + customer matching
- Indexed by: customerId, pickupDate, deliveryDate

**`saia_import_logs`**
- Tracks all imports (manual and automated)
- Import statistics and error tracking

## Setup Instructions

### Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project (kanvaportal)
3. Enable Gmail API
4. Create Service Account credentials
5. Download JSON key file

### Step 2: Configure Environment Variables

Add to `.env.local`:

```env
# Gmail API Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@kanvaportal.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App URL for webhook callbacks
NEXT_PUBLIC_APP_URL=https://kanva-quotes--kanvaportal.us-central1.hosted.app
```

### Step 3: Set Up Gmail Push Notifications

Run this script to configure Gmail webhook:

```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project kanvaportal

# Create Pub/Sub topic
gcloud pubsub topics create saia-shipping-reports

# Grant Gmail publish permissions
gcloud pubsub topics add-iam-policy-binding saia-shipping-reports \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher

# Create subscription
gcloud pubsub subscriptions create saia-webhook-sub \
  --topic=saia-shipping-reports \
  --push-endpoint=https://kanva-quotes--kanvaportal.us-central1.hosted.app/api/gmail/saia-webhook
```

### Step 4: Configure Gmail Watch

Use Gmail API to watch for new emails:

```javascript
// Run this once to set up the watch
const { google } = require('googleapis');

const gmail = google.gmail({
  version: 'v1',
  auth: // your auth client
});

await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/kanvaportal/topics/saia-shipping-reports',
    labelIds: ['INBOX'],
    labelFilterAction: 'include'
  }
});
```

### Step 5: Create Firestore Indexes

Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "saia_shipments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "pickupDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "saia_shipments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pickupDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

### Step 6: Manual Import (First Time)

Upload your existing SAIA CSV file:

```bash
curl -X POST https://kanva-quotes--kanvaportal.us-central1.hosted.app/api/saia/import-shipping \
  -F "file=@SAIARPT_01_07_25.CSV" \
  -F "importedBy=ben@kanvabotanicals.com"
```

Or use the admin UI (to be created).

## Usage

### Automated Daily Import

Once configured, the system automatically:
1. Receives Gmail notification when SAIA email arrives
2. Detects CSV attachment (SAIARPT_*.CSV)
3. Downloads and parses CSV
4. Matches consignees to existing customers
5. Imports to Firestore
6. Logs import results

### View Shipping Dashboard

```typescript
// In any page component
import ShippingDashboard from '@/components/ShippingDashboard';

// All shipments
<ShippingDashboard />

// Customer-specific shipments
<ShippingDashboard customerId="customer_123" />
```

### Query Shipments via API

```bash
# Get all recent shipments
GET /api/saia/import-shipping?limit=100

# Get specific PRO number
GET /api/saia/import-shipping?proNumber=77119539740

# Get customer shipments
GET /api/saia/import-shipping?customerId=customer_123

# Date range query
GET /api/saia/import-shipping?startDate=12/01/25&endDate=12/31/25
```

## Customer Matching Logic

The system automatically matches SAIA consignees to KanvaPortal customers:

1. **Exact Name Match**: Tries exact match on customer name
2. **Partial Name + City**: Matches partial name within same city
3. **Fallback**: Stores shipment without customer link (can be manually linked later)

Matching fields:
- `consigneeName` → `customers.name`
- `consigneeCity` → `customers.city`

## Shipping Metrics

The dashboard calculates:

- **Total Shipments**: Count of all shipments
- **On-Time %**: Percentage where `onTime === 'Y'`
- **Late Deliveries**: Count where `onTime === 'N'`
- **Total Weight**: Sum of all shipment weights
- **Total Charges**: Sum of all shipping charges
- **Average Days**: Mean of `actualDays` across shipments

## SAIA CSV Format

Expected columns (from SAIA daily report):
- PRO# (Primary Key)
- BOL#, SHIP#, PO#
- ONTIME, LATEPICKUP, APPT
- PIECES, WEIGHT, CHARGES$
- PDATE, DELDATE, DELTIME
- SNAME, SADDR, SCITY, SSTATE, SZIP (Shipper)
- CNAME, CADDR, CCITY, CSTATE, CZIP (Consignee)
- CURRENTSTATUS, SIGNATURE
- ACTUALDAYS, STANDARDDAYS
- FUELSURCHARGE

## Troubleshooting

### Gmail Webhook Not Triggering

1. Check Pub/Sub topic exists:
```bash
gcloud pubsub topics list
```

2. Verify subscription is active:
```bash
gcloud pubsub subscriptions list
```

3. Check Gmail watch is active:
```javascript
const watchInfo = await gmail.users.getProfile({ userId: 'me' });
console.log(watchInfo);
```

4. Renew watch (expires after 7 days):
```javascript
await gmail.users.watch({ /* same config */ });
```

### Customer Matching Issues

Check import logs:
```javascript
const logs = await db.collection('saia_import_logs')
  .orderBy('importedAt', 'desc')
  .limit(10)
  .get();
```

Manually link shipments:
```javascript
await db.collection('saia_shipments').doc(proNumber).update({
  customerId: 'customer_123',
  customerName: 'Customer Name'
});
```

### Performance Optimization

For large imports (1000+ shipments):
- Batch writes are used (500 per batch)
- Customer matching is cached
- Indexes ensure fast queries

## Future Enhancements

1. **Email Notifications**: Alert when shipments are late
2. **Predictive Analytics**: Forecast delivery times
3. **Cost Analysis**: Compare actual vs estimated charges
4. **Carrier Performance**: Track SAIA performance metrics
5. **Integration**: Link to Fishbowl orders via PO numbers
6. **Manual Upload UI**: Admin interface for CSV uploads
7. **Customer Portal**: Let customers track their shipments

## Security

- Gmail API uses service account authentication
- Webhook endpoint validates Pub/Sub messages
- Firestore security rules restrict access
- Environment variables stored securely in Firebase

## Monitoring

Check system health:
- Import logs in `saia_import_logs` collection
- Firebase Functions logs for webhook execution
- Firestore usage metrics
- Gmail API quota usage

## Support

For issues or questions:
- Check logs: `firebase functions:log`
- Review import logs in Firestore
- Contact: ben@kanvabotanicals.com
