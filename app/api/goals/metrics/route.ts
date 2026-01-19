import { NextRequest, NextResponse } from 'next/server';
import { metricService } from '@/lib/firebase/services/goals';
import { adminAuth } from '@/lib/firebase/admin';
import { GoalType } from '@/types/goals';

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
    const type = searchParams.get('type') as GoalType;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const metrics = await metricService.getMetrics(
      userId,
      type,
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
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
    const { type, value, date, source, metadata } = body;

    if (!type || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const metricId = await metricService.logMetric({
      userId,
      type,
      value,
      date: date ? new Date(date) : new Date(),
      source: source || 'manual',
      metadata
    });

    return NextResponse.json({ metricId, success: true });
  } catch (error) {
    console.error('Error logging metric:', error);
    return NextResponse.json({ error: 'Failed to log metric' }, { status: 500 });
  }
}
