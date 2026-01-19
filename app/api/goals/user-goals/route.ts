import { NextRequest, NextResponse } from 'next/server';
import { goalService } from '@/lib/firebase/services/goals';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | 'quarterly' | null;

    const goals = await goalService.getUserGoals(userId, period || undefined);

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Error fetching user goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { type, period, target, startDate, endDate } = body;

    if (!type || !period || target === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const goalId = await goalService.upsertGoal({
      userId,
      type,
      period,
      target,
      current: 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    return NextResponse.json({ goalId, success: true });
  } catch (error) {
    console.error('Error creating/updating goal:', error);
    return NextResponse.json({ error: 'Failed to save goal' }, { status: 500 });
  }
}
