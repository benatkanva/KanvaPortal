import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long-running sync

/**
 * Helper: Idempotent metric write
 */
async function logMetricAdmin(metric: {
  userId: string;
  type: string;
  value: number;
  date: Date;
  source?: string;
  metadata?: any;
}) {
  const src = metric.source || 'justcall';
  const d = new Date(metric.date);
  d.setHours(0, 0, 0, 0);
  const dayKey = d.toISOString().slice(0, 10);
  const docId = `${metric.userId}_${metric.type}_${dayKey}_${src}`;
  const ref = adminDb.collection('metrics').doc(docId);
  
  await ref.set(
    {
      id: docId,
      userId: metric.userId,
      type: metric.type,
      value: metric.value,
      date: Timestamp.fromDate(d),
      source: src,
      metadata: metric.metadata || {},
      createdAt: Timestamp.fromDate(new Date()),
    },
    { merge: true }
  );
  
  return docId;
}

/**
 * Sync JustCall data for a single user
 */
async function syncUserJustCallData(
  userId: string,
  userEmail: string,
  startDate: Date,
  endDate: Date,
  justCallClient: any
) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Fetch calls from JustCall
  const calls = await justCallClient.getCallsByUserEmail(
    userEmail,
    startDateStr,
    endDateStr
  );

  const results = {
    totalCalls: calls.length,
    callsProcessed: 0,
    metricsWritten: 0,
  };

  if (calls.length === 0) {
    return results;
  }

  // Bucket calls by day
  const byDay: Record<string, { count: number; seconds: number }> = {};

  for (const call of calls) {
    try {
      // Use call_user_date (user's timezone) or fall back to call_date
      const dateToUse = call.call_user_date || call.call_date;
      const dayKey = dateToUse.split(' ')[0]; // Extract YYYY-MM-DD
      
      // DEBUG: Log first few calls to see dates
      if (results.callsProcessed < 3) {
        console.log(`[Sync User] Call ${call.id}: call_date=${call.call_date}, call_user_date=${call.call_user_date}, using=${dayKey}`);
      }

      if (!byDay[dayKey]) {
        byDay[dayKey] = { count: 0, seconds: 0 };
      }

      byDay[dayKey].count += 1;
      const duration = call.call_duration?.total_duration || 0;
      byDay[dayKey].seconds += duration;
      results.callsProcessed += 1;
    } catch (error) {
      console.error('[Sync User] Error processing call:', error);
    }
  }

  // Write metrics
  for (const [dayKey, info] of Object.entries(byDay)) {
    try {
      // Create date at noon UTC to avoid timezone issues
      // This ensures the date stays consistent regardless of timezone
      const [year, month, day] = dayKey.split('-').map(Number);
      const metricDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      
      console.log(`[Sync User] Writing metric for ${dayKey}: ${metricDate.toISOString()}`);
      
      await logMetricAdmin({
        userId,
        type: 'phone_call_quantity',
        value: info.count,
        date: metricDate,
        source: 'justcall',
        metadata: { totalSeconds: info.seconds },
      });
      results.metricsWritten += 1;

      if (info.seconds > 0) {
        const minutes = Math.round(info.seconds / 60);
        await logMetricAdmin({
          userId,
          type: 'talk_time_minutes',
          value: minutes,
          date: metricDate,
          source: 'justcall',
          metadata: { callCount: info.count, totalSeconds: info.seconds },
        });
        results.metricsWritten += 1;
      }
    } catch (error) {
      console.error('[Sync User] Error writing metrics:', error);
    }
  }

  // Update goals
  try {
    const goalsSnapshot = await adminDb
      .collection('goals')
      .where('userId', '==', userId)
      .get();

    for (const goalDoc of goalsSnapshot.docs) {
      const goal = goalDoc.data();
      
      if (goal.type === 'phone_call_quantity' || goal.type === 'talk_time_minutes') {
        const metricsSnapshot = await adminDb
          .collection('metrics')
          .where('userId', '==', userId)
          .where('type', '==', goal.type)
          .where('date', '>=', goal.startDate)
          .where('date', '<=', goal.endDate)
          .get();

        let total = 0;
        metricsSnapshot.docs.forEach(doc => {
          total += Number(doc.data().value || 0);
        });

        await goalDoc.ref.update({
          current: total,
          updatedAt: Timestamp.now(),
        });
      }
    }
  } catch (error) {
    console.error('[Sync User] Error updating goals:', error);
  }

  return results;
}

/**
 * POST /api/admin/sync-all-justcall
 * Syncs JustCall data for ALL active users
 * Admin/Manager only
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize JustCall client
    const justCallClient = createJustCallClient();
    if (!justCallClient) {
      return NextResponse.json(
        { error: 'JustCall API not configured' },
        { status: 500 }
      );
    }

    // Get all users from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      email: doc.data().email || '',
      name: doc.data().name || '',
    }));

    console.log(`[Admin JustCall Sync] Found ${users.length} users in Firestore`);

    // Get all JustCall users to match
    const justCallUsers = await justCallClient.getUsers();
    console.log(`[Admin JustCall Sync] Found ${justCallUsers.length} users in JustCall`);

    // Match Firestore users with JustCall users by email
    const matchedUsers = users.filter(user => {
      const email = user.email.toLowerCase().trim();
      return justCallUsers.some(jcUser => 
        jcUser.email.toLowerCase().trim() === email
      );
    });

    console.log(`[Admin JustCall Sync] Matched ${matchedUsers.length} users`);

    if (matchedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to sync',
        totalUsers: users.length,
        matchedUsers: 0,
        syncedUsers: 0,
        results: [],
      });
    }

    // Sync each user (30 days)
    const results: any[] = [];
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const user of matchedUsers) {
      try {
        console.log(`[Admin JustCall Sync] Syncing ${user.email}...`);

        // Call the sync function directly
        const syncData = await syncUserJustCallData(
          user.id,
          user.email,
          start,
          end,
          justCallClient
        );

        results.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          success: true,
          ...syncData,
        });

        console.log(`[Admin JustCall Sync] ${user.email}: ${syncData.totalCalls || 0} calls, ${syncData.metricsWritten || 0} metrics`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[Admin JustCall Sync] Error syncing ${user.email}:`, error);
        results.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          success: false,
          error: error.message || 'Sync failed',
        });
      }
    }

    // Calculate summary
    const successCount = results.filter(r => r.success).length;
    const totalCalls = results.reduce((sum, r) => sum + (r.totalCalls || 0), 0);
    const totalMetrics = results.reduce((sum, r) => sum + (r.metricsWritten || 0), 0);

    console.log(`[Admin JustCall Sync] Complete: ${successCount}/${matchedUsers.length} users synced, ${totalCalls} calls, ${totalMetrics} metrics`);

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount} of ${matchedUsers.length} users`,
      totalUsers: users.length,
      matchedUsers: matchedUsers.length,
      syncedUsers: successCount,
      totalCalls,
      totalMetrics,
      results,
    });
  } catch (error: any) {
    console.error('[Admin JustCall Sync] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to sync all users',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
