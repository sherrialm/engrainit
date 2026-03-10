/**
 * Firebase Admin SDK (server-only, lazy-loaded)
 *
 * Uses dynamic require() to avoid build-time module resolution
 * issues with @google-cloud/firestore in Next.js static analysis.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

let _adminAuth: any = null;
let _adminDb: any = null;
let _initialized = false;

function ensureInit() {
    if (_initialized) return;

    const admin = require('firebase-admin');
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!admin.apps.length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId,
            });
        } else {
            admin.initializeApp({ projectId });
        }
    }

    _adminAuth = admin.auth();
    _adminDb = admin.firestore();
    _initialized = true;
}

export function getAdminAuth() {
    ensureInit();
    return _adminAuth;
}

export function getAdminDb() {
    ensureInit();
    return _adminDb;
}
