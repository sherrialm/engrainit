/**
 * Session Store — Phase 2
 *
 * Zustand store with localStorage persistence for saved sessions.
 * A session is a named playlist of loop IDs — the user creates,
 * saves, and replays them whenever they want.
 *
 * Pattern mirrors routineStore.ts (localStorage-backed, no Firestore).
 */

import { create } from 'zustand';
import type { SavedSession, SessionTypeId } from '@/types';

// ── localStorage key ──────────────────────────────────────────

const LS_KEY = 'engrainit_saved_sessions';

// ── Draft shape ───────────────────────────────────────────────

export interface DraftSession {
    typeId: SessionTypeId;
    name: string;
    loopIds: string[];
    editingSessionId: string | null; // null = creating new
}

// ── Store types ───────────────────────────────────────────────

interface SessionState {
    sessions: SavedSession[];
    activeSessionId: string | null;
    draft: DraftSession | null;

    // Draft actions
    startDraft: (typeId: SessionTypeId) => void;
    editSession: (id: string) => void;
    setDraftName: (name: string) => void;
    addLoopToDraft: (loopId: string) => void;
    removeLoopFromDraft: (loopId: string) => void;
    setDraftLoops: (loopIds: string[]) => void;
    clearDraft: () => void;

    // Persistence actions
    saveDraft: () => string | null; // returns session ID or null
    deleteSavedSession: (id: string) => void;

    // Playback tracking
    setActiveSessionId: (id: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────

function loadSessions(): SavedSession[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SavedSession[];
    } catch {
        return [];
    }
}

function persistSessions(sessions: SavedSession[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

function generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const SESSION_TYPE_NAMES: Record<SessionTypeId, string> = {
    morning: 'Morning Session',
    midday: 'Midday Reset',
    focus: 'Focus Session',
    evening: 'Evening Wind Down',
    custom: 'Custom Session',
};

// ── Store ─────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>((set, get) => ({
    sessions: loadSessions(),
    activeSessionId: null,
    draft: null,

    // ── Draft actions ─────────────────────────────────────────

    startDraft: (typeId: SessionTypeId) => {
        set({
            draft: {
                typeId,
                name: SESSION_TYPE_NAMES[typeId],
                loopIds: [],
                editingSessionId: null,
            },
        });
    },

    editSession: (id: string) => {
        const session = get().sessions.find(s => s.id === id);
        if (!session) return;

        set({
            draft: {
                typeId: session.typeId,
                name: session.name,
                loopIds: [...session.loopIds],
                editingSessionId: session.id,
            },
        });
    },

    setDraftName: (name: string) => {
        const { draft } = get();
        if (!draft) return;
        set({ draft: { ...draft, name } });
    },

    addLoopToDraft: (loopId: string) => {
        const { draft } = get();
        if (!draft) return;
        if (draft.loopIds.includes(loopId)) return;
        set({ draft: { ...draft, loopIds: [...draft.loopIds, loopId] } });
    },

    removeLoopFromDraft: (loopId: string) => {
        const { draft } = get();
        if (!draft) return;
        set({ draft: { ...draft, loopIds: draft.loopIds.filter(id => id !== loopId) } });
    },

    setDraftLoops: (loopIds: string[]) => {
        const { draft } = get();
        if (!draft) return;
        set({ draft: { ...draft, loopIds } });
    },

    clearDraft: () => {
        set({ draft: null });
    },

    // ── Persistence ───────────────────────────────────────────

    saveDraft: () => {
        const { draft, sessions } = get();
        if (!draft || draft.loopIds.length === 0) return null;

        const now = new Date().toISOString();

        if (draft.editingSessionId) {
            // Update existing session
            const updated = sessions.map(s =>
                s.id === draft.editingSessionId
                    ? {
                          ...s,
                          name: draft.name,
                          typeId: draft.typeId,
                          loopIds: draft.loopIds,
                          updatedAt: now,
                      }
                    : s
            );
            set({ sessions: updated, draft: null });
            persistSessions(updated);
            return draft.editingSessionId;
        } else {
            // Create new session
            const newSession: SavedSession = {
                id: generateId(),
                name: draft.name,
                typeId: draft.typeId,
                loopIds: draft.loopIds,
                createdAt: now,
                updatedAt: now,
            };
            const next = [newSession, ...sessions];
            set({ sessions: next, draft: null });
            persistSessions(next);
            return newSession.id;
        }
    },

    deleteSavedSession: (id: string) => {
        const next = get().sessions.filter(s => s.id !== id);
        set({ sessions: next });
        persistSessions(next);
    },

    // ── Playback tracking ─────────────────────────────────────

    setActiveSessionId: (id: string | null) => {
        set({ activeSessionId: id });
    },
}));
