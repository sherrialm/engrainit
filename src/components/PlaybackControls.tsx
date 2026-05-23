'use client';

/**
 * PlaybackControls — Reusable playback control panel
 *
 * Used in:
 * - Generate result step (before saving)
 * - Vault now-playing bar
 * - Session active view
 *
 * Controls: Voice selector, Interval, Repeat count, Play/Pause/Stop
 */

import { useAudioStore } from '@/stores/audioStore';
import { VOICE_OPTIONS, getVoiceLabel } from '@/config/voices';

// ── Interval presets ──────────────────────────────────────────

const INTERVAL_PRESETS = [
    { label: '0s', value: 0, title: 'Continuous (no gap)' },
    { label: '5s', value: 5, title: '5 second gap' },
    { label: '10s', value: 10, title: '10 second gap' },
    { label: '30s', value: 30, title: '30 second gap' },
    { label: '60s', value: 60, title: '1 minute gap' },
    { label: 'Manual', value: -1, title: 'Do not auto-repeat' },
];

// ── Repeat presets ────────────────────────────────────────────

const REPEAT_PRESETS: { label: string; value: number | null; title: string }[] = [
    { label: '3', value: 3, title: '3 repeats' },
    { label: '5', value: 5, title: '5 repeats' },
    { label: '10', value: 10, title: '10 repeats' },
    { label: '∞', value: null, title: 'Infinite repeats' },
];

// ── Component ─────────────────────────────────────────────────

interface PlaybackControlsProps {
    /** Currently selected voice ID */
    voiceId?: string;
    /** Callback when voice changes (for pre-save scenarios) */
    onVoiceChange?: (voiceId: string) => void;
    /** Current interval in seconds */
    intervalSeconds?: number;
    /** Callback when interval changes */
    onIntervalChange?: (seconds: number) => void;
    /** Whether to show the voice selector */
    showVoice?: boolean;
    /** Compact layout for inline use */
    compact?: boolean;
}

export default function PlaybackControls({
    voiceId,
    onVoiceChange,
    intervalSeconds,
    onIntervalChange,
    showVoice = true,
    compact = false,
}: PlaybackControlsProps) {
    const {
        isPlaying,
        currentLoop,
        repeatCount,
        currentRepeat,
        setRepeatCount,
        setInterval: setAudioInterval,
        toggle,
        stop,
    } = useAudioStore();

    const activeInterval = intervalSeconds ?? currentLoop?.intervalSeconds ?? 30;

    function handleIntervalChange(seconds: number) {
        if (onIntervalChange) {
            onIntervalChange(seconds);
        } else {
            setAudioInterval(seconds);
        }
    }

    const containerClass = compact
        ? 'space-y-3'
        : 'space-y-4 bg-parchment-100 rounded-xl border border-forest-100 p-4';

    return (
        <div className={containerClass}>
            {/* Voice Selector */}
            {showVoice && (
                <div>
                    <label className="block text-xs font-medium text-forest-500 mb-1.5">
                        Voice
                    </label>
                    <select
                        value={voiceId || currentLoop?.voiceId || 'david'}
                        onChange={(e) => onVoiceChange?.(e.target.value)}
                        disabled={!onVoiceChange}
                        className="input-field py-2 text-sm"
                    >
                        {VOICE_OPTIONS.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                                {voice.label} — {voice.description}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Interval Selector */}
            <div>
                <label className="block text-xs font-medium text-forest-500 mb-1.5">
                    Interval Between Repeats
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {INTERVAL_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            type="button"
                            onClick={() => handleIntervalChange(preset.value)}
                            title={preset.title}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                                activeInterval === preset.value
                                    ? 'bg-forest-700 text-parchment-100'
                                    : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Repeat Count */}
            <div>
                <label className="block text-xs font-medium text-forest-500 mb-1.5">
                    Number of Repeats
                    {repeatCount !== null && currentRepeat > 0 && (
                        <span className="ml-2 text-amber-600 font-semibold">
                            Play {currentRepeat} of {repeatCount}
                        </span>
                    )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {REPEAT_PRESETS.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => setRepeatCount(preset.value)}
                            title={preset.title}
                            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                                repeatCount === preset.value
                                    ? 'bg-forest-700 text-parchment-100'
                                    : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transport Controls — only when something is loaded */}
            {currentLoop && (
                <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                        onClick={toggle}
                        className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${
                            isPlaying
                                ? 'bg-amber-500 text-forest-900 hover:bg-amber-400'
                                : 'bg-forest-700 text-parchment-100 hover:bg-forest-600'
                        }`}
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button
                        onClick={stop}
                        className="px-4 py-2.5 rounded-full text-sm font-medium text-forest-500 bg-parchment-300 hover:bg-parchment-400 transition-colors"
                    >
                        ⏹ Stop
                    </button>
                </div>
            )}
        </div>
    );
}
