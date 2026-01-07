export type NotificationType = 
  | 'saia_shipment'
  | 'order_update'
  | 'customer_update'
  | 'commission_alert'
  | 'goal_milestone'
  | 'system_alert';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface Notification {
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
  relatedId?: string; // e.g., PRO number, order ID, customer ID
  relatedType?: string; // e.g., 'shipment', 'order', 'customer'
  relatedData?: Record<string, any>; // Additional context data
  
  // Actions
  actionUrl?: string; // Where to navigate when clicked
  actionLabel?: string; // Button text
  
  // Metadata
  createdAt: Date;
  readAt?: Date;
  archivedAt?: Date;
  expiresAt?: Date; // Optional expiration for time-sensitive notifications
  
  // Grouping
  groupKey?: string; // For grouping similar notifications
  batchId?: string; // For batch notifications
}

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface NotificationPreferences {
  userId: string;
  enabledTypes: NotificationType[];
  emailNotifications: boolean;
  pushNotifications: boolean;
  quietHoursStart?: string; // e.g., "22:00"
  quietHoursEnd?: string; // e.g., "08:00"
  updatedAt: Date;
}
