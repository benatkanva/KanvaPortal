"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  type User as FirebaseUser, 
  signOut as signOutFn, 
  setPersistence, 
  inMemoryPersistence, 
  browserLocalPersistence, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  updateDoc,
  deleteDoc,
  startAt,
  endAt,
  type Unsubscribe,
} from 'firebase/firestore';

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

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

// Configure default persistence
try {
  setPersistence(auth, browserLocalPersistence).catch(() => setPersistence(auth, inMemoryPersistence));
} catch {}

// Expose for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    (window as any).auth = auth;
    (window as any).firebaseApp = app;
    (window as any).db = db;
  } catch {}
}

// Email/Password Auth Helpers
export async function emailPasswordSignIn(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
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

// Firestore Collections (unified from all apps)
export const collections = {
  // Core
  users: 'users',
  settings: 'settings',
  products: 'products',
  customers: 'customers',
  
  // Goals Tracker
  goals: 'goals',
  metrics: 'metrics',
  pipelines: 'pipelines',
  
  // Fishbowl
  fishbowlCustomers: 'fishbowl_customers',
  fishbowlSalesOrders: 'fishbowl_sales_orders',
  fishbowlSoitems: 'fishbowl_soitems',
  
  // ShipStation
  shipstationShipments: 'shipstation_shipments',
  shipstationOrders: 'shipstation_orders',
  
  // Copper CRM
  copperCompanies: 'copper_companies',
  copperPeople: 'copper_people',
  copperLeads: 'copper_leads',
  copperOpportunities: 'copper_opportunities',
  
  // Commission
  commissionEntries: 'commission_entries',
  commissionPayouts: 'commission_payouts',
  monthlyCommissions: 'monthly_commissions',
  
  // Store Locator
  stores: 'stores',
  retailerApplications: 'retailer_applications',
  
  // Sync
  syncLog: 'sync_log',
} as const;

// Firestore Converters for Type Safety
export const createConverter = <T>() => ({
  toFirestore: (data: T): DocumentData => data as DocumentData,
  fromFirestore: (snap: QueryDocumentSnapshot): T => {
    const data = snap.data();
    const convertedData: any = { ...data, id: snap.id };

    // Convert common timestamp fields
    if (data?.createdAt?.toDate) convertedData.createdAt = data.createdAt.toDate();
    if (data?.updatedAt?.toDate) convertedData.updatedAt = data.updatedAt.toDate();
    if (data?.date?.toDate) convertedData.date = data.date.toDate();
    if (data?.startDate?.toDate) convertedData.startDate = data.startDate.toDate();
    if (data?.endDate?.toDate) convertedData.endDate = data.endDate.toDate();

    return convertedData as T;
  },
});

// Helper to ensure Firebase is initialized
export function ensureFirebaseInitialized() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  if (!auth || !db) {
    throw new Error('Firebase not initialized');
  }
}

// Export all instances and utilities
export { 
  app,
  auth, 
  db,
  storage,
  functions,
  serverTimestamp, 
  Timestamp, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  updateDoc,
  deleteDoc,
  startAt,
  endAt,
};
export type { Unsubscribe, FirebaseUser };
