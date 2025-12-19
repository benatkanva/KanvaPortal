import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    if (email && admins.includes(email)) return decoded;
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/fishbowl-mapping
 * Get Fishbowl salesman to Firebase user mapping
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doc = await adminDb.collection('settings').doc('fishbowl_users_map').get();
    
    if (!doc.exists) {
      return NextResponse.json({ mapping: {} });
    }

    const data = doc.data();
    return NextResponse.json({ mapping: data?.bySalesman || {} });
  } catch (error: any) {
    console.error('[Fishbowl Mapping] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get mapping' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fishbowl-mapping
 * Save Fishbowl salesman to Firebase user mapping
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { mapping } = body;

    if (!mapping || typeof mapping !== 'object') {
      return NextResponse.json(
        { error: 'Invalid mapping object' },
        { status: 400 }
      );
    }

    await adminDb.collection('settings').doc('fishbowl_users_map').set({
      bySalesman: mapping,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email,
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Mapping saved successfully',
    });
  } catch (error: any) {
    console.error('[Fishbowl Mapping] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save mapping' },
      { status: 500 }
    );
  }
}
