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
 * POST /api/admin/migrate-copper-ids
 * Migrates Copper user IDs from settings/copper_users_map to individual user docs
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Read copper_users_map from settings
    const mapDoc = await adminDb.collection('settings').doc('copper_users_map').get();
    if (!mapDoc.exists) {
      return NextResponse.json({ error: 'copper_users_map not found in settings' }, { status: 404 });
    }

    const mapData = mapDoc.data();
    const byEmail = mapData?.byEmail || {};

    console.log('[Migrate Copper IDs] Found', Object.keys(byEmail).length, 'email mappings');

    // 2. Get all users
    const usersSnapshot = await adminDb.collection('users').get();
    
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const details: any[] = [];

    // 3. Update each user with their Copper ID
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userEmail = (userData.email || '').toLowerCase();
      const copperId = byEmail[userEmail];

      if (!copperId) {
        notFound++;
        details.push({
          userId: userDoc.id,
          email: userEmail,
          status: 'not_found_in_map',
        });
        continue;
      }

      // Check if already has copperUserId
      if (userData.copperUserId === copperId) {
        skipped++;
        details.push({
          userId: userDoc.id,
          email: userEmail,
          copperUserId: copperId,
          status: 'already_set',
        });
        continue;
      }

      // Update user doc
      await adminDb.collection('users').doc(userDoc.id).update({
        copperUserId: copperId,
        copperUserEmail: userEmail, // Store normalized email
        updatedAt: new Date(),
      });

      updated++;
      details.push({
        userId: userDoc.id,
        email: userEmail,
        copperUserId: copperId,
        status: 'updated',
      });

      console.log(`[Migrate Copper IDs] Updated ${userEmail} -> Copper ID ${copperId}`);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: usersSnapshot.size,
        updated,
        skipped,
        notFound,
      },
      details,
    });
  } catch (error: any) {
    console.error('[Migrate Copper IDs] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Migration failed',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
