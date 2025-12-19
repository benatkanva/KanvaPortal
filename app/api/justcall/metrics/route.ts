import { NextRequest, NextResponse } from 'next/server';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/justcall/metrics
 * Get call metrics for a user
 * Query params:
 *   - email: User email (required)
 *   - start_date: YYYY-MM-DD (optional)
 *   - end_date: YYYY-MM-DD (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const client = createJustCallClient();
    
    if (!client) {
      return NextResponse.json(
        { error: 'JustCall API not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const metrics = await client.getUserMetrics(
      email,
      startDate || undefined,
      endDate || undefined
    );

    return NextResponse.json({ metrics, email });
  } catch (error: any) {
    console.error('[API] /api/justcall/metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch JustCall metrics' },
      { status: 500 }
    );
  }
}
