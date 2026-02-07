// Firebase configuration
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase - safe for both client and server
// SSR/Server: exports will be undefined (don't use on server)
// Client: will be properly initialized
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// Only initialize on client-side
if (typeof window !== 'undefined') {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);

        // Initialize Firestore with long polling to avoid WebSocket issues
        // This can fix connection issues in deployed environments
        if (!getApps().length || !db) {
            db = initializeFirestore(app, {
                experimentalForceLongPolling: true,
            });
        }

        storage = getStorage(app);
        console.log('[Firebase] Initialized successfully with long polling enabled');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

export { app, auth, db, storage };
