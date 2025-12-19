import { NextRequest, NextResponse } from 'next/server';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/justcall/calls
 * Fetch call records from JustCall
 * Query params:
 *   - email: Filter by agent email
 *   - start_date: YYYY-MM-DD
 *   - end_date: YYYY-MM-DD
 *   - direction: Incoming | Outgoing
 *   - type: Call type (Answered, Missed, etc.)
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
    const direction = searchParams.get('direction') as 'Incoming' | 'Outgoing' | undefined;
    const type = searchParams.get('type');

    let calls;

    if (email) {
      // Fetch calls for specific user
      calls = await client.getCallsByUserEmail(email, startDate || undefined, endDate || undefined);
      
      // Apply additional filters if needed
      if (direction) {
        calls = calls.filter(call => call.call_info.direction === direction);
      }
      if (type) {
        calls = calls.filter(call => call.call_info.type === type);
      }
    } else {
      // Fetch all calls with filters
      calls = await client.getCalls({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        direction,
        type: type || undefined,
        limit: 1000,
      });
    }

    return NextResponse.json({ calls });
  } catch (error: any) {
    console.error('[API] /api/justcall/calls error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch JustCall calls' },
      { status: 500 }
    );
  }
}
