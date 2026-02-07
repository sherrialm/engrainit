// src/firebase.ts
// Re-export from the main firebase config to avoid conflicts
// All Firebase initialization happens in src/lib/firebase.ts

export { app, auth, db, storage } from '@/lib/firebase';