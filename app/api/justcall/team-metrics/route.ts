import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user is admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin' && userData?.role !== 'manager') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Create JustCall client
    const justCallClient = createJustCallClient();
    if (!justCallClient) {
      return NextResponse.json({ 
        error: 'JustCall API not configured' 
      }, { status: 500 });
    }

    // Get all active users
    const usersSnapshot = await adminDb
      .collection('users')
      .where('status', '==', 'active')
      .get();

    const teamMetrics = [];

    // Fetch metrics for each user
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const email = user.email;
      
      if (!email) continue;

      try {
        // Fetch calls for this user
        const calls = await justCallClient.getCallsByUserEmail(
          email,
          startDate,
          endDate
        );

        // Calculate metrics
        const metrics = justCallClient.calculateMetrics(calls);
        
        // Get previous period for trend calculation
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 30);
        const prevCalls = await justCallClient.getCallsByUserEmail(
          email,
          prevStartDate.toISOString().split('T')[0],
          startDate
        );
        const prevMetrics = justCallClient.calculateMetrics(prevCalls);

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (metrics.totalCalls > prevMetrics.totalCalls * 1.1) trend = 'up';
        else if (metrics.totalCalls < prevMetrics.totalCalls * 0.9) trend = 'down';

        teamMetrics.push({
          userId: userDoc.id,
          name: user.name || email.split('@')[0],
          email: email,
          calls: metrics.totalCalls,
          inbound: metrics.inboundCalls,
          outbound: metrics.outboundCalls,
          completed: metrics.completedCalls,
          missed: metrics.missedCalls,
          talkTime: metrics.totalDuration,
          avgDuration: metrics.averageDuration,
          connectionRate: metrics.totalCalls > 0 
            ? Math.round((metrics.completedCalls / metrics.totalCalls) * 100) 
            : 0,
          trend: trend,
          previousPeriodCalls: prevMetrics.totalCalls,
          change: metrics.totalCalls - prevMetrics.totalCalls,
          changePercent: prevMetrics.totalCalls > 0
            ? Math.round(((metrics.totalCalls - prevMetrics.totalCalls) / prevMetrics.totalCalls) * 100)
            : 0
        });
      } catch (error) {
        console.error(`Error fetching metrics for ${email}:`, error);
        // Continue with other users
      }
    }

    // Sort by total calls descending
    teamMetrics.sort((a, b) => b.calls - a.calls);

    // Calculate team totals
    const teamTotals = {
      totalCalls: teamMetrics.reduce((sum, m) => sum + m.calls, 0),
      totalInbound: teamMetrics.reduce((sum, m) => sum + m.inbound, 0),
      totalOutbound: teamMetrics.reduce((sum, m) => sum + m.outbound, 0),
      totalCompleted: teamMetrics.reduce((sum, m) => sum + m.completed, 0),
      totalMissed: teamMetrics.reduce((sum, m) => sum + m.missed, 0),
      totalTalkTime: teamMetrics.reduce((sum, m) => sum + m.talkTime, 0),
      avgConnectionRate: teamMetrics.length > 0
        ? Math.round(teamMetrics.reduce((sum, m) => sum + m.connectionRate, 0) / teamMetrics.length)
        : 0,
      memberCount: teamMetrics.length
    };

    return NextResponse.json({
      success: true,
      teamMetrics,
      teamTotals,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error: any) {
    console.error('Error fetching team metrics:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch team metrics',
      details: error.toString()
    }, { status: 500 });
  }
}
