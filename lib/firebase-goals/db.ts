import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
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
  Unsubscribe,
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

// Initialize Firebase (App + Firestore only; no Auth here)
let app: FirebaseApp;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);

// Firestore Collections
export const collections = {
  users: 'users',
  goals: 'goals',
  metrics: 'metrics',
  pipelines: 'pipelines',
  settings: 'settings',
};

// Firestore Converters for Type Safety
export const createConverter = <T>() => ({
  toFirestore: (data: T): DocumentData => data as DocumentData,
  fromFirestore: (snap: QueryDocumentSnapshot): T => {
    const data = snap.data();
    // Convert Timestamp fields to Date
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

export { 
  db, 
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
export type { Unsubscribe };
