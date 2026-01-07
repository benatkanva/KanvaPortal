import { db } from '@/lib/firebase/config';
import { adminDb } from '@/lib/firebase/admin';
import { collection, addDoc, Timestamp as ClientTimestamp } from 'firebase/firestore';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { Notification, NotificationType, NotificationPriority } from '@/types/notification';

interface CreateNotificationParams {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  userId: string;
  userEmail: string;
  salesPerson?: string;
  relatedId?: string;
  relatedType?: string;
  relatedData?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: Date;
  groupKey?: string;
  batchId?: string;
}

/**
 * Create a notification (client-side)
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const notificationsRef = collection(db, 'notifications');
  
  const notificationData = {
    type: params.type,
    priority: params.priority,
    status: 'unread',
    title: params.title,
    message: params.message,
    userId: params.userId,
    userEmail: params.userEmail,
    salesPerson: params.salesPerson || null,
    relatedId: params.relatedId || null,
    relatedType: params.relatedType || null,
    relatedData: params.relatedData || null,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    createdAt: ClientTimestamp.now(),
    readAt: null,
    archivedAt: null,
    expiresAt: params.expiresAt ? ClientTimestamp.fromDate(params.expiresAt) : null,
    groupKey: params.groupKey || null,
    batchId: params.batchId || null,
  };

  const docRef = await addDoc(notificationsRef, notificationData);
  return docRef.id;
}

/**
 * Create a notification (server-side with admin SDK)
 */
export async function createNotificationAdmin(params: CreateNotificationParams): Promise<string> {
  const notificationsRef = adminDb.collection('notifications');
  
  const notificationData = {
    type: params.type,
    priority: params.priority,
    status: 'unread',
    title: params.title,
    message: params.message,
    userId: params.userId,
    userEmail: params.userEmail,
    salesPerson: params.salesPerson || null,
    relatedId: params.relatedId || null,
    relatedType: params.relatedType || null,
    relatedData: params.relatedData || null,
    actionUrl: params.actionUrl || null,
    actionLabel: params.actionLabel || null,
    createdAt: AdminTimestamp.now(),
    readAt: null,
    archivedAt: null,
    expiresAt: params.expiresAt ? AdminTimestamp.fromDate(params.expiresAt) : null,
    groupKey: params.groupKey || null,
    batchId: params.batchId || null,
  };

  const docRef = await notificationsRef.add(notificationData);
  return docRef.id;
}

/**
 * Create notifications for multiple users (batch)
 */
export async function createBatchNotifications(
  params: Omit<CreateNotificationParams, 'userId' | 'userEmail' | 'salesPerson'>,
  users: Array<{ userId: string; userEmail: string; salesPerson?: string }>
): Promise<string[]> {
  const batchId = `batch_${Date.now()}`;
  const notificationIds: string[] = [];

  for (const user of users) {
    const notificationId = await createNotificationAdmin({
      ...params,
      userId: user.userId,
      userEmail: user.userEmail,
      salesPerson: user.salesPerson,
      batchId,
    });
    notificationIds.push(notificationId);
  }

  return notificationIds;
}

/**
 * Helper: Create SAIA shipment notification for assigned sales rep
 */
export async function notifySAIAShipment(params: {
  proNumber: string;
  customerName: string;
  customerCity: string;
  customerState: string;
  weight: number;
  charges: number;
  salesRepEmail: string;
  salesRepUserId: string;
  salesPerson: string;
}): Promise<string> {
  return createNotificationAdmin({
    type: 'saia_shipment',
    priority: 'medium',
    title: `New LTL Shipment: ${params.customerName}`,
    message: `PRO# ${params.proNumber} - ${params.weight} lbs to ${params.customerCity}, ${params.customerState}. Charges: $${params.charges.toFixed(2)}`,
    userId: params.salesRepUserId,
    userEmail: params.salesRepEmail,
    salesPerson: params.salesPerson,
    relatedId: params.proNumber,
    relatedType: 'saia_shipment',
    relatedData: {
      proNumber: params.proNumber,
      customerName: params.customerName,
      customerCity: params.customerCity,
      customerState: params.customerState,
      weight: params.weight,
      charges: params.charges,
    },
    actionUrl: `/shipments?tab=ltl&search=${params.proNumber}`,
    actionLabel: 'View Shipment',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    groupKey: `saia_${params.customerName}`,
  });
}
