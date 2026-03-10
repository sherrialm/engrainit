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

    setQueue: (items: QueueItem[]) => void;
    clearQueue: () => void;
    setQueueMode: (on: boolean) => void;
    setDwellSec: (n: number) => void;
    startQueue: () => void;
    stopQueue: () => void;
    nextInQueue: () => void;
    prevInQueue: () => void;
    _startDwellTimer: () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
    queue: [],
    queueIndex: 0,
    isQueueMode: false,
    dwellSec: 180,
    dwellTimer: null,

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
        if (queue.length === 0) return;

        const item = queue[queueIndex];
        if (!item) return;

        // Load via audioStore
        useAudioStore.getState().loadAndPlay(item.loop);

        // Start dwell timer if applicable
        get()._startDwellTimer();
    },

    stopQueue: () => {
        const { dwellTimer } = get();
        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }
        useAudioStore.getState().stop();
    },

    nextInQueue: () => {
        const { queue, queueIndex, dwellTimer } = get();
        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }

        const nextIdx = queueIndex + 1;
        if (nextIdx >= queue.length) {
            // End of queue
            get().stopQueue();
            set({ isQueueMode: false });
            return;
        }

        set({ queueIndex: nextIdx });

        const item = queue[nextIdx];
        useAudioStore.getState().loadAndPlay(item.loop);
        get()._startDwellTimer();
    },

    prevInQueue: () => {
        const { queue, queueIndex, dwellTimer } = get();
        if (dwellTimer) {
            clearTimeout(dwellTimer);
            set({ dwellTimer: null });
        }

        const prevIdx = queueIndex - 1;
        if (prevIdx < 0) return;

        set({ queueIndex: prevIdx });

        const item = queue[prevIdx];
        useAudioStore.getState().loadAndPlay(item.loop);
        get()._startDwellTimer();
    },

    // ── Internal: dwell timer helper ──────────────────────────
    _startDwellTimer: () => {
        const { dwellSec, dwellTimer: existing } = get();
        if (existing) clearTimeout(existing);

        if (dwellSec <= 0) {
            set({ dwellTimer: null });
            return;
        }

        const timer = setTimeout(() => {
            set({ dwellTimer: null });
            get().nextInQueue();
        }, dwellSec * 1000);

        set({ dwellTimer: timer });
    },
}));
