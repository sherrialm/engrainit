'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/stores/audioStore';
import { useAuthStore } from '@/stores/authStore';
import { NIGHT_PRESETS, NightPreset } from '@/config/nightPresets';
import { getUserPreferences, setLastNightPresetId } from '@/services/UserPreferencesService';
import { startSession, endSession } from '@/services/SessionService';

// ── Constants ─────────────────────────────────────────────────

const DURATION_PRESETS = [10, 20, 30, 45, 60];
const FADE_PRESETS = [30, 60, 120];
const TICK_MS = 1000;

// ── Props ─────────────────────────────────────────────────────

interface NightSessionControlsProps {
    /** Callback to set the parent's repetition interval (for continuous looping) */
    onSetInterval?: (sec: number) => void;
    /** Active Identity Mode id — for session logging */
    activeMode?: string;
}

// ── Component ─────────────────────────────────────────────────

export default function NightSessionControls({ onSetInterval, activeMode = 'night' }: NightSessionControlsProps) {
    const {
        isPlaying,
        stop,
        masterVolume,
        setMasterVolume,
        backgroundVolume,
        setBackgroundVolume,
        setBackgroundEnabled,
        setBackgroundTrack,
        backgroundEnabled,
        setFadeInProgress,
        audioEngine,
        backgroundEngine,
    } = useAudioStore();

    const { user } = useAuthStore();

    // ── Config state ──────────────────────────────────────────
    const [enabled, setEnabled] = useState(false);
    const [durationMin, setDurationMin] = useState(20);
    const [fadeEnabled, setFadeEnabled] = useState(true);
    const [fadeSec, setFadeSec] = useState(60);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // ── Runtime state ─────────────────────────────────────────
    const [running, setRunning] = useState(false);
    const [remainingSec, setRemainingSec] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [fading, setFading] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    const savedVolumes = useRef<{ master: number; background: number } | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);

    // ── Cleanup helpers ───────────────────────────────────────
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const restoreVolumes = useCallback(() => {
        setFadeInProgress(false);
        if (savedVolumes.current) {
            setMasterVolume(savedVolumes.current.master);
            if (backgroundEnabled) {
                setBackgroundVolume(savedVolumes.current.background);
            }
            savedVolumes.current = null;
        }
        setFading(false);
    }, [setMasterVolume, setBackgroundVolume, backgroundEnabled, setFadeInProgress]);

    // ── Hydrate last preset from Firestore ────────────────────
    useEffect(() => {
        if (!user?.uid || hydrated) return;
        getUserPreferences(user.uid)
            .then((prefs) => {
                if (prefs.lastNightPresetId) {
                    const preset = NIGHT_PRESETS.find((p) => p.id === prefs.lastNightPresetId);
                    if (preset) {
                        setSelectedPresetId(preset.id);
                        // Don't auto-enable — just pre-select for convenience
                    }
                }
                setHydrated(true);
            })
            .catch((err) => {
                console.warn('[NightSession] Failed to load preset preference:', err);
                setHydrated(true);
            });
    }, [user?.uid, hydrated]);

    // ── Apply preset ──────────────────────────────────────────
    const applyPreset = useCallback((preset: NightPreset) => {
        setDurationMin(preset.durationMin);
        setFadeEnabled(preset.fadeEnabled);
        setFadeSec(preset.fadeSec);

        // Set interval to continuous
        onSetInterval?.(preset.recommendedIntervalSec);

        // Configure ambience
        setBackgroundEnabled(true);
        setBackgroundTrack(preset.ambienceTrackId);
        setBackgroundVolume(preset.ambienceVolume);
    }, [onSetInterval, setBackgroundEnabled, setBackgroundTrack, setBackgroundVolume]);

    const handlePresetChange = useCallback((presetId: string | null) => {
        setSelectedPresetId(presetId);

        if (presetId) {
            const preset = NIGHT_PRESETS.find((p) => p.id === presetId);
            if (preset) {
                setEnabled(true);
                setCompleted(false);

                // Only apply immediately if not currently running
                if (!running) {
                    applyPreset(preset);
                }
            }
        }

        // Persist
        if (user?.uid) {
            setLastNightPresetId(user.uid, presetId).catch((err) =>
                console.warn('[NightSession] Failed to save preset preference:', err)
            );
        }
    }, [running, applyPreset, user?.uid]);

    // ── Start session when playback begins ────────────────────
    useEffect(() => {
        if (!enabled || !isPlaying || running) return;

        const totalSec = durationMin * 60;
        setRemainingSec(totalSec);
        setRunning(true);
        setCompleted(false);
        setFading(false);
        savedVolumes.current = null;

        // Log session start
        if (user?.uid) {
            const { backgroundTrackId } = useAudioStore.getState();
            startSession(user.uid, {
                modeId: activeMode,
                sourceType: 'tts',
                durationPlannedSec: totalSec,
                trackId: backgroundEnabled ? (backgroundTrackId ?? undefined) : undefined,
            })
                .then((id) => { sessionIdRef.current = id; })
                .catch((err) => console.warn('[NightSession] Failed to log session start:', err));
        }
    }, [enabled, isPlaying, running, durationMin, user?.uid, activeMode, backgroundEnabled]);

    // ── Tick timer ────────────────────────────────────────────
    useEffect(() => {
        if (!running) return;

        timerRef.current = setInterval(() => {
            setRemainingSec((prev) => {
                const next = prev - 1;

                if (next <= 0) {
                    clearTimer();
                    restoreVolumes();
                    stop();
                    setRunning(false);
                    setCompleted(true);

                    // Log completed session
                    if (user?.uid && sessionIdRef.current) {
                        endSession(user.uid, sessionIdRef.current, { completed: true, endedReason: 'completed' })
                            .catch((err) => console.warn('[NightSession] Failed to log session end:', err));
                        sessionIdRef.current = null;
                    }

                    return 0;
                }

                if (fadeEnabled && next <= fadeSec) {
                    if (!savedVolumes.current) {
                        const store = useAudioStore.getState();
                        savedVolumes.current = {
                            master: store.masterVolume,
                            background: store.backgroundVolume,
                        };
                        setFading(true);
                        setFadeInProgress(true);
                    }

                    const t = next / fadeSec;
                    // Apply directly to engine (store setters defer during fade)
                    audioEngine?.setVolume(savedVolumes.current!.master * t);
                    if (backgroundEnabled && backgroundEngine) {
                        backgroundEngine.setVolume(savedVolumes.current!.background * t);
                    }
                }

                return next;
            });
        }, TICK_MS);

        return clearTimer;
    }, [running, fadeEnabled, fadeSec, backgroundEnabled, clearTimer, stop, setMasterVolume, setBackgroundVolume, restoreVolumes]);

    // ── Cancel on external stop ───────────────────────────────
    useEffect(() => {
        if (running && !isPlaying) {
            clearTimer();
            restoreVolumes();
            setRunning(false);

            // Log manually stopped session
            if (user?.uid && sessionIdRef.current) {
                endSession(user.uid, sessionIdRef.current, { completed: false, endedReason: 'stopped' })
                    .catch((err) => console.warn('[NightSession] Failed to log session end:', err));
                sessionIdRef.current = null;
            }
        }
    }, [running, isPlaying, clearTimer, restoreVolumes, user?.uid]);

    // ── Cleanup on unmount ────────────────────────────────────
    useEffect(() => {
        return () => { clearTimer(); };
    }, [clearTimer]);

    // ── Format helper ─────────────────────────────────────────
    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ── Collapsed ─────────────────────────────────────────────
    if (!enabled && !completed) {
        return (
            <div className="bg-parchment-200 rounded-lg p-3 border border-forest-100">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="mt-0.5 accent-forest-600"
                    />
                    <div>
                        <span className="text-sm text-forest-700 font-medium">🌙 Night Session</span>
                        <p className="text-xs text-forest-400 mt-0.5">Auto-stop playback after a set duration with gentle fade-out.</p>
                    </div>
                </label>
            </div>
        );
    }

    // ── Expanded ──────────────────────────────────────────────
    return (
        <div className="bg-parchment-200 rounded-lg p-4 border border-forest-100 space-y-3">
            {/* Enable toggle */}
            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                        const on = e.target.checked;
                        setEnabled(on);
                        if (!on && running) {
                            clearTimer();
                            restoreVolumes();
                            setRunning(false);

                            // Log cancelled session
                            if (user?.uid && sessionIdRef.current) {
                                endSession(user.uid, sessionIdRef.current, { completed: false, endedReason: 'stopped' })
                                    .catch(() => { });
                                sessionIdRef.current = null;
                            }
                        }
                        if (!on) {
                            setSelectedPresetId(null);
                        }
                        setCompleted(false);
                    }}
                    className="mt-0.5 accent-forest-600"
                />
                <div>
                    <span className="text-sm text-forest-700 font-medium">🌙 Night Session</span>
                    <p className="text-xs text-forest-400 mt-0.5">Auto-stop playback after a set duration with gentle fade-out.</p>
                </div>
            </label>

            {enabled && (
                <div className="space-y-3 pl-7">
                    {/* Preset selector */}
                    <div>
                        <label className="block text-xs font-medium text-forest-600 mb-1">Preset</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handlePresetChange(null)}
                                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${selectedPresetId === null
                                    ? 'bg-forest-700 text-parchment-100'
                                    : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                    }`}
                            >
                                Manual
                            </button>
                            {NIGHT_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handlePresetChange(p.id)}
                                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${selectedPresetId === p.id
                                        ? 'bg-forest-700 text-parchment-100'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {/* Preset description */}
                        {selectedPresetId && (
                            <p className="text-xs text-forest-400 mt-1">
                                {NIGHT_PRESETS.find((p) => p.id === selectedPresetId)?.description}
                            </p>
                        )}
                        {/* Pending notice if running */}
                        {running && selectedPresetId && (
                            <p className="text-xs text-amber-600 mt-1">Applies next time you press Play.</p>
                        )}
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-xs font-medium text-forest-600 mb-1">Duration</label>
                        <div className="flex flex-wrap gap-2">
                            {DURATION_PRESETS.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setDurationMin(m)}
                                    disabled={running}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${durationMin === m
                                        ? 'bg-forest-700 text-parchment-100'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                        } disabled:opacity-50`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fade toggle + duration */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fadeEnabled}
                            onChange={(e) => setFadeEnabled(e.target.checked)}
                            disabled={running}
                            className="accent-forest-600"
                        />
                        <span className="text-xs text-forest-600">Fade out over</span>
                        <select
                            value={fadeSec}
                            onChange={(e) => setFadeSec(Number(e.target.value))}
                            disabled={!fadeEnabled || running}
                            className="text-xs bg-parchment-300 border border-forest-100 rounded px-2 py-0.5 text-forest-700"
                        >
                            {FADE_PRESETS.map((s) => (
                                <option key={s} value={s}>
                                    {s >= 60 ? `${s / 60}m` : `${s}s`}
                                </option>
                            ))}
                        </select>
                    </label>

                    {/* Countdown */}
                    {running && (
                        <div className="text-xs text-forest-500 bg-forest-50 rounded-lg px-3 py-2 flex items-center gap-2">
                            <span className={fading ? 'animate-pulse' : ''}>🌙</span>
                            Night session ends in: <span className="font-mono font-medium text-forest-700">{formatTime(remainingSec)}</span>
                            {fading && <span className="text-forest-400 ml-1">(fading…)</span>}
                        </div>
                    )}
                </div>
            )}

            {/* Completion */}
            {completed && (
                <p className="text-xs text-forest-600 bg-forest-50 rounded-lg px-3 py-2">
                    ✅ Night session complete.
                </p>
            )}
        </div>
    );
}
