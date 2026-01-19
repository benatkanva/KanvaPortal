import { NextRequest, NextResponse } from 'next/server';
import { goalService, settingsService } from '@/lib/firebase/services/goals';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | 'quarterly' | null;

    const teamGoals = await settingsService.getTeamGoals();
    const allGoals = await goalService.getAllGoals(period || undefined);

    return NextResponse.json({ teamGoals, allGoals });
  } catch (error) {
    console.error('Error fetching team goals:', error);
    return NextResponse.json({ error: 'Failed to fetch team goals' }, { status: 500 });
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
    
    // Check if user is admin
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};
    if (customClaims.role !== 'admin' && customClaims.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    await settingsService.updateTeamGoals(body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating team goals:', error);
    return NextResponse.json({ error: 'Failed to update team goals' }, { status: 500 });
  }
}
