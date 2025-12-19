"use client";

import { getApps } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';

let analyticsInstance: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return null;

  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const apps = getApps();
    if (!apps.length) return null; // App is initialized in lib/firebase/db.ts

    analyticsInstance = getAnalytics(apps[0]);
    return analyticsInstance;
  } catch (e) {
    // Analytics is optional; swallow errors to avoid breaking the app
    console.warn('Analytics init skipped:', e);
    return null;
  }
}
