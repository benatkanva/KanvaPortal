import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { GoalPeriod, GoalType, User } from '@/types';
import { isSalesUser } from '@/lib/utils/userFilters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  photoUrl?: string;
  totalSales: number;
  phoneCalls: number;
  emails: number;
  leadProgression: number;
  overallScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Calculate date range for period
 */
function getDateRangeForPeriod(period: GoalPeriod): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'weekly':
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
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
      console.log(`[Leaderboard] Quarterly range: ${start.toISOString()} to ${end.toISOString()}`);
      break;
  }

  return { start, end };
}

/**
 * Calculate overall score based on weighted metrics
 */
function calculateOverallScore(
  sales: number,
  calls: number,
  emails: number,
  leads: number,
  targets: { sales: number; calls: number; emails: number; leads: number }
): number {
  const salesScore = targets.sales > 0 ? Math.min((sales / targets.sales) * 100, 100) : 0;
  const callsScore = targets.calls > 0 ? Math.min((calls / targets.calls) * 100, 100) : 0;
  const emailsScore = targets.emails > 0 ? Math.min((emails / targets.emails) * 100, 100) : 0;
  const leadsScore = targets.leads > 0 ? Math.min((leads / targets.leads) * 100, 100) : 0;

  // Weighted average: Sales 40%, Calls 20%, Emails 20%, Leads 20%
  return (
    salesScore * 0.4 +
    callsScore * 0.2 +
    emailsScore * 0.2 +
    leadsScore * 0.2
  );
}

/**
 * GET /api/public/team-leaderboard?period=daily
 * Returns ranked list of all team members with their performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'weekly') as GoalPeriod;

    // Get date range for period
    const { start, end } = getDateRangeForPeriod(period);

    // Fetch all users and filter to sales users only (exclude executives)
    const usersSnapshot = await adminDb.collection('users').get();
    const allUsers = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        email: data.email || '',
        photoUrl: data.photoUrl || undefined,
        title: data.title || undefined,
        role: data.role || 'sales',
      } as User & { id: string };
    });
    
    // Filter to only include sales users (exclude executives, directors, VPs)
    const users = allUsers.filter(isSalesUser);

    if (users.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        period,
        lastUpdated: new Date().toISOString(),
      });
    }

    // DEBUG: Log all metrics for first user to see dates
    if (period === 'weekly' && users.length > 0) {
      const firstUser = users[0];
      const allMetricsSnap = await adminDb
        .collection('metrics')
        .where('userId', '==', firstUser.id)
        .orderBy('date', 'desc')
        .limit(10)
        .get();
      
      console.log(`[DEBUG] Recent 10 metrics for ${firstUser.email}:`);
      allMetricsSnap.docs.forEach(doc => {
        const m = doc.data();
        console.log(`  - ${m.type}: ${m.value}, date: ${m.date?.toDate?.()?.toISOString() || m.date}, source: ${m.source}`);
      });
    }

    // Fetch team goals for the period to get targets
    const teamGoalsSnapshot = await adminDb.collection('team_goals').doc(period).get();
    const teamGoalsData = teamGoalsSnapshot.exists ? teamGoalsSnapshot.data() : {};
    
    // Default targets if not set
    const defaultTargets = {
      sales: 5000,
      calls: 50,
      emails: 100,
      leads: 10,
    };

    // Build leaderboard
    const leaderboard: TeamMember[] = [];

    for (const user of users) {
      try {
        // Fetch metrics for this user in the date range
        const metricsSnapshot = await adminDb
          .collection('metrics')
          .where('userId', '==', user.id)
          .where('date', '>=', start)
          .where('date', '<=', end)
          .get();

        console.log(`[Leaderboard] ${user.email}: Found ${metricsSnapshot.docs.length} metrics for ${period}`);
        
        // Log first few metric dates for debugging
        if (metricsSnapshot.docs.length > 0) {
          metricsSnapshot.docs.slice(0, 5).forEach(doc => {
            const m = doc.data();
            const metricDate = m.date?.toDate?.() || m.date;
            console.log(`  - ${m.type}: ${m.value}, date: ${metricDate instanceof Date ? metricDate.toISOString() : metricDate}`);
          });
        }

        // Aggregate metrics
        let totalSales = 0;
        let phoneCalls = 0;
        let emails = 0;
        let leadProgression = 0;

        metricsSnapshot.docs.forEach(doc => {
          const metric = doc.data();
          const value = Number(metric.value || 0);

          switch (metric.type) {
            case 'new_sales_wholesale':
            case 'new_sales_distribution':
              totalSales += value;
              break;
            case 'phone_call_quantity':
              phoneCalls += value;
              break;
            case 'email_quantity':
              emails += value;
              break;
            case 'lead_progression_a':
            case 'lead_progression_b':
            case 'lead_progression_c':
              leadProgression += value;
              break;
          }
        });

        // Get user-specific targets or use defaults
        const userTargets = teamGoalsData?.[user.id] || defaultTargets;
        const targets = {
          sales: Number(userTargets.sales || defaultTargets.sales),
          calls: Number(userTargets.calls || defaultTargets.calls),
          emails: Number(userTargets.emails || defaultTargets.emails),
          leads: Number(userTargets.leads || defaultTargets.leads),
        };

        // Calculate overall score
        const overallScore = calculateOverallScore(
          totalSales,
          phoneCalls,
          emails,
          leadProgression,
          targets
        );

        leaderboard.push({
          userId: user.id,
          userName: user.name || user.email?.split('@')[0] || 'Unknown',
          userEmail: user.email || '',
          photoUrl: user.photoUrl,
          totalSales,
          phoneCalls,
          emails,
          leadProgression,
          overallScore,
          rank: 0, // Will be set after sorting
          trend: 'stable', // TODO: Calculate trend based on previous period
        });
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        // Continue with other users
      }
    }

    // Sort by overall score (descending)
    leaderboard.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks
    leaderboard.forEach((member, index) => {
      member.rank = index + 1;
    });

    return NextResponse.json({
      leaderboard,
      period,
      lastUpdated: new Date().toISOString(),
      totalMembers: leaderboard.length,
    });
  } catch (error: any) {
    console.error('[Team Leaderboard] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch team leaderboard',
        leaderboard: [],
      },
      { status: 500 }
    );
  }
}
