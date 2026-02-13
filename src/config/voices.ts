export const VOICE_OPTIONS = [
    { id: 'sage', label: '🧘 Sage', description: 'Deep, calm' },
    { id: 'mentor', label: '📖 Mentor', description: 'Bright, clear' },
    { id: 'anchor', label: '⚓ Anchor', description: 'Low, steady' },
    { id: 'parent', label: '💝 Parent', description: 'Soft, warm' },
];

export function getVoiceLabel(voiceId?: string): string {
    const voice = VOICE_OPTIONS.find(v => v.id === voiceId);
    return voice ? voice.label : '🧘 Sage';
}
