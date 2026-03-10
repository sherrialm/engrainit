/**
 * RoutineService
 *
 * Generates structured multi-day reinforcement routines
 * based on CoachService insights. Deterministic, no AI.
 */

import { CoachInsight, SuggestedAction } from './CoachService';
import { TEMPLATES, Template } from '@/config/templates';
import { IDENTITY_MODES } from '@/config/identityModes';

// ── Types ─────────────────────────────────────────────────────

export interface RoutineSession {
    day: number;
    modeId: string;
    templateId?: string;
    recommendedDurationMin: number;
}

export interface Routine {
    title: string;
    days: number;
    sessions: RoutineSession[];
}

// ── Helpers ───────────────────────────────────────────────────

/** Pick the first template matching a modeId, cycling through available ones */
function pickTemplates(modeId: string, count: number): string[] {
    const pool = TEMPLATES.filter((t) => t.modeId === modeId);
    if (pool.length === 0) return [];
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
        ids.push(pool[i % pool.length].id);
    }
    return ids;
}

function getModeLabel(modeId: string): string {
    return IDENTITY_MODES.find((m) => m.id === modeId)?.label || modeId;
}

// ── Generator ─────────────────────────────────────────────────

export function generateRoutine(insight: CoachInsight): Routine {
    const primary = insight.primaryMode || 'night';
    const weakest = insight.weakestMode || 'reset';

    switch (insight.suggestedAction) {
        case 'start_streak':
            return buildStartStreak(primary, weakest);
        case 'extend_streak':
            return buildExtendStreak(primary);
        case 'balance_identity':
            return buildBalanceIdentity(primary, weakest);
        case 'increase_duration':
            return buildIncreaseDuration(primary);
        case 'maintain':
        default:
            return buildMaintain(primary, weakest);
    }
}

// ── Routine Builders ──────────────────────────────────────────

function buildStartStreak(primary: string, weakest: string): Routine {
    // 3-day routine using night/reset modes, 10–15 min
    const modeId = ['night', 'reset'].includes(primary) ? primary : 'night';
    const templates = pickTemplates(modeId, 3);

    return {
        title: 'Start Your Streak',
        days: 3,
        sessions: [
            { day: 1, modeId, templateId: templates[0], recommendedDurationMin: 10 },
            { day: 2, modeId, templateId: templates[1], recommendedDurationMin: 12 },
            { day: 3, modeId, templateId: templates[2], recommendedDurationMin: 15 },
        ],
    };
}

function buildExtendStreak(primary: string): Routine {
    // 5-day routine with primary mode, gradually increasing duration
    const templates = pickTemplates(primary, 5);

    return {
        title: `${getModeLabel(primary)} Momentum`,
        days: 5,
        sessions: [
            { day: 1, modeId: primary, templateId: templates[0], recommendedDurationMin: 10 },
            { day: 2, modeId: primary, templateId: templates[1], recommendedDurationMin: 12 },
            { day: 3, modeId: primary, templateId: templates[2], recommendedDurationMin: 15 },
            { day: 4, modeId: primary, templateId: templates[3], recommendedDurationMin: 18 },
            { day: 5, modeId: primary, templateId: templates[4], recommendedDurationMin: 20 },
        ],
    };
}

function buildBalanceIdentity(primary: string, weakest: string): Routine {
    // 5-day alternating primary ↔ weakest
    const primaryTemplates = pickTemplates(primary, 3);
    const weakestTemplates = pickTemplates(weakest, 2);

    return {
        title: `Balance: ${getModeLabel(primary)} + ${getModeLabel(weakest)}`,
        days: 5,
        sessions: [
            { day: 1, modeId: primary, templateId: primaryTemplates[0], recommendedDurationMin: 15 },
            { day: 2, modeId: weakest, templateId: weakestTemplates[0], recommendedDurationMin: 12 },
            { day: 3, modeId: primary, templateId: primaryTemplates[1], recommendedDurationMin: 15 },
            { day: 4, modeId: weakest, templateId: weakestTemplates[1], recommendedDurationMin: 12 },
            { day: 5, modeId: primary, templateId: primaryTemplates[2], recommendedDurationMin: 18 },
        ],
    };
}

function buildIncreaseDuration(primary: string): Routine {
    // 5-day with the same mode, increasing duration from 15 to 30
    const templates = pickTemplates(primary, 5);

    return {
        title: `${getModeLabel(primary)} Deep Practice`,
        days: 5,
        sessions: [
            { day: 1, modeId: primary, templateId: templates[0], recommendedDurationMin: 15 },
            { day: 2, modeId: primary, templateId: templates[1], recommendedDurationMin: 18 },
            { day: 3, modeId: primary, templateId: templates[2], recommendedDurationMin: 22 },
            { day: 4, modeId: primary, templateId: templates[3], recommendedDurationMin: 25 },
            { day: 5, modeId: primary, templateId: templates[4], recommendedDurationMin: 30 },
        ],
    };
}

function buildMaintain(primary: string, weakest: string): Routine {
    // 7-day mixed routine across different modes
    const allModes = IDENTITY_MODES.map((m) => m.id);
    // Ensure primary and weakest are first, then cycle remaining
    const ordered = [primary, weakest, ...allModes.filter((m) => m !== primary && m !== weakest)];

    const sessions: RoutineSession[] = [];
    for (let i = 0; i < 7; i++) {
        const modeId = ordered[i % ordered.length];
        const templates = pickTemplates(modeId, 1);
        sessions.push({
            day: i + 1,
            modeId,
            templateId: templates[0],
            recommendedDurationMin: 15,
        });
    }

    return {
        title: 'Full Identity Routine',
        days: 7,
        sessions,
    };
}
