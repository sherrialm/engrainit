/**
 * Playlist Store
 *
 * Runtime-only queue for sequential loop playback.
 * Uses the existing audioStore for actual playback — this store
 * only manages the queue, index, and dwell timer.
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
    dwellSec: number; // 0 = manual next
    dwellTimer: NodeJS.Timeout | null;
    dwellRemaining: number | null; // live countdown for UI
    _dwellTickTimer: NodeJS.Timeout | null;

    setQueue: (items: QueueItem[]) => void;
    clearQueue: () => void;
    setQueueMode: (on: boolean) => void;
    setDwellSec: (n: number) => void;
    startQueue: () => void;
    stopQueue: () => void;
    nextInQueue: () => void;
    prevInQueue: () => void;
    onQueueLoopFinished: () => void;
    _startDwellTimer: () => void;
    _clearDwellTick: () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
    queue: [],
    queueIndex: 0,
    isQueueMode: false,
    dwellSec: 30,
    dwellTimer: null,
    dwellRemaining: null,
    _dwellTickTimer: null,

    setQueue: (items) => set({ queue: items, queueIndex: 0 }),

    clearQueue: () => {
        get().stopQueue();
        set({ queue: [], queueIndex: 0, isQueueMode: false });
    },

    setQueueMode: (on) => {
        set({ isQueueMode: on });
        if (!on) get().stopQueue();
    },

    setDwellSec: (n) => set({ dwellSec: Math.max(0, n) }),

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
        const { dwellTimer } = get();
        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }
        get()._clearDwellTick();
        useAudioStore.getState().stop();
        set({ queue: [], queueIndex: 0, isQueueMode: false });
    },

    nextInQueue: () => {
        const { queue, queueIndex, dwellTimer } = get();
        console.log(`[PlaylistStore] nextInQueue called — queueIndex=${queueIndex}, queue.length=${queue.length}`);

        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }
        get()._clearDwellTick();

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
        const { queue, queueIndex, dwellTimer } = get();
        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }
        get()._clearDwellTick();

        const prevIdx = queueIndex - 1;
        if (prevIdx < 0) return;

        set({ queueIndex: prevIdx });

        const item = queue[prevIdx];
        useAudioStore.getState().loadAndPlay(item.loop);
    },

    /**
     * Called when the SpacedRepetitionController finishes all repeats
     * for the current loop.  Auto-advances to the next queue item so
     * the session keeps cycling (loop 1 → 2 → 3 → 1 → …).
     */
    onQueueLoopFinished: () => {
        const { isQueueMode, queue } = get();
        if (!isQueueMode || queue.length === 0) return;
        get().nextInQueue();
    },

    // ── Internal: clear the 1-second countdown tick ───────────
    _clearDwellTick: () => {
        const { _dwellTickTimer } = get();
        if (_dwellTickTimer) {
            clearInterval(_dwellTickTimer);
            set({ _dwellTickTimer: null, dwellRemaining: null });
        }
    },

    // ── Internal: dwell timer helper ──────────────────────────
    _startDwellTimer: () => {
        const { dwellSec, dwellTimer: existing, isQueueMode } = get();
        if (existing) clearTimeout(existing);
        get()._clearDwellTick();

        // Resolve the effective dwell time. In queue/session mode,
        // never allow 0 (Manual) — fall back to 30s so the queue cycles.
        let effectiveDwell = dwellSec;
        if (effectiveDwell <= 0 && isQueueMode) {
            effectiveDwell = 30;
        }

        if (effectiveDwell <= 0) {
            console.log('[PlaylistStore] _startDwellTimer: dwellSec<=0, no timer set');
            set({ dwellTimer: null });
            return;
        }

        // Set initial remaining and start 1-second tick for the UI countdown
        set({ dwellRemaining: effectiveDwell });
        const tickTimer = setInterval(() => {
            const { dwellRemaining } = get();
            if (dwellRemaining !== null && dwellRemaining > 1) {
                set({ dwellRemaining: dwellRemaining - 1 });
            }
        }, 1000);
        set({ _dwellTickTimer: tickTimer });

        console.log(`[PlaylistStore] _startDwellTimer: scheduling next advance in ${effectiveDwell}s`);
        const timer = setTimeout(() => {
            console.log('[PlaylistStore] Dwell timer fired — advancing queue');
            set({ dwellTimer: null });
            get()._clearDwellTick();
            get().nextInQueue();
        }, effectiveDwell * 1000);

        set({ dwellTimer: timer });
    },
}));
