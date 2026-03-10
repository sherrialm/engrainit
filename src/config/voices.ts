/**
 * Voice Configuration
 *
 * Named voice identities with legacy alias mapping.
 * When a real TTS API is wired, voice IDs map to provider-specific voices.
 */

export interface VoiceOption {
    id: string;
    label: string;
    description: string;
    gender: 'male' | 'female' | 'neutral';
}

export const VOICE_OPTIONS: VoiceOption[] = [
    { id: 'david', label: 'David', description: 'Male — Warm and steady', gender: 'male' },
    { id: 'rachel', label: 'Rachel', description: 'Female — Bright and clear', gender: 'female' },
    { id: 'calm-mentor', label: 'Calm Mentor', description: 'Deep, reassuring', gender: 'neutral' },
    { id: 'focused-coach', label: 'Focused Coach', description: 'Energetic, direct', gender: 'neutral' },
];

/**
 * Legacy voice ID mapping.
 * Ensures existing loops with old voice IDs continue to work.
 */
const LEGACY_VOICE_MAP: Record<string, string> = {
    sage: 'calm-mentor',
    mentor: 'focused-coach',
    anchor: 'david',
    parent: 'rachel',
};

/**
 * Resolve a voice ID, mapping legacy IDs to current ones.
 */
export function resolveVoiceId(voiceId?: string): string {
    if (!voiceId) return 'david';
    return LEGACY_VOICE_MAP[voiceId] || voiceId;
}

/**
 * Get human-readable label for a voice ID (supports legacy).
 */
export function getVoiceLabel(voiceId?: string): string {
    const resolved = resolveVoiceId(voiceId);
    const voice = VOICE_OPTIONS.find(v => v.id === resolved);
    return voice ? voice.label : 'David';
}
