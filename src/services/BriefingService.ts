/**
 * BriefingService — Firestore CRUD for daily briefings
 *
 * Caches briefings at: users/{uid}/briefings/{yyyy-mm-dd}
 * Prevents redundant AI calls and ensures consistent daily messaging.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { db } from '@/lib/firebase';

/**
 * Get today's cached briefing from Firestore.
 * Returns null if no briefing exists for this date.
 */
export async function getCachedBriefing(
    userId: string,
    date: string,
): Promise<string | null> {
    if (!db) return null;

    try {
        const ref = doc(db, 'users', userId, 'briefings', date);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            return snap.data().text || null;
        }
        return null;
    } catch (err) {
        console.error('[BriefingService] Failed to get cached briefing:', err);
        return null;
    }
}

/**
 * Save a briefing to Firestore for caching.
 */
export async function saveBriefing(
    userId: string,
    date: string,
    text: string,
): Promise<void> {
    if (!db) return;

    try {
        const ref = doc(db, 'users', userId, 'briefings', date);
        await setDoc(ref, {
            text,
            date,
            generatedAt: new Date(),
        });
    } catch (err) {
        console.error('[BriefingService] Failed to save briefing:', err);
    }
}
