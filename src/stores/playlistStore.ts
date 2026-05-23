/**
 * Playlist Store
 *
 * Runtime-only queue for sequential loop playback.
 * Uses the existing audioStore for actual playback — this store
 * only manages the queue, index, and session gap timer.
 *
 * Session gap = time between loops in a session.
 * Single-loop repeat interval = controlled by SpacedRepetitionController.
 */

import { create } from 'zustand';
import { Loop } from '@/types';
import { useAudioStore } from './audioStore';

// ── Types ─────────────────────────────────────────────────────

export interface QueueItem {
    loopId: string;
    title: string;
    audioUrl: string;
    sourceType: 'tts' | 'recording' | 'document';
    intervalSeconds: number;
    loop: Loop; // full object for loadAndPlay
}

interface PlaylistState {
    queue: QueueItem[];
    queueIndex: number;
    isQueueMode: boolean;

    // Session gap: time to wait between loops in a session
    // -1 = manual (do not auto-advance), 0 = immediately, >0 = seconds
    sessionGapSec: number;
    gapTimer: NodeJS.Timeout | null;
    gapRemaining: number | null; // live countdown for UI
    _gapTickTimer: NodeJS.Timeout | null;

    // Legacy dwell aliases (kept for compat with audioStore/vault)
    dwellTimer: NodeJS.Timeout | null;
    dwellSec: number;           // alias for sessionGapSec
    dwellRemaining: number | null; // alias for gapRemaining
    _clearDwellTick: () => void;

    setQueue: (items: QueueItem[]) => void;
    clearQueue: () => void;
    setQueueMode: (on: boolean) => void;
    setSessionGapSec: (n: number) => void;
    startQueue: () => void;
    stopQueue: () => void;
    nextInQueue: () => void;
    prevInQueue: () => void;
    onQueueLoopFinished: () => void;
    _startGapTimer: () => void;
    _clearGapTick: () => void;

    /** @deprecated Use setSessionGapSec */
    setDwellSec: (n: number) => void;
    /** @deprecated Unused — kept for audioStore compat */
    _startDwellTimer: () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
    queue: [],
    queueIndex: 0,
    isQueueMode: false,

    sessionGapSec: 0,    // default: advance immediately
    gapTimer: null,
    gapRemaining: null,
    _gapTickTimer: null,

    // Legacy aliases (audioStore.stop() references these)
    dwellTimer: null,
    dwellSec: 0,
    dwellRemaining: null,

    setQueue: (items) => set({ queue: items, queueIndex: 0 }),

    clearQueue: () => {
        get().stopQueue();
        set({ queue: [], queueIndex: 0, isQueueMode: false });
    },

    setQueueMode: (on) => {
        set({ isQueueMode: on });
        if (!on) get().stopQueue();
    },

    setSessionGapSec: (n) => set({ sessionGapSec: n, dwellSec: n }),

    /** @deprecated Use setSessionGapSec */
    setDwellSec: (n) => set({ sessionGapSec: Math.max(0, n), dwellSec: Math.max(0, n) }),

    startQueue: () => {
        const { queue, queueIndex } = get();
        console.log(`[PlaylistStore] startQueue — queueIndex=${queueIndex}, queue.length=${queue.length}`);
        if (queue.length === 0) return;

        const item = queue[queueIndex];
        if (!item) return;

        // Load via audioStore — advancement is now driven by audio completion
        // (onQueueLoopFinished), not a dwell timer.
        useAudioStore.getState().loadAndPlay(item.loop);
    },

    stopQueue: () => {
        const { gapTimer } = get();
        if (gapTimer) {
            clearTimeout(gapTimer);
            set({ gapTimer: null, dwellTimer: null });
        }
        get()._clearGapTick();
        useAudioStore.getState().stop();
        set({ queue: [], queueIndex: 0, isQueueMode: false });
    },

    nextInQueue: () => {
        const { queue, queueIndex, gapTimer } = get();
        console.log(`[PlaylistStore] nextInQueue called — queueIndex=${queueIndex}, queue.length=${queue.length}`);

        if (gapTimer) {
            clearTimeout(gapTimer);
            set({ gapTimer: null, dwellTimer: null });
        }
        get()._clearGapTick();

        if (queue.length === 0) {
            console.warn('[PlaylistStore] nextInQueue: queue is empty, doing nothing');
            return;
        }

        const nextIdx = queueIndex + 1;
        if (nextIdx >= queue.length) {
            // Wrap back to first loop for continuous playback
            console.log(`[PlaylistStore] Wrapping: nextIdx=${nextIdx} >= queue.length=${queue.length}, resetting to 0`);
            set({ queueIndex: 0 });
            const item = queue[0];
            if (!item) {
                console.error('[PlaylistStore] queue[0] is undefined after wrap!');
                return;
            }
            console.log(`[PlaylistStore] Playing wrapped loop: "${item.title}" (index 0)`);
            useAudioStore.getState().loadAndPlay(item.loop);
            return;
        }

        set({ queueIndex: nextIdx });

        const item = queue[nextIdx];
        if (!item) {
            console.error(`[PlaylistStore] queue[${nextIdx}] is undefined!`);
            return;
        }
        console.log(`[PlaylistStore] Playing next loop: "${item.title}" (index ${nextIdx})`);
        useAudioStore.getState().loadAndPlay(item.loop);
    },

    prevInQueue: () => {
        const { queue, queueIndex, gapTimer } = get();
        if (gapTimer) {
            clearTimeout(gapTimer);
            set({ gapTimer: null, dwellTimer: null });
        }
        get()._clearGapTick();

        const prevIdx = queueIndex - 1;
        if (prevIdx < 0) return;

        set({ queueIndex: prevIdx });

        const item = queue[prevIdx];
        useAudioStore.getState().loadAndPlay(item.loop);
    },

    /**
     * Called when audio finishes for the current loop in session mode.
     * Waits the session gap, then advances to the next queue item.
     */
    onQueueLoopFinished: () => {
        const { isQueueMode, queue, sessionGapSec } = get();
        if (!isQueueMode || queue.length === 0) return;

        // Manual gap (-1): do NOT auto-advance — user must press Next
        if (sessionGapSec === -1) {
            console.log('[PlaylistStore] onQueueLoopFinished: manual gap — waiting for user');
            return;
        }

        // Immediate gap (0): advance now
        if (sessionGapSec === 0) {
            console.log('[PlaylistStore] onQueueLoopFinished: immediate gap — advancing now');
            get().nextInQueue();
            return;
        }

        // Timed gap: wait sessionGapSec then advance
        console.log(`[PlaylistStore] onQueueLoopFinished: waiting ${sessionGapSec}s before next loop`);
        get()._startGapTimer();
    },

    // ── Internal: session gap timer ──────────────────────────
    _startGapTimer: () => {
        const { sessionGapSec, gapTimer: existing } = get();
        if (existing) clearTimeout(existing);
        get()._clearGapTick();

        if (sessionGapSec <= 0) {
            // 0 or -1 should not reach here, but guard anyway
            set({ gapTimer: null, dwellTimer: null });
            return;
        }

        // Start countdown for UI
        set({ gapRemaining: sessionGapSec, dwellRemaining: sessionGapSec });
        const tickTimer = setInterval(() => {
            const { gapRemaining } = get();
            if (gapRemaining !== null && gapRemaining > 1) {
                set({ gapRemaining: gapRemaining - 1, dwellRemaining: gapRemaining - 1 });
            }
        }, 1000);
        set({ _gapTickTimer: tickTimer });

        console.log(`[PlaylistStore] _startGapTimer: scheduling next advance in ${sessionGapSec}s`);
        const timer = setTimeout(() => {
            console.log('[PlaylistStore] Gap timer fired — advancing queue');
            set({ gapTimer: null, dwellTimer: null });
            get()._clearGapTick();
            get().nextInQueue();
        }, sessionGapSec * 1000);

        set({ gapTimer: timer, dwellTimer: timer });
    },

    // ── Internal: clear the 1-second countdown tick ───────────
    _clearGapTick: () => {
        const { _gapTickTimer } = get();
        if (_gapTickTimer) {
            clearInterval(_gapTickTimer);
            set({ _gapTickTimer: null, gapRemaining: null, dwellRemaining: null });
        }
    },

    /** @deprecated Legacy compat — audioStore.stop() references this */
    _clearDwellTick: () => {
        get()._clearGapTick();
    },

    /** @deprecated Unused — kept for compat */
    _startDwellTimer: () => {
        get()._startGapTimer();
    },
}));
