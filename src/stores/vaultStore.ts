import { create } from 'zustand';
import { Loop, LoopCategory } from '@/types';
import * as LoopService from '@/services/LoopService';

interface VaultState {
    loops: Loop[];
    isLoading: boolean;
    error: string | null;
    selectedCategory: LoopCategory | 'all';

    // Actions
    fetchLoops: (userId: string) => Promise<void>;
    addLoop: (userId: string, loop: Omit<Loop, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'playCount'>) => Promise<Loop>;
    updateLoop: (userId: string, loopId: string, updates: Partial<Loop>) => Promise<void>;
    removeLoop: (userId: string, loopId: string, audioUrl?: string) => Promise<void>;
    setCategory: (category: LoopCategory | 'all') => void;
    clearError: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
    loops: [],
    isLoading: false,
    error: null,
    selectedCategory: 'all',

    fetchLoops: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
            const loops = await LoopService.getLoops(userId);
            set({ loops, isLoading: false });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch loops', isLoading: false });
        }
    },

    addLoop: async (userId: string, loopData) => {
        set({ isLoading: true, error: null });
        try {
            const newLoop = await LoopService.createLoop(userId, loopData);
            set((state) => ({
                loops: [newLoop, ...state.loops],
                isLoading: false,
            }));
            return newLoop;
        } catch (err: any) {
            set({ error: err.message || 'Failed to create loop', isLoading: false });
            throw err;
        }
    },

    updateLoop: async (userId: string, loopId: string, updates) => {
        set({ error: null });
        try {
            await LoopService.updateLoop(userId, loopId, updates);
            set((state) => ({
                loops: state.loops.map((loop) =>
                    loop.id === loopId ? { ...loop, ...updates, updatedAt: new Date() } : loop
                ),
            }));
        } catch (err: any) {
            set({ error: err.message || 'Failed to update loop' });
            throw err;
        }
    },

    removeLoop: async (userId: string, loopId: string, audioUrl?: string) => {
        set({ error: null });
        const previousLoops = get().loops;

        // Optimistic update
        set((state) => ({
            loops: state.loops.filter((loop) => loop.id !== loopId),
        }));

        try {
            await LoopService.deleteLoop(userId, loopId, audioUrl);
        } catch (err: any) {
            // Restore previous state if deletion fails
            set({
                loops: previousLoops,
                error: err.message || 'Failed to delete loop'
            });
            throw err;
        }
    },

    setCategory: (category: LoopCategory | 'all') => {
        set({ selectedCategory: category });
    },

    clearError: () => set({ error: null }),
}));

// Selector for filtered loops
export function useFilteredLoops() {
    const loops = useVaultStore((state) => state.loops);
    const selectedCategory = useVaultStore((state) => state.selectedCategory);

    if (selectedCategory === 'all') return loops;
    return loops.filter((loop) => loop.category === selectedCategory);
}
