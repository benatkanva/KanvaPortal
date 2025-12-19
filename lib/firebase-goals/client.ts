"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User as FirebaseUser, signOut as signOutFn, setPersistence, inMemoryPersistence, browserLocalPersistence, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { clearAuthData } from '@/lib/auth/storage';
import { db, doc, getDoc, setDoc, serverTimestamp, Timestamp } from './db';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App (client-side safe)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth
const auth = getAuth(app);
// Configure default persistence: prefer browserLocalPersistence (IndexedDB) even in iframes,
// fallback to inMemory if storage is unavailable.
try {
  setPersistence(auth, browserLocalPersistence).catch(() => setPersistence(auth, inMemoryPersistence));
} catch {}

// Initialize Cloud Functions
const functions = getFunctions(app, 'us-central1');

// Expose for debugging in development: allows checking auth/app in the browser console
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    (window as any).auth = auth;
    (window as any).firebaseApp = app;
  } catch {}
}

// Email/Password Auth Helpers
export async function emailPasswordSignIn(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  // Ensure user doc exists
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: user.uid,
        email: user.email,
        name: user.displayName || null,
        photoUrl: user.photoURL || null,
        role: 'sales',
        passwordChanged: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('[auth] failed to ensure user profile', e);
  }
  return user;
}

export async function sendResetEmail(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export const signOut = async () => {
  try {
    try { await clearAuthData(); } catch {}
    await signOutFn(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Real-time Auth State Observer
export const onAuthStateChange = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore Collections
export const collections = {
  users: 'users',
  goals: 'goals',
  metrics: 'metrics',
  settings: 'settings',
  fishbowlCustomers: 'fishbowl_customers',
  fishbowlSalesOrders: 'fishbowl_sales_orders',
  shipstationShipments: 'shipstation_shipments',
  products: 'products',
  syncLog: 'sync_log',
} as const;

// Export instances
export { auth, db, functions, serverTimestamp, Timestamp };