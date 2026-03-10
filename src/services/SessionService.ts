/**
 * SessionService
 *
 * Lightweight session logging for engraining sessions.
 * Stores under: users/{uid}/sessions/{auto-id}
 *
 * Uses Firestore Lite (same as UserPreferencesService).
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    orderBy,
    limit as firestoreLimit,
    Timestamp,
    updateDoc,
} from 'firebase/firestore/lite';
import { db } from '@/lib/firebase';

// ── Types ─────────────────────────────────────────────────────

export type SessionSourceType = 'tts' | 'recording' | 'document';
export type SessionEndReason = 'completed' | 'stopped' | 'paused' | 'interrupted';

export interface SessionRecord {
    createdAt: Timestamp;
    dateKey: string; // YYYY-MM-DD local time
    modeId: string;
    sourceType: SessionSourceType;
    durationPlannedSec?: number;
    durationActualSec?: number;
    completed: boolean;
    endedReason?: SessionEndReason;
    loopId?: string;
    trackId?: string;
}

export interface StartSessionPayload {
    modeId: string;
    sourceType: SessionSourceType;
    durationPlannedSec?: number;
    loopId?: string;
    trackId?: string;
}

// ── Helpers ───────────────────────────────────────────────────

function sessionsCol(uid: string) {
    return collection(db!, 'users', uid, 'sessions');
}

function todayKey(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a new session document. Returns the generated sessionId.
 */
export async function startSession(
    uid: string,
    payload: StartSessionPayload
): Promise<string> {
    if (!db) throw new Error('Firestore not initialized');

    const ref = doc(sessionsCol(uid));

    const record: SessionRecord = {
        createdAt: Timestamp.now(),
        dateKey: todayKey(),
        modeId: payload.modeId,
        sourceType: payload.sourceType,
        completed: false,
        durationPlannedSec: payload.durationPlannedSec,
        loopId: payload.loopId,
        trackId: payload.trackId,
    };

    await setDoc(ref, record);
    return ref.id;
}

/**
 * Close out a session document with completion info.
 */
export async function endSession(
    uid: string,
    sessionId: string,
    outcome: { completed: boolean; endedReason: SessionEndReason }
): Promise<void> {
    if (!db) return;

    const ref = doc(db, 'users', uid, 'sessions', sessionId);
    await updateDoc(ref, {
        completed: outcome.completed,
        endedReason: outcome.endedReason,
    });
}

/**
 * Fetch recent sessions ordered by createdAt desc.
 */
export async function getRecentSessions(
    uid: string,
    maxResults = 60
): Promise<SessionRecord[]> {
    if (!db) return [];

    const q = query(
        sessionsCol(uid),
        orderBy('createdAt', 'desc'),
        firestoreLimit(maxResults)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SessionRecord);
}

// ── Streak calculation ────────────────────────────────────────

/**
 * Compute consecutive days with at least one completed session.
 * Today counts if it has a completed session. Streak breaks on any gap.
 */
export function computeReinforcementStreak(sessions: SessionRecord[]): number {
    // Collect unique dateKeys of completed sessions
    const completedDates = new Set<string>();
    for (const s of sessions) {
        if (s.completed) {
            completedDates.add(s.dateKey);
        }
    }

    if (completedDates.size === 0) return 0;

    // Walk backwards from today
    let streak = 0;
    const d = new Date();

    for (let i = 0; i < 365; i++) {
        const key = formatDate(d);
        if (completedDates.has(key)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else if (i === 0) {
            // Today has no completed session — still check yesterday
            d.setDate(d.getDate() - 1);
            continue;
        } else {
            break;
        }
    }

    return streak;
}

function formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
