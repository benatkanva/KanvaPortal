import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

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
    const adminEmails = getAdminEmails();
    const userEmail = decoded.email?.toLowerCase() || '';
    
    if (!adminEmails.includes(userEmail)) {
      console.log('[Admin Settings] User not in admin list:', userEmail);
      return null;
    }
    
    return decoded;
  } catch (e) {
    console.error('[Admin Settings] Token verification failed:', e);
    return null;
  }
}

/**
 * GET /api/admin/settings
 * Get business settings (timezone, work hours)
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settingsDoc = await adminDb.collection('settings').doc('business').get();
    
    if (!settingsDoc.exists) {
      // Return defaults
      return NextResponse.json({
        settings: {
          timezone: 'America/Denver',
          workStartHour: 8,
          workEndHour: 17,
          workDays: [1, 2, 3, 4, 5], // Monday-Friday
        }
      });
    }

    return NextResponse.json({
      settings: settingsDoc.data()
    });
  } catch (error: any) {
    console.error('[Admin Settings] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings
 * Save business settings
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { settings } = await req.json();

    if (!settings) {
      return NextResponse.json({ error: 'Settings required' }, { status: 400 });
    }

    // Validate settings
    if (typeof settings.workStartHour !== 'number' || 
        typeof settings.workEndHour !== 'number' ||
        !Array.isArray(settings.workDays) ||
        !settings.timezone) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    // Save to Firestore
    await adminDb.collection('settings').doc('business').set({
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Settings] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}
