/**
 * Morning Streak Service — localStorage-based streak computation
 *
 * Reads `engrainit_morning_YYYY-MM-DD` keys from localStorage
 * to compute the user's current consecutive-day streak, total
 * lifetime morning completions, and whether today is complete.
 *
 * Browser-safe: returns safe defaults during SSR or when
 * localStorage is unavailable.
 */

export interface MorningStreakInfo {
    /** Consecutive days ending today (or yesterday if today not yet done) */
    currentStreak: number;
    /** Total number of days the morning ritual was completed */
    totalCompletions: number;
    /** Whether today's morning has been completed */
    completedToday: boolean;
    /** Last 7 days completion status (oldest → newest, ending today) */
    last7Days: boolean[];
}

const STORAGE_PREFIX = 'engrainit_morning_';

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
}

/**
 * Get morning streak information.
 * Safe to call during SSR — returns zeroed defaults.
 */
export function getMorningStreakInfo(): MorningStreakInfo {
    const defaults: MorningStreakInfo = {
        currentStreak: 0,
        totalCompletions: 0,
        completedToday: false,
        last7Days: [false, false, false, false, false, false, false],
    };

    if (!isBrowser()) return defaults;

    try {
        const today = new Date();
        const todayKey = formatDate(today);

        // Check today's completion
        const completedToday = localStorage.getItem(`${STORAGE_PREFIX}${todayKey}`) === 'done';

        // Scan up to 365 days back to find all completions
        const completedDates = new Set<string>();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = formatDate(d);
            if (localStorage.getItem(`${STORAGE_PREFIX}${key}`) === 'done') {
                completedDates.add(key);
            }
        }

        const totalCompletions = completedDates.size;

        // Compute streak: walk backwards from today
        let currentStreak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = formatDate(d);

            if (completedDates.has(key)) {
                currentStreak++;
            } else if (i === 0) {
                // Today not done yet — still check yesterday
                continue;
            } else {
                break;
            }
        }

        // Last 7 days (oldest → newest)
        const last7Days: boolean[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            last7Days.push(completedDates.has(formatDate(d)));
        }

        return { currentStreak, totalCompletions, completedToday, last7Days };
    } catch {
        return defaults;
    }
}

/**
 * Get an encouragement message based on streak length.
 */
export function getStreakMessage(streak: number, completedToday: boolean): string {
    if (!completedToday && streak === 0) {
        return 'Start your morning alignment to begin a streak.';
    }
    if (!completedToday && streak > 0) {
        return `You have a ${streak}-day streak going — don't break the chain!`;
    }
    if (streak >= 30) return 'Your daily practice is deeply engrained. Incredible consistency.';
    if (streak >= 14) return 'Two weeks strong. This is becoming part of who you are.';
    if (streak >= 7) return 'A full week of practice. Real momentum is building.';
    if (streak >= 3) return 'Three days in. The habit is taking root.';
    if (streak === 2) return 'Day two — consistency starts here.';
    if (streak === 1) return 'Day one complete. Come back tomorrow to build your streak.';
    return 'Your practice begins today.';
}
