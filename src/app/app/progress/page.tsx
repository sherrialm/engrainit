'use client';

/**
 * Progress — Habit Tracking & Consistency
 *
 * Users can add habits and track completion with a visual consistency grid.
 * Milestones at 3, 7, 14, 30 days trigger confetti + jingle.
 *
 * Now includes a Morning Ritual section at the top showing the
 * user's morning streak and last-7-days consistency.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHabitStore } from '@/stores/habitStore';
import { ProgressIcon, PlusIcon, CheckIcon, BriefingIcon } from '@/components/Icons';
import { computeHabitStreak } from '@/services/HabitService';
import { playHabitChime, playMilestoneChime } from '@/services/chime';
import { getMorningStreakInfo, getStreakMessage } from '@/services/morningStreakService';
import type { Habit, HabitGoalCategory } from '@/types';

const CATEGORY_OPTIONS: { id: HabitGoalCategory; label: string }[] = [
    { id: 'health', label: 'Health' },
    { id: 'money', label: 'Money' },
    { id: 'family', label: 'Family' },
    { id: 'spiritual', label: 'Spiritual' },
    { id: 'learning', label: 'Learning' },
];

const MILESTONE_DAYS = [7, 14, 30];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ProgressPage() {
    const { user } = useAuthStore();
    const { habits, isLoading, fetchHabits, addHabit, removeHabit, toggleCompletion } = useHabitStore();

    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitCategory, setNewHabitCategory] = useState<HabitGoalCategory | ''>('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);

    // Morning streak
    const [streakInfo, setStreakInfo] = useState({ currentStreak: 0, totalCompletions: 0, completedToday: false, last7Days: [false, false, false, false, false, false, false] });

    useEffect(() => {
        if (user?.uid) {
            fetchHabits(user.uid);
        }
        setStreakInfo(getMorningStreakInfo());
    }, [user?.uid, fetchHabits]);

    // Get last 30 days for grid
    const last30Days = useMemo(() => {
        const days: string[] = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    }, []);

    const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Get last 7 day labels (actual day names)
    const last7DayLabels = useMemo(() => {
        const labels: string[] = [];
        const today = new Date();
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            labels.push(i === 0 ? '•' : dayNames[d.getDay()]);
        }
        return labels;
    }, []);

    async function handleAddHabit() {
        if (!user?.uid || !newHabitName.trim()) return;
        await addHabit(user.uid, newHabitName.trim(), newHabitCategory || undefined);
        setNewHabitName('');
        setNewHabitCategory('');
        setShowAddForm(false);
    }

    async function handleToggle(habitId: string, date: string, habit: Habit) {
        if (!user?.uid) return;
        await toggleCompletion(user.uid, habitId, date);

        // Check for milestone after toggling
        const updatedEntries = { ...habit.entries, [date]: !habit.entries[date] };
        if (updatedEntries[date]) {
            // Play soft chime on every completion
            playHabitChime();

            const streak = computeHabitStreak(updatedEntries);
            if (MILESTONE_DAYS.includes(streak)) {
                playMilestoneChime();
                setMilestoneMessage(`${streak}-day streak on "${habit.name}"! 🎉`);
                setShowConfetti(true);
                setTimeout(() => {
                    setShowConfetti(false);
                    setMilestoneMessage(null);
                }, 3000);
            }
        }
    }

    async function handleDeleteHabit(habitId: string) {
        if (!user?.uid) return;
        if (confirm('Delete this habit? This cannot be undone.')) {
            await removeHabit(user.uid, habitId);
        }
    }

    const streakMessage = getStreakMessage(streakInfo.currentStreak, streakInfo.completedToday);

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Confetti Overlay */}
            {showConfetti && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                    <div className="text-center animate-confetti">
                        <p className="text-6xl">🎉</p>
                        <p className="text-lg font-serif font-bold text-forest-700 mt-2 bg-parchment-100 px-4 py-2 rounded-lg shadow-lg">
                            {milestoneMessage}
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ProgressIcon className="w-6 h-6 text-forest-700" />
                    <h1 className="font-serif text-2xl font-bold text-forest-700">
                        Progress
                    </h1>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="p-2 rounded-lg bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors"
                    title="Add habit"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            {/* ── Morning Ritual Section ────────────────────── */}
            <section className="bg-gradient-to-br from-parchment-100 to-parchment-200 rounded-xl border border-forest-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BriefingIcon className="w-5 h-5 text-forest-600" />
                        <h2 className="font-serif text-base font-bold text-forest-700">
                            Morning Ritual
                        </h2>
                    </div>
                    {streakInfo.currentStreak > 0 && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                            🔥 {streakInfo.currentStreak} day{streakInfo.currentStreak !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <p className="text-xs text-forest-500 italic">
                    {streakMessage}
                </p>

                {/* Last 7 days row */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-forest-400 w-16 flex-shrink-0">Last 7 days</span>
                    <div className="flex items-center gap-1.5 flex-1">
                        {streakInfo.last7Days.map((done, i) => (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                                <div
                                    className={`w-5 h-5 rounded-md flex items-center justify-center ${
                                        done ? 'bg-forest-600' : 'bg-parchment-300 border border-forest-200'
                                    }`}
                                >
                                    {done && <CheckIcon className="w-3 h-3 text-parchment-100" />}
                                </div>
                                <span className="text-[9px] text-forest-400">{last7DayLabels[i]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {streakInfo.totalCompletions > 0 && (
                    <p className="text-xs text-forest-400">
                        {streakInfo.totalCompletions} total morning alignment{streakInfo.totalCompletions !== 1 ? 's' : ''}
                    </p>
                )}

                {!streakInfo.completedToday && (
                    <Link
                        href="/app/morning"
                        className="inline-flex items-center gap-2 text-xs font-semibold bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors px-4 py-2 rounded-full"
                    >
                        Start Today&rsquo;s Ritual →
                    </Link>
                )}
            </section>

            {/* Add Habit Form */}
            {showAddForm && (
                <div className="bg-parchment-100 rounded-xl border border-forest-100 p-4 space-y-3">
                    <input
                        type="text"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        className="input-field"
                        placeholder="e.g., Exercise, Drink water, Read..."
                        maxLength={100}
                    />
                    <select
                        value={newHabitCategory}
                        onChange={(e) => setNewHabitCategory(e.target.value as HabitGoalCategory)}
                        className="input-field"
                    >
                        <option value="">Category (optional)</option>
                        {CATEGORY_OPTIONS.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddHabit}
                            disabled={!newHabitName.trim()}
                            className="btn-primary flex-1 disabled:opacity-50"
                        >
                            Add Habit
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="btn-ghost flex-1"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Habits List */}
            {isLoading ? (
                <p className="text-sm text-forest-400 text-center py-8">Loading habits...</p>
            ) : habits.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-forest-500 font-serif text-lg">No habits tracked yet</p>
                    <p className="text-sm text-forest-400">Add a habit to start building consistency.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {habits.map(habit => {
                        const streak = computeHabitStreak(habit.entries);

                        return (
                            <div key={habit.id} className="bg-parchment-100 rounded-xl border border-forest-100 p-4 space-y-3">
                                {/* Habit Header */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-serif text-base font-bold text-forest-700">
                                            {habit.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {habit.goalCategory && (
                                                <span className="text-xs text-forest-400 bg-parchment-300 px-2 py-0.5 rounded-full">
                                                    {habit.goalCategory}
                                                </span>
                                            )}
                                            {streak > 0 && (
                                                <span className="text-xs font-medium text-amber-600">
                                                    🔥 {streak} day{streak !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteHabit(habit.id)}
                                        className="text-xs text-forest-400 hover:text-red-500 transition-colors"
                                        title="Delete habit"
                                    >
                                        Delete
                                    </button>
                                </div>

                                {/* Consistency Grid */}
                                <div className="flex flex-wrap gap-1">
                                    {last30Days.map(date => {
                                        const isCompleted = habit.entries[date] || false;
                                        const isToday = date === todayKey;

                                        return (
                                            <button
                                                key={date}
                                                onClick={() => handleToggle(habit.id, date, habit)}
                                                className={`habit-cell ${isCompleted ? 'completed' : 'empty'} ${
                                                    isToday ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                                                }`}
                                                title={`${date}${isCompleted ? ' ✓' : ''}`}
                                            >
                                                {isCompleted && (
                                                    <CheckIcon className="w-4 h-4 text-parchment-100 mx-auto" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Grid Legend */}
                                <div className="flex items-center gap-3 text-xs text-forest-400">
                                    <span>Last 30 days</span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-sm bg-forest-600 inline-block"></span> Done
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-sm bg-parchment-300 border border-forest-200 inline-block"></span> Missed
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Link back */}
            <div className="pt-4 border-t border-parchment-300">
                <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                    ← Back to Home
                </Link>
            </div>
        </div>
    );
}
