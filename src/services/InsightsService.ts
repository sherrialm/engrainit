/**
 * InsightsService
 *
 * Computes reinforcement stats from session data.
 * Uses the existing SessionService for data fetching.
 */

import { getRecentSessions, computeReinforcementStreak, SessionRecord } from './SessionService';

// ── Types ─────────────────────────────────────────────────────

export interface ReinforcementStats {
    totalSessions: number;
    completedSessions: number;
    totalMinutesEngrained: number;
    currentStreak: number;
    longestStreak: number;
    favoriteModeId?: string;
    sessionsLast7Days: number[];
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function computeLongestStreak(sessions: SessionRecord[]): number {
    const completedDates = new Set<string>();
    for (const s of sessions) {
        if (s.completed) completedDates.add(s.dateKey);
    }

    if (completedDates.size === 0) return 0;

    // Sort dates ascending
    const sorted = Array.from(completedDates).sort();

    let longest = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        prev.setDate(prev.getDate() + 1);

        if (formatDate(prev) === sorted[i]) {
            current++;
            longest = Math.max(longest, current);
        } else {
            current = 1;
        }
    }

    return longest;
}

function getLast7DayKeys(): string[] {
    const keys: string[] = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
        const day = new Date(d);
        day.setDate(day.getDate() - i);
        keys.push(formatDate(day));
    }
    return keys;
}

// ── Public API ────────────────────────────────────────────────

export async function getReinforcementStats(uid: string): Promise<ReinforcementStats> {
    const sessions = await getRecentSessions(uid, 200);

    if (sessions.length === 0) {
        return {
            totalSessions: 0,
            completedSessions: 0,
            totalMinutesEngrained: 0,
            currentStreak: 0,
            longestStreak: 0,
            sessionsLast7Days: [0, 0, 0, 0, 0, 0, 0],
        };
    }

    // Totals
    const totalSessions = sessions.length;
    const completed = sessions.filter((s) => s.completed);
    const completedSessions = completed.length;

    // Minutes engrained (from completed sessions)
    const totalSeconds = completed.reduce((sum, s) => sum + (s.durationPlannedSec ?? 0), 0);
    const totalMinutesEngrained = Math.round(totalSeconds / 60);

    // Streaks
    const currentStreak = computeReinforcementStreak(sessions);
    const longestStreak = computeLongestStreak(sessions);

    // Favorite mode
    const modeCounts: Record<string, number> = {};
    for (const s of completed) {
        modeCounts[s.modeId] = (modeCounts[s.modeId] || 0) + 1;
    }
    let favoriteModeId: string | undefined;
    let maxCount = 0;
    for (const [modeId, count] of Object.entries(modeCounts)) {
        if (count > maxCount) {
            maxCount = count;
            favoriteModeId = modeId;
        }
    }

    // Last 7 days
    const dayKeys = getLast7DayKeys();
    const dayCounts: Record<string, number> = {};
    for (const s of sessions) {
        dayCounts[s.dateKey] = (dayCounts[s.dateKey] || 0) + 1;
    }
    const sessionsLast7Days = dayKeys.map((k) => dayCounts[k] || 0);

    return {
        totalSessions,
        completedSessions,
        totalMinutesEngrained,
        currentStreak,
        longestStreak,
        favoriteModeId,
        sessionsLast7Days,
    };
}
