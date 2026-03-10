/**
 * ShareService
 *
 * Generates share data from existing insights and routine state.
 * No backend required.
 */

import { getReinforcementStats } from './InsightsService';
import { useRoutineStore } from '@/stores/routineStore';
import { IDENTITY_MODES } from '@/config/identityModes';

// ── Types ─────────────────────────────────────────────────────

export interface ShareData {
    streak: number;
    minutesEngrained: number;
    favoriteModeId?: string;
    favoriteModeName?: string;
    routineActive: boolean;
}

// ── Public API ────────────────────────────────────────────────

export async function generateShareData(uid: string): Promise<ShareData> {
    const stats = await getReinforcementStats(uid);
    const { activeRoutine } = useRoutineStore.getState();

    const mode = stats.favoriteModeId
        ? IDENTITY_MODES.find((m) => m.id === stats.favoriteModeId)
        : undefined;

    return {
        streak: stats.currentStreak,
        minutesEngrained: stats.totalMinutesEngrained,
        favoriteModeId: stats.favoriteModeId,
        favoriteModeName: mode?.label,
        routineActive: activeRoutine !== null,
    };
}

// ── Text Generator ────────────────────────────────────────────

export function generateShareText(data: ShareData): string {
    const parts: string[] = [];

    if (data.streak > 0) {
        parts.push(`I'm on a ${data.streak}-day reinforcement streak using EngrainIt.`);
    } else {
        parts.push('I just started my identity reinforcement journey with EngrainIt.');
    }

    if (data.minutesEngrained > 0) {
        parts.push(`${data.minutesEngrained} minutes engrained so far.`);
    }

    if (data.favoriteModeName) {
        parts.push(`Favorite mode: ${data.favoriteModeName}.`);
    }

    if (data.routineActive) {
        parts.push('Currently on a guided routine.');
    }

    return parts.join(' ');
}
