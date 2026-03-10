/**
 * Night Session presets
 *
 * Each preset auto-configures duration, fade, interval, and background ambience.
 * All presets use continuous looping (interval = 0) for bedtime NLP reinforcement.
 */

export interface NightPreset {
    id: string;
    label: string;
    description: string;
    durationMin: number;
    fadeEnabled: boolean;
    fadeSec: number;
    recommendedIntervalSec: 0; // always continuous
    ambienceTrackId: string;
    ambienceVolume: number;
}

export const NIGHT_PRESETS: NightPreset[] = [
    {
        id: 'calm',
        label: '🧘 Calm',
        description: '20-min gentle session with rain ambience',
        durationMin: 20,
        fadeEnabled: true,
        fadeSec: 60,
        recommendedIntervalSec: 0,
        ambienceTrackId: 'rain',
        ambienceVolume: 0.25,
    },
    {
        id: 'drift',
        label: '🌊 Drift',
        description: '30-min slow fade with soft drone',
        durationMin: 30,
        fadeEnabled: true,
        fadeSec: 120,
        recommendedIntervalSec: 0,
        ambienceTrackId: 'soft-drone',
        ambienceVolume: 0.20,
    },
    {
        id: 'deep-sleep',
        label: '😴 Deep Sleep',
        description: '45-min deep session with brown noise',
        durationMin: 45,
        fadeEnabled: true,
        fadeSec: 120,
        recommendedIntervalSec: 0,
        ambienceTrackId: 'brown-noise',
        ambienceVolume: 0.18,
    },
    {
        id: 'confidence',
        label: '💪 Confidence',
        description: '20-min focused session with pink noise',
        durationMin: 20,
        fadeEnabled: true,
        fadeSec: 60,
        recommendedIntervalSec: 0,
        ambienceTrackId: 'pink-noise',
        ambienceVolume: 0.15,
    },
];
