import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { GoalType, GoalPeriod } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Calculate date range for goal period
 */
function getDateRangeForPeriod(period: GoalPeriod): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(quarterStartMonth + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * POST /api/admin/goals/bulk
 * Apply goals to a user (all goal types for a period)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, period, goals } = body;

    if (!userId || !period || !goals) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, period, goals' },
        { status: 400 }
      );
    }

    // Get date range for period
    const { start, end } = getDateRangeForPeriod(period);

    const batch = adminDb.batch();
    let count = 0;

    // Create/update goals for each type
    for (const [type, target] of Object.entries(goals)) {
      if (typeof target === 'number' && target > 0) {
        const goalId = `${userId}_${type}_${period}`;
        const goalRef = adminDb.collection('goals').doc(goalId);
        
        const goalSnap = await goalRef.get();
        
        if (goalSnap.exists) {
          batch.update(goalRef, {
            target: Number(target),
            updatedAt: Timestamp.now(),
          });
        } else {
          batch.set(goalRef, {
            id: goalId,
            userId,
            type,
            period,
            target: Number(target),
            current: 0,
            startDate: Timestamp.fromDate(start),
            endDate: Timestamp.fromDate(end),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
        
        count++;
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `${count} goals saved successfully`,
      count,
    });
  } catch (error: any) {
    console.error('[Admin Goals Bulk] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to save goals',
      },
      { status: 500 }
    );
  }
}
