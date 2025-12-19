import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manage org-wide Copper defaults stored in settings/copper_metadata.defaults

export async function GET() {
  try {
    const doc = await adminDb.collection('settings').doc('copper_metadata').get();
    const data = doc.exists ? doc.data() : {};
    return NextResponse.json({ success: true, defaults: (data as any).defaults || {} });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const defaults = body?.defaults || {};
    await adminDb.collection('settings').doc('copper_metadata').set({ defaults, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true, saved: true, defaults });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
