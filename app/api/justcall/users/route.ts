import { NextRequest, NextResponse } from 'next/server';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/justcall/users
 * Fetch all JustCall users/agents
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

    const users = await client.getUsers();
    
    // Return in the format expected by the frontend
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('[API] /api/justcall/users error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch JustCall users' },
      { status: 500 }
    );
  }
}
