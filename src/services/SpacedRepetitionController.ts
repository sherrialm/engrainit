/**
 * SpacedRepetitionController - Interval-based repetition logic
 * 
 * Controls the "play → wait → repeat" cycle for spaced repetition.
 */

import { AudioEngine } from './AudioEngine';

export class SpacedRepetitionController {
    private audioEngine: AudioEngine;
    private intervalSeconds: number;
    private isActive: boolean = false;
    private intervalTimer: NodeJS.Timeout | null = null;
    private countdownTimer: NodeJS.Timeout | null = null;
    private remainingSeconds: number = 0;
    private loopCount: number = 0;
    private maxRepeats: number | null = null; // null = infinite
    private _htmlEndedHandler: (() => void) | null = null;

    // Callbacks
    public onIntervalStart?: (remainingSeconds: number) => void;
    public onIntervalTick?: (remainingSeconds: number) => void;
    public onIntervalEnd?: () => void;
    public onLoopComplete?: (loopCount: number, maxRepeats: number | null) => void;
    public onSessionComplete?: () => void;
    public onStateChange?: (isActive: boolean, isPlaying: boolean, intervalRemaining: number | null) => void;

    constructor(audioEngine: AudioEngine, intervalSeconds: number = 30) {
        this.audioEngine = audioEngine;
        this.intervalSeconds = intervalSeconds;
        this.setupAudioCallbacks();
    }

    private setupAudioCallbacks(): void {
        // When audio finishes a loop cycle (not used for gapless, but useful for single plays)
    }

    /**
     * Set the interval between repetitions
     */
    setInterval(seconds: number): void {
        const oldInterval = this.intervalSeconds;
        // Allow -1 (manual/no-repeat), 0 (continuous), or 1–300
        this.intervalSeconds = seconds === -1 ? -1 : Math.max(0, Math.min(300, seconds));
        console.log(`[SpacedRepetitionController] setInterval: ${oldInterval}s -> ${this.intervalSeconds}s`);

        // If we are currently counting down (not playing audio), update the countdown immediately
        if (this.isActive && this.remainingSeconds > 0) {
            console.log('[SpacedRepetitionController] Active countdown, restarting with new interval');
            this.clearTimers();

            if (this.intervalSeconds === -1) {
                // Switch to manual — stop repeating
                this.remainingSeconds = 0;
                this.stop();
            } else if (this.intervalSeconds === 0) {
                // Switch to continuous play now
                this.remainingSeconds = 0;
                this.playWithInterval();
            } else {
                // Restart countdown with new interval
                this.startCountdown(this.intervalSeconds);
            }
        }
    }

    /**
     * Get the current interval
     */
    getInterval(): number {
        return this.intervalSeconds;
    }

    /**
     * Set the maximum number of repeats (null = infinite)
     */
    setMaxRepeats(n: number | null): void {
        this.maxRepeats = n;
        console.log(`[SpacedRepetitionController] setMaxRepeats: ${n === null ? 'infinite' : n}`);
    }

    /**
     * Get current max repeats setting
     */
    getMaxRepeats(): number | null {
        return this.maxRepeats;
    }

    /**
     * Start the spaced repetition session
     * Mode: Play audio in loop, then after user-defined interval, play again
     * For continuous mode: set intervalSeconds to 0
     */
    start(): void {
        if (this.isActive) return;

        console.log('[SpacedRepetitionController] Starting session with interval:', this.intervalSeconds);
        this.isActive = true;
        this.loopCount = 0;
        this.playWithInterval();
    }

    /**
     * Stop the spaced repetition session
     */
    stop(): void {
        this.isActive = false;
        this.clearTimers();
        this.clearHtmlEndedListener();
        this.audioEngine.stop();
        this.remainingSeconds = 0;
        this.broadcastState();
    }

    /**
     * Pause the current session
     */
    pause(): void {
        if (!this.isActive) return;

        if (this.audioEngine.getIsPlaying()) {
            this.audioEngine.pause();
        }
        this.clearTimers();
        this.broadcastState();
    }

    /**
     * Resume the session
     */
    resume(): void {
        if (!this.isActive) return;

        if (this.remainingSeconds > 0) {
            // Resume interval countdown
            this.startCountdown(this.remainingSeconds);
        } else {
            // Resume audio playback
            this.audioEngine.play();
        }
        this.broadcastState();
    }

    /**
     * Toggle between play and pause
     */
    toggle(): void {
        if (!this.isActive) {
            this.start();
        } else if (this.audioEngine.getIsPlaying()) {
            this.pause();
        } else {
            this.resume();
        }
    }

    /**
     * Check if session is active
     */
    getIsActive(): boolean {
        return this.isActive;
    }

    /**
     * Get remaining interval seconds
     */
    getRemainingSeconds(): number {
        return this.remainingSeconds;
    }

    /**
     * Get total loop count
     */
    getLoopCount(): number {
        return this.loopCount;
    }

    private playWithInterval(): void {
        if (!this.isActive) return;

        // Clear any existing wait timer before starting a new cycle
        this.clearTimers();

        // Manual mode (-1): play once then stop — no auto-repeat
        if (this.intervalSeconds === -1) {
            console.log('[SpacedRepetitionController] Manual mode (-1), playing once then stopping');
            this.audioEngine.play(false);
            this.loopCount++;
            this.onLoopComplete?.(this.loopCount, this.maxRepeats);
            this.broadcastState();

            // After audio finishes, stop the session
            if (this.audioEngine.getIsUsingHtmlAudio()) {
                this.wireHtmlEnded(() => {
                    if (!this.isActive) return;
                    this.stop();
                    this.onSessionComplete?.();
                });
            } else {
                const duration = this.audioEngine.getDuration() || 5;
                this.intervalTimer = setTimeout(() => {
                    if (!this.isActive) return;
                    this.stop();
                    this.onSessionComplete?.();
                }, duration * 1000);
            }
            return;
        }

        // If interval is 0, just play continuously (gapless loop)
        if (this.intervalSeconds === 0) {
            console.log('[SpacedRepetitionController] Continuous mode (0s interval), enabling native loop');
            this.audioEngine.play(); // native loop = true
            this.broadcastState();
            return;
        }

        // Play audio ONCE — disable native looping so the audio doesn't
        // restart before our duration timer fires. Without this, the
        // Web Audio API source node (loop=true) races the setTimeout,
        // causing the user to hear the loop start a second time before
        // the controller can pause it.
        console.log('[SpacedRepetitionController] Playing audio once (no native loop), interval starts after play cycle');
        this.audioEngine.play(false);
        this.loopCount++;
        this.onLoopComplete?.(this.loopCount, this.maxRepeats);
        this.broadcastState();

        // Check if we've reached the max repeat count
        if (this.maxRepeats !== null && this.loopCount >= this.maxRepeats) {
            console.log(`[SpacedRepetitionController] Max repeats reached (${this.loopCount}/${this.maxRepeats}), will stop after this play`);
            // Let current play finish, then stop (don't schedule interval)
            if (this.audioEngine.getIsUsingHtmlAudio()) {
                this.wireHtmlEnded(() => {
                    if (!this.isActive) return;
                    this.stop();
                    this.onSessionComplete?.();
                });
            } else {
                const duration = this.audioEngine.getDuration() || 5;
                this.intervalTimer = setTimeout(() => {
                    if (!this.isActive) return;
                    this.stop();
                    // Notify playlist store so it can advance to next loop
                    this.onSessionComplete?.();
                }, duration * 1000);
            }
            return;
        }

        // Schedule interval after one play cycle
        if (this.audioEngine.getIsUsingHtmlAudio()) {
            // Voice recordings: duration metadata unreliable for webm/opus.
            // Listen for the actual HTMLAudioElement 'ended' event instead.
            console.log('[SpacedRepetitionController] HTML audio — waiting for ended event to start interval');
            this.wireHtmlEnded(() => {
                if (!this.isActive) return;
                console.log(`[SpacedRepetitionController] Play cycle complete, starting ${this.intervalSeconds}s interval`);
                this.startCountdown(this.intervalSeconds);
            });
        } else {
            // TTS (Web Audio API): duration is always accurate — keep existing setTimeout
            const duration = this.audioEngine.getDuration() || 5;
            console.log(`[SpacedRepetitionController] Audio duration: ${duration}s, scheduling interval in ${duration}s`);

            // After one play cycle, pause and start interval countdown
            this.intervalTimer = setTimeout(() => {
                if (!this.isActive) return;

                console.log(`[SpacedRepetitionController] Play cycle complete, starting ${this.intervalSeconds}s interval`);
                this.audioEngine.pause();
                this.startCountdown(this.intervalSeconds);
            }, duration * 1000);
        }
    }

    private startCountdown(seconds: number): void {
        this.remainingSeconds = seconds;
        this.onIntervalStart?.(this.remainingSeconds);
        this.broadcastState();

        this.countdownTimer = setInterval(() => {
            if (!this.isActive) {
                this.clearTimers();
                return;
            }

            this.remainingSeconds--;
            this.onIntervalTick?.(this.remainingSeconds);
            this.broadcastState();

            if (this.remainingSeconds <= 0) {
                this.clearTimers();
                this.onIntervalEnd?.();
                this.playWithInterval(); // Start next loop
            }
        }, 1000);
    }

    private clearTimers(): void {
        if (this.intervalTimer) {
            clearTimeout(this.intervalTimer);
            this.intervalTimer = null;
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    /**
     * Wire a one-shot 'ended' listener on the HTMLAudioElement inside AudioEngine.
     * Uses the same (engine as any).htmlAudio cast that audioStore already uses.
     * Sets htmlAudio.loop = false so the 'ended' event actually fires.
     */
    private wireHtmlEnded(callback: () => void): void {
        this.clearHtmlEndedListener();
        const htmlAudio = (this.audioEngine as any).htmlAudio as HTMLAudioElement | null;
        if (!htmlAudio) return;
        htmlAudio.loop = false;
        this._htmlEndedHandler = () => {
            this._htmlEndedHandler = null;
            callback();
        };
        htmlAudio.addEventListener('ended', this._htmlEndedHandler, { once: true });
    }

    /**
     * Remove any pending 'ended' listener so it doesn't fire after stop/cleanup.
     */
    private clearHtmlEndedListener(): void {
        if (this._htmlEndedHandler) {
            const htmlAudio = (this.audioEngine as any).htmlAudio as HTMLAudioElement | null;
            if (htmlAudio) {
                htmlAudio.removeEventListener('ended', this._htmlEndedHandler);
            }
            this._htmlEndedHandler = null;
        }
    }

    private broadcastState(): void {
        this.onStateChange?.(
            this.isActive,
            this.audioEngine.getIsPlaying(),
            this.remainingSeconds > 0 ? this.remainingSeconds : null
        );
    }

    /**
     * Clean up
     */
    dispose(): void {
        this.stop();
    }
}
