/**
 * Habit Store — Zustand state for habit tracking
 */

import { create } from 'zustand';
import { Habit, HabitGoalCategory } from '@/types';
import * as HabitService from '@/services/HabitService';

interface HabitState {
    habits: Habit[];
    isLoading: boolean;
    error: string | null;
    selectedCategory: HabitGoalCategory | 'all';

    fetchHabits: (userId: string) => Promise<void>;
    addHabit: (userId: string, name: string, goalCategory?: HabitGoalCategory) => Promise<Habit>;
    removeHabit: (userId: string, habitId: string) => Promise<void>;
    toggleCompletion: (userId: string, habitId: string, date: string) => Promise<void>;
    setCategory: (category: HabitGoalCategory | 'all') => void;
}

export const useHabitStore = create<HabitState>((set, get) => ({
    habits: [],
    isLoading: false,
    error: null,
    selectedCategory: 'all',

    fetchHabits: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
            const habits = await HabitService.getHabits(userId);
            set({ habits, isLoading: false });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch habits', isLoading: false });
        }
    },

    addHabit: async (userId: string, name: string, goalCategory?: HabitGoalCategory) => {
        set({ error: null });
        try {
            const habit = await HabitService.createHabit(userId, name, goalCategory);
            set((state) => ({ habits: [...state.habits, habit] }));
            return habit;
        } catch (err: any) {
            set({ error: err.message || 'Failed to create habit' });
            throw err;
        }
    },

    removeHabit: async (userId: string, habitId: string) => {
        const prev = get().habits;
        // Optimistic
        set((state) => ({ habits: state.habits.filter((h) => h.id !== habitId) }));
        try {
            await HabitService.deleteHabit(userId, habitId);
        } catch (err: any) {
            set({ habits: prev, error: err.message || 'Failed to delete habit' });
        }
    },

    toggleCompletion: async (userId: string, habitId: string, date: string) => {
        const habit = get().habits.find((h) => h.id === habitId);
        if (!habit) return;

        const currentValue = habit.entries[date] || false;
        const newValue = !currentValue;

        // Optimistic update
        set((state) => ({
            habits: state.habits.map((h) =>
                h.id === habitId
                    ? { ...h, entries: { ...h.entries, [date]: newValue } }
                    : h
            ),
        }));

        try {
            await HabitService.toggleHabitEntry(userId, habitId, date, newValue);
        } catch (err: any) {
            // Revert on failure
            set((state) => ({
                habits: state.habits.map((h) =>
                    h.id === habitId
                        ? { ...h, entries: { ...h.entries, [date]: currentValue } }
                        : h
                ),
                error: err.message || 'Failed to update habit',
            }));
        }
    },

    setCategory: (category: HabitGoalCategory | 'all') => {
        set({ selectedCategory: category });
    },
}));
