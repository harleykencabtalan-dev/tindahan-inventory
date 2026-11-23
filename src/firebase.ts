import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB2JhQ4-saiE62Vf1x7RvZV7lLtN0B9lnQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tindahan-pos-bc780.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tindahan-pos-bc780',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tindahan-pos-bc780.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '354223304336',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:354223304336:web:3eb4e38edc8d5c95d3b215',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-WW7RDCD8P4',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline-first Firestore cache: works without internet and syncs when back online
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
