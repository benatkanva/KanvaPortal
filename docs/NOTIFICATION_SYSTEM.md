# KanvaPortal Notification System

## Overview

The KanvaPortal notification system is a modular, real-time alert system that notifies sales reps and users about important events across the platform. The system features a bell icon in the main header that displays unread notification counts and provides a dropdown panel for managing notifications.

## Architecture

### Components

1. **NotificationBell** (`components/notifications/NotificationBell.tsx`)
   - Bell icon with unread badge in header
   - Dropdown panel with notifications list
   - Filter tabs by notification type
   - Mark as read/archive actions
   - Click-to-navigate functionality

2. **useNotifications Hook** (`hooks/useNotifications.ts`)
   - Real-time Firestore listener
   - Notification state management
   - Summary calculations (unread count, by type, by priority)
   - Actions: markAsRead, markAllAsRead, archiveNotification, archiveAll

3. **Notification Service** (`lib/services/notificationService.ts`)
   - Client and server-side notification creation
   - Batch notification support
   - Helper functions for specific notification types

4. **API Endpoints**
   - `/api/notifications/saia-shipment` - Create SAIA shipment notifications

### Data Structure

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  
  // User targeting
  userId: string;
  userEmail: string;
  salesPerson?: string;
  
  // Related data
  relatedId?: string;
  relatedType?: string;
  relatedData?: Record<string, any>;
  
  // Actions
  actionUrl?: string;
  actionLabel?: string;
  
  // Metadata
  createdAt: Date;
  readAt?: Date;
  archivedAt?: Date;
  expiresAt?: Date;
  
  // Grouping
  groupKey?: string;
  batchId?: string;
}
```

## Notification Types

### Current Types

1. **saia_shipment** - New LTL shipments
   - Triggered when new SAIA shipment data syncs
   - Notifies assigned sales rep
   - Links to shipment detail view

2. **order_update** - Order status changes
3. **customer_update** - Customer data changes
4. **commission_alert** - Commission-related alerts
5. **goal_milestone** - Goal achievement notifications
6. **system_alert** - System-wide announcements

### Priority Levels

- **low** - Informational, no urgency
- **medium** - Standard notifications (default for SAIA shipments)
- **high** - Important, requires attention
- **urgent** - Critical, immediate action needed

## Usage

### Displaying Notifications

The `NotificationBell` component is automatically included in the `AppShell` header for all authenticated users:

```tsx
import NotificationBell from '@/components/notifications/NotificationBell';

// In AppShell header
<NotificationBell />
```

### Creating Notifications

#### Server-Side (Recommended)

```typescript
import { notifySAIAShipment } from '@/lib/services/notificationService';

await notifySAIAShipment({
  proNumber: '77121295830',
  customerName: 'Acme Corp',
  customerCity: 'Portland',
  customerState: 'OR',
  weight: 2400,
  charges: 1064.56,
  salesRepEmail: 'rep@kanvabotanicals.com',
  salesRepUserId: 'user123',
  salesPerson: 'BenW',
});
```

#### Client-Side

```typescript
import { createNotification } from '@/lib/services/notificationService';

await createNotification({
  type: 'order_update',
  priority: 'medium',
  title: 'Order Shipped',
  message: 'Order #12345 has been shipped',
  userId: user.uid,
  userEmail: user.email,
  actionUrl: '/orders/12345',
  actionLabel: 'View Order',
});
```

#### Batch Notifications

```typescript
import { createBatchNotifications } from '@/lib/services/notificationService';

await createBatchNotifications(
  {
    type: 'system_alert',
    priority: 'high',
    title: 'System Maintenance',
    message: 'Scheduled maintenance tonight at 10 PM',
  },
  [
    { userId: 'user1', userEmail: 'user1@example.com' },
    { userId: 'user2', userEmail: 'user2@example.com' },
  ]
);
```

## SAIA Shipment Integration

### Automatic Notification Trigger

When new SAIA shipment data is synced to Firebase Realtime Database, the system can automatically create notifications:

```typescript
// POST /api/notifications/saia-shipment
{
  "proNumber": "77121295830",
  "customerName": "Acme Corp",
  "salesPerson": "BenW"
}
```

The endpoint will:
1. Fetch shipment data from Firebase Realtime Database
2. Find the assigned sales rep by salesPerson field
3. Create a notification for the sales rep
4. Include shipment details and link to view

### Batch Processing

For bulk shipment imports:

```typescript
// PUT /api/notifications/saia-shipment
{
  "shipments": [
    { "proNumber": "77121295830", "customerName": "Acme Corp", "salesPerson": "BenW" },
    { "proNumber": "77121295831", "customerName": "Beta Inc", "salesPerson": "JohnD" }
  ]
}
```

## Firestore Security Rules

```javascript
match /notifications/{notificationId} {
  // Users can only read their own notifications
  allow read: if request.auth != null && 
                 (resource.data.userEmail == request.auth.token.email || 
                  resource.data.userId == request.auth.uid);
  
  // Server can write (admin SDK)
  allow write: if true;
  
  // Users can update their own notifications (mark as read, archive)
  allow update: if request.auth != null && 
                   (resource.data.userEmail == request.auth.token.email || 
                    resource.data.userId == request.auth.uid);
}
```

## Future Enhancements

### Planned Notification Types

1. **Commission Alerts**
   - Monthly commission calculations ready
   - Commission adjustments
   - Payment processed notifications

2. **Goal Milestones**
   - Goal achievement notifications
   - Progress updates (50%, 75%, 90%)
   - Team goal completions

3. **Customer Updates**
   - New customer assignments
   - Customer status changes
   - Important customer notes

4. **Order Updates**
   - Order status changes
   - Shipping updates
   - Delivery confirmations

### Planned Features

1. **Email Notifications**
   - Optional email delivery for high-priority notifications
   - Digest emails (daily/weekly summaries)
   - User preferences for email frequency

2. **Push Notifications**
   - Browser push notifications
   - Mobile app notifications (future)

3. **Notification Preferences**
   - Per-type notification settings
   - Quiet hours configuration
   - Notification frequency controls

4. **Advanced Filtering**
   - Filter by date range
   - Search notifications
   - Custom filters by sales rep/customer

5. **Notification Templates**
   - Customizable notification templates
   - Dynamic content insertion
   - Multi-language support

## Testing

### Manual Testing

1. Create a test notification:
```bash
curl -X POST http://localhost:3000/api/notifications/saia-shipment \
  -H "Content-Type: application/json" \
  -d '{
    "proNumber": "TEST123",
    "customerName": "Test Customer",
    "salesPerson": "YourSalesPerson"
  }'
```

2. Check the bell icon in the header for the notification
3. Click to open the panel and verify display
4. Test mark as read and archive actions

### Integration Testing

Test the notification system with real SAIA data sync:

1. Import SAIA shipment data via Google Apps Script
2. Verify notifications are created for assigned sales reps
3. Check notification content and links
4. Verify real-time updates in the UI

## Troubleshooting

### Notifications Not Appearing

1. **Check Firestore rules** - Ensure user has read access
2. **Verify user email** - Notification must match authenticated user's email
3. **Check browser console** - Look for Firebase errors
4. **Verify notification creation** - Check Firestore console for notification documents

### Sales Rep Not Found

1. **Check users collection** - Ensure user has `salesPerson` field
2. **Verify salesPerson value** - Must match exactly (case-sensitive)
3. **Check customer assignment** - Fallback to customer's assigned sales rep

### Real-time Updates Not Working

1. **Check Firebase connection** - Verify Firestore listener is active
2. **Browser console errors** - Look for subscription errors
3. **Firestore indexes** - Ensure composite indexes are created

## Performance Considerations

- Notifications are limited to 50 most recent per user
- Expired notifications are automatically filtered
- Archived notifications are excluded from main query
- Real-time listener uses efficient Firestore queries
- Batch operations for bulk notification creation

## Security

- User-specific read access enforced by Firestore rules
- Server-side writes use admin SDK for validation
- No sensitive data in notification messages
- Action URLs validated before navigation
- XSS protection via React's built-in escaping
