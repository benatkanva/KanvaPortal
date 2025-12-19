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
 * POST /api/admin/goals
 * Create or update a goal for a user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, period, target } = body;

    if (!userId || !type || !period || target === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, period, target' },
        { status: 400 }
      );
    }

    // Validate types
    const validTypes: GoalType[] = [
      'phone_call_quantity',
      'talk_time_minutes',
      'email_quantity',
      'lead_progression_a',
      'lead_progression_b',
      'lead_progression_c',
      'new_sales_wholesale',
      'new_sales_distribution',
    ];

    const validPeriods: GoalPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly'];

    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid goal type' }, { status: 400 });
    }

    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    // Get date range for period
    const { start, end } = getDateRangeForPeriod(period);

    // Create deterministic goal ID
    const goalId = `${userId}_${type}_${period}`;

    // Check if goal exists
    const goalRef = adminDb.collection('goals').doc(goalId);
    const goalSnap = await goalRef.get();

    if (goalSnap.exists) {
      // Update existing goal
      await goalRef.update({
        target: Number(target),
        updatedAt: Timestamp.now(),
      });
    } else {
      // Create new goal
      await goalRef.set({
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

    return NextResponse.json({
      success: true,
      goalId,
      message: 'Goal saved successfully',
    });
  } catch (error: any) {
    console.error('[Admin Goals] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to save goal',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/goals?userId=xxx&period=daily
 * Get all goals for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') as GoalPeriod | null;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    let query = adminDb.collection('goals').where('userId', '==', userId);

    if (period) {
      query = query.where('period', '==', period);
    }

    const snapshot = await query.get();
    const goals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ goals });
  } catch (error: any) {
    console.error('[Admin Goals] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch goals',
      },
      { status: 500 }
    );
  }
}
