/**
 * Routine Store
 *
 * Runtime + localStorage-persisted state for the active routine.
 */

import { create } from 'zustand';
import { Routine } from '@/services/RoutineService';

const LS_KEY = 'engrainit_active_routine';

interface RoutineState {
    activeRoutine: Routine | null;
    currentDay: number;          // 1-indexed
    completedDays: number[];     // days already done

    setRoutine: (routine: Routine) => void;
    completeDay: (day: number) => void;
    clearRoutine: () => void;
}

function loadFromStorage(): Partial<RoutineState> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function saveToStorage(state: Pick<RoutineState, 'activeRoutine' | 'currentDay' | 'completedDays'>) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LS_KEY, JSON.stringify({
        activeRoutine: state.activeRoutine,
        currentDay: state.currentDay,
        completedDays: state.completedDays,
    }));
}

export const useRoutineStore = create<RoutineState>((set, get) => {
    const saved = loadFromStorage();

    return {
        activeRoutine: (saved.activeRoutine as Routine | null) ?? null,
        currentDay: (saved.currentDay as number) ?? 1,
        completedDays: (saved.completedDays as number[]) ?? [],

        setRoutine: (routine) => {
            const next = { activeRoutine: routine, currentDay: 1, completedDays: [] as number[] };
            set(next);
            saveToStorage(next);
        },

        completeDay: (day) => {
            const { completedDays, activeRoutine } = get();
            if (completedDays.includes(day)) return;

            const nextCompleted = [...completedDays, day];
            const nextDay = Math.min(day + 1, activeRoutine?.days ?? day);

            // If all days completed, clear routine
            if (activeRoutine && nextCompleted.length >= activeRoutine.days) {
                const cleared = { activeRoutine: null as Routine | null, currentDay: 1, completedDays: [] as number[] };
                set(cleared);
                saveToStorage(cleared);
                return;
            }

            const next = { activeRoutine: get().activeRoutine, currentDay: nextDay, completedDays: nextCompleted };
            set({ currentDay: nextDay, completedDays: nextCompleted });
            saveToStorage(next);
        },

        clearRoutine: () => {
            const cleared = { activeRoutine: null as Routine | null, currentDay: 1, completedDays: [] as number[] };
            set(cleared);
            saveToStorage(cleared);
        },
    };
});
