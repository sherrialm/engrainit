/**
 * Habit Service — Firestore CRUD for habit tracking
 *
 * Schema: users/{uid}/habits/{habitId}
 * Each habit document contains an `entries` map: { "YYYY-MM-DD": boolean }
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    Timestamp,
    DocumentData,
} from 'firebase/firestore/lite';
import { db } from '@/lib/firebase';
import { Habit, HabitGoalCategory } from '@/types';

function docToHabit(docData: DocumentData, id: string): Habit {
    return {
        id,
        userId: docData.userId,
        name: docData.name,
        goalCategory: docData.goalCategory,
        createdAt: docData.createdAt?.toDate() || new Date(),
        entries: docData.entries || {},
    };
}

/**
 * Get all habits for a user.
 */
export async function getHabits(userId: string): Promise<Habit[]> {
    if (!db) throw new Error('Firestore not initialized');

    const habitsRef = collection(db, 'users', userId, 'habits');
    const snapshot = await getDocs(habitsRef);

    return snapshot.docs.map((d) => docToHabit(d.data(), d.id));
}

/**
 * Create a new habit.
 */
export async function createHabit(
    userId: string,
    name: string,
    goalCategory?: HabitGoalCategory
): Promise<Habit> {
    if (!db) throw new Error('Firestore not initialized');

    const habitsRef = collection(db, 'users', userId, 'habits');
    const now = Timestamp.now();

    const docData: Record<string, any> = {
        userId,
        name,
        createdAt: now,
        entries: {},
    };
    if (goalCategory) docData.goalCategory = goalCategory;

    const docRef = await addDoc(habitsRef, docData);
    return {
        id: docRef.id,
        userId,
        name,
        goalCategory,
        createdAt: now.toDate(),
        entries: {},
    };
}

/**
 * Toggle a habit completion for a given date.
 */
export async function toggleHabitEntry(
    userId: string,
    habitId: string,
    date: string, // YYYY-MM-DD
    completed: boolean
): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');

    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    await updateDoc(habitRef, {
        [`entries.${date}`]: completed,
    });
}

/**
 * Delete a habit.
 */
export async function deleteHabit(userId: string, habitId: string): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');

    const habitRef = doc(db, 'users', userId, 'habits', habitId);
    await deleteDoc(habitRef);
}

/**
 * Compute the current streak for a habit (consecutive days ending today).
 */
export function computeHabitStreak(entries: Record<string, boolean>): number {
    const today = new Date();
    let streak = 0;

    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];

        if (entries[key]) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}
