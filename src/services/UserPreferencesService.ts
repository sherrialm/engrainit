/**
 * UserPreferencesService
 *
 * Lightweight persistence for per-user UI preferences.
 * Stores under: users/{uid}/settings/preferences (Firestore Lite).
 *
 * Uses setDoc with merge:true so it never overwrites other fields.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { db } from '@/lib/firebase';

// ── Types ─────────────────────────────────────────────────────

export interface ModeDefaultSettings {
    voiceId?: string;
    refineTone?: string;
    refineBelievability?: number;
    ambienceEnabled?: boolean;
    ambienceTrackId?: string | null;
    ambienceVolume?: number;
}

export interface UserPreferences {
    autoStartEngraining?: boolean;
    lastNightPresetId?: string;
    lastIdentityModeId?: string;
    modeDefaults?: Record<string, ModeDefaultSettings>;
    remindersEnabled?: boolean;
    reminderTimeLocal?: string;    // "21:30" 24h format
    reminderModeId?: string;       // identity mode to suggest
}

// ── Firestore path helper ─────────────────────────────────────

function prefsDoc(uid: string) {
    return doc(db!, 'users', uid, 'settings', 'preferences');
}

// ── Public API ────────────────────────────────────────────────

/**
 * Read all stored preferences for a user.
 */
export async function getUserPreferences(uid: string): Promise<UserPreferences> {
    if (!db) return {};

    const snap = await getDoc(prefsDoc(uid));
    if (!snap.exists()) return {};

    return snap.data() as UserPreferences;
}

/**
 * Persist the autoStartEngraining preference.
 */
export async function setAutoStartEngrainingPref(uid: string, value: boolean): Promise<void> {
    if (!db) return;
    await setDoc(prefsDoc(uid), { autoStartEngraining: value }, { merge: true });
}

/**
 * Persist the last-used Night Preset id.
 */
export async function setLastNightPresetId(uid: string, presetId: string | null): Promise<void> {
    if (!db) return;
    await setDoc(prefsDoc(uid), { lastNightPresetId: presetId ?? null }, { merge: true });
}

/**
 * Persist the last-used Identity Mode id.
 */
export async function setLastIdentityModeId(uid: string, modeId: string): Promise<void> {
    if (!db) return;
    await setDoc(prefsDoc(uid), { lastIdentityModeId: modeId }, { merge: true });
}

// ── Per-mode default settings ─────────────────────────────────

/**
 * Read all per-mode defaults. Returns an empty object if none stored.
 */
export async function getModeDefaults(uid: string): Promise<Record<string, ModeDefaultSettings>> {
    const prefs = await getUserPreferences(uid);
    return prefs.modeDefaults ?? {};
}

/**
 * Merge partial defaults for a specific mode without overwriting other modes.
 * Uses a key-path merge: `modeDefaults.{modeId}` is deep-merged.
 */
export async function setModeDefault(
    uid: string,
    modeId: string,
    partial: Partial<ModeDefaultSettings>
): Promise<void> {
    if (!db) return;

    // Read current to deep-merge (Firestore merge:true merges top-level keys only)
    const prefs = await getUserPreferences(uid);
    const current = prefs.modeDefaults ?? {};
    const existing = current[modeId] ?? {};

    const merged: Record<string, ModeDefaultSettings> = {
        ...current,
        [modeId]: { ...existing, ...partial },
    };

    await setDoc(prefsDoc(uid), { modeDefaults: merged }, { merge: true });
}

// ── Reminder preferences ──────────────────────────────────────

export async function setReminderPrefs(
    uid: string,
    prefs: { remindersEnabled?: boolean; reminderTimeLocal?: string; reminderModeId?: string }
): Promise<void> {
    if (!db) return;
    await setDoc(prefsDoc(uid), prefs, { merge: true });
}
