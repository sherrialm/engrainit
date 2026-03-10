/**
 * Identity Modes
 *
 * Curated protocols that frame the engraining experience.
 * Each mode sets the loop interval to continuous (0) and
 * optionally configures background ambience defaults.
 */

export interface IdentityMode {
    id: string;
    label: string;
    icon: string;
    description: string;
    defaultIntervalSec: 0; // always continuous
    defaultAmbienceTrackId: string | null;
    defaultAmbienceVolume: number;
    defaultNightPresetId?: string;
    recommendedDurationMin?: number;
}

export const IDENTITY_MODES: IdentityMode[] = [
    {
        id: 'morning',
        label: 'Morning',
        icon: '🌅',
        description: 'Start the day with continuous affirmation reinforcement.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: null,
        defaultAmbienceVolume: 0,
        recommendedDurationMin: 10,
    },
    {
        id: 'focus',
        label: 'Focus',
        icon: '🎯',
        description: 'Deep concentration with pink noise underneath.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: 'pink-noise',
        defaultAmbienceVolume: 0.15,
        recommendedDurationMin: 20,
    },
    {
        id: 'reset',
        label: 'Reset',
        icon: '🧘',
        description: 'Mid-day mental reset with gentle rain.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: 'rain',
        defaultAmbienceVolume: 0.20,
        recommendedDurationMin: 10,
    },
    {
        id: 'night',
        label: 'Night',
        icon: '🌙',
        description: 'Bedtime session powered by Night Presets.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: 'brown-noise',
        defaultAmbienceVolume: 0.18,
        defaultNightPresetId: 'calm',
        recommendedDurationMin: 20,
    },
    {
        id: 'confidence',
        label: 'Confidence',
        icon: '💪',
        description: 'Reinforce strong self-belief with quiet focus.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: 'pink-noise',
        defaultAmbienceVolume: 0.12,
        recommendedDurationMin: 15,
    },
    {
        id: 'faith',
        label: 'Faith',
        icon: '🙏',
        description: 'Prayerful affirmation with soft background drone.',
        defaultIntervalSec: 0,
        defaultAmbienceTrackId: 'soft-drone',
        defaultAmbienceVolume: 0.15,
        recommendedDurationMin: 15,
    },
];
