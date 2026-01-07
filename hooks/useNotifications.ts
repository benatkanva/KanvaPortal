'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Notification, NotificationSummary, NotificationStatus, NotificationType } from '@/types/notification';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    total: 0,
    unread: 0,
    byType: {} as Record<NotificationType, number>,
    byPriority: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userEmail', '==', user.email),
      where('status', 'in', ['unread', 'read']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: Notification[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          notifs.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            readAt: data.readAt?.toDate(),
            archivedAt: data.archivedAt?.toDate(),
            expiresAt: data.expiresAt?.toDate(),
          } as Notification);
        });

        setNotifications(notifs);
        
        // Calculate summary
        const newSummary: NotificationSummary = {
          total: notifs.length,
          unread: notifs.filter(n => n.status === 'unread').length,
          byType: {} as Record<NotificationType, number>,
          byPriority: {} as Record<string, number>,
        };

        notifs.forEach(n => {
          newSummary.byType[n.type] = (newSummary.byType[n.type] || 0) + 1;
          newSummary.byPriority[n.priority] = (newSummary.byPriority[n.priority] || 0) + 1;
        });

        setSummary(newSummary);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching notifications:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.email]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        status: 'read',
        readAt: Timestamp.now(),
      });
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifs = notifications.filter(n => n.status === 'unread');
      if (unreadNotifs.length === 0) return;

      const batch = writeBatch(db);
      const now = Timestamp.now();

      unreadNotifs.forEach(notif => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, {
          status: 'read',
          readAt: now,
        });
      });

      await batch.commit();
    } catch (err: any) {
      console.error('Error marking all as read:', err);
      throw err;
    }
  }, [notifications]);

  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        status: 'archived',
        archivedAt: Timestamp.now(),
      });
    } catch (err: any) {
      console.error('Error archiving notification:', err);
      throw err;
    }
  }, []);

  const archiveAll = useCallback(async () => {
    try {
      if (notifications.length === 0) return;

      const batch = writeBatch(db);
      const now = Timestamp.now();

      notifications.forEach(notif => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, {
          status: 'archived',
          archivedAt: now,
        });
      });

      await batch.commit();
    } catch (err: any) {
      console.error('Error archiving all notifications:', err);
      throw err;
    }
  }, [notifications]);

  return {
    notifications,
    summary,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    archiveAll,
  };
}
