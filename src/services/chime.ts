/**
 * Chime — Lightweight audio feedback using Web Audio API
 *
 * No external audio files needed. Generates tones programmatically.
 * Three chime types:
 * - Completion: soft ascending 3-note tone (morning flow / session done)
 * - Habit: single soft ping (habit checkbox toggle)
 * - Milestone: richer chord (7/14/30-day streaks)
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
}

function playTone(
    frequency: number,
    duration: number,
    startTime: number,
    gain: number = 0.15,
    type: OscillatorType = 'sine',
) {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

/**
 * Soft ascending 3-note chime — completion of morning flow or session.
 */
export function playCompletionChime(): void {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // C5 → E5 → G5 (ascending major triad)
        playTone(523.25, 0.4, now, 0.12);
        playTone(659.25, 0.4, now + 0.15, 0.12);
        playTone(783.99, 0.6, now + 0.30, 0.14);
    } catch (err) {
        console.warn('[Chime] Completion chime failed:', err);
    }
}

/**
 * Single soft ping — habit checkbox toggle.
 */
export function playHabitChime(): void {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Single E5 ping
        playTone(659.25, 0.25, now, 0.08);
    } catch (err) {
        console.warn('[Chime] Habit chime failed:', err);
    }
}

/**
 * Richer chord — milestone celebration (7/14/30 day streaks).
 */
export function playMilestoneChime(): void {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // C major chord with octave → C5 + E5 + G5 + C6
        playTone(523.25, 0.8, now, 0.10);
        playTone(659.25, 0.8, now, 0.10);
        playTone(783.99, 0.8, now, 0.10);
        playTone(1046.50, 1.0, now + 0.2, 0.12, 'triangle');
    } catch (err) {
        console.warn('[Chime] Milestone chime failed:', err);
    }
}
