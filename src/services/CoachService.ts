/**
 * CoachService
 *
 * Adaptive Identity Coach — deterministic behavioral analysis
 * and personalized guidance based on session data.
 * No LLM dependency; pure rule-based logic.
 */

import { getReinforcementStats, ReinforcementStats } from './InsightsService';
import { getRecentSessions, SessionRecord } from './SessionService';
import { IDENTITY_MODES } from '@/config/identityModes';

// ── Types ─────────────────────────────────────────────────────

export type ConsistencyLevel = 'low' | 'growing' | 'strong';

export type SuggestedAction =
    | 'start_streak'
    | 'extend_streak'
    | 'balance_identity'
    | 'increase_duration'
    | 'maintain';

export interface CoachInsight {
    primaryMode?: string;
    weakestMode?: string;
    consistencyLevel: ConsistencyLevel;
    suggestedAction: SuggestedAction;
}

// ── Analysis ──────────────────────────────────────────────────

function computeConsistency(stats: ReinforcementStats): ConsistencyLevel {
    const weekTotal = stats.sessionsLast7Days.reduce((a, b) => a + b, 0);

    if (stats.currentStreak >= 5 || weekTotal >= 6) return 'strong';
    if (stats.currentStreak >= 1 || weekTotal >= 3) return 'growing';
    return 'low';
}

function computeModeUsage(sessions: SessionRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
        if (s.completed) {
            counts[s.modeId] = (counts[s.modeId] || 0) + 1;
        }
    }
    return counts;
}

function findWeakestMode(modeCounts: Record<string, number>): string | undefined {
    const allModeIds = IDENTITY_MODES.map((m) => m.id);
    let weakest: string | undefined;
    let minCount = Infinity;

    for (const modeId of allModeIds) {
        const count = modeCounts[modeId] || 0;
        if (count < minCount) {
            minCount = count;
            weakest = modeId;
        }
    }

    return weakest;
}

function isBalanced(modeCounts: Record<string, number>): boolean {
    const values = IDENTITY_MODES.map((m) => modeCounts[m.id] || 0);
    if (values.every((v) => v === 0)) return true;

    const max = Math.max(...values);
    const min = Math.min(...values);
    // Balanced if difference between most and least used ≤ 2
    return max - min <= 2;
}

function computeSuggestedAction(
    consistency: ConsistencyLevel,
    modeCounts: Record<string, number>,
    stats: ReinforcementStats
): SuggestedAction {
    if (consistency === 'low') return 'start_streak';
    if (consistency === 'growing') return 'extend_streak';

    // Strong consistency
    if (!isBalanced(modeCounts)) return 'balance_identity';

    // Check average duration — if high sessions but short duration, suggest longer
    if (stats.completedSessions > 0) {
        const avgMinutes = stats.totalMinutesEngrained / stats.completedSessions;
        if (avgMinutes < 10) return 'increase_duration';
    }

    return 'maintain';
}

// ── Public API ────────────────────────────────────────────────

export async function getCoachInsights(uid: string): Promise<CoachInsight> {
    const [stats, sessions] = await Promise.all([
        getReinforcementStats(uid),
        getRecentSessions(uid, 200),
    ]);

    if (stats.totalSessions === 0) {
        return {
            consistencyLevel: 'low',
            suggestedAction: 'start_streak',
        };
    }

    const modeCounts = computeModeUsage(sessions);
    const consistency = computeConsistency(stats);
    const suggestedAction = computeSuggestedAction(consistency, modeCounts, stats);

    // Primary = most used, weakest = least used
    let primaryMode: string | undefined;
    let maxCount = 0;
    for (const [modeId, count] of Object.entries(modeCounts)) {
        if (count > maxCount) {
            maxCount = count;
            primaryMode = modeId;
        }
    }

    const weakestMode = findWeakestMode(modeCounts);

    return {
        primaryMode,
        weakestMode,
        consistencyLevel: consistency,
        suggestedAction,
    };
}

// ── Message Generator ─────────────────────────────────────────

const ACTION_BADGES: Record<SuggestedAction, string> = {
    start_streak: 'Start a Streak',
    extend_streak: 'Extend Your Streak',
    balance_identity: 'Balance Identity',
    increase_duration: 'Go Deeper',
    maintain: 'Stay Consistent',
};

export function getActionBadge(action: SuggestedAction): string {
    return ACTION_BADGES[action];
}

export function generateCoachMessage(insight: CoachInsight): string {
    const primaryLabel = insight.primaryMode
        ? IDENTITY_MODES.find((m) => m.id === insight.primaryMode)?.label
        : undefined;
    const weakestLabel = insight.weakestMode
        ? IDENTITY_MODES.find((m) => m.id === insight.weakestMode)?.label
        : undefined;

    switch (insight.suggestedAction) {
        case 'start_streak':
            return 'Begin with a short nightly session to start your reinforcement streak.';

        case 'extend_streak':
            return 'You\'re building consistency. Reinforce again today to grow momentum.';

        case 'balance_identity':
            return primaryLabel && weakestLabel
                ? `You reinforce ${primaryLabel} often. Consider adding ${weakestLabel} sessions for a more rounded practice.`
                : 'Consider diversifying your reinforcement across different identity modes.';

        case 'increase_duration':
            return 'Your consistency is strong. Longer sessions may deepen the reinforcement effect.';

        case 'maintain':
            return 'Your reinforcement rhythm is strong. Stay consistent and trust the process.';

        default:
            return 'Keep reinforcing. Every session shapes your identity.';
    }
}
