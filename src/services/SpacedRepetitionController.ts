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

    // Callbacks
    public onIntervalStart?: (remainingSeconds: number) => void;
    public onIntervalTick?: (remainingSeconds: number) => void;
    public onIntervalEnd?: () => void;
    public onLoopComplete?: (loopCount: number) => void;
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
        this.intervalSeconds = Math.max(0, Math.min(300, seconds)); // 0s (continuous) to 5min

        // If we are currently counting down (not playing audio), update the countdown immediately
        if (this.isActive && this.remainingSeconds > 0) {
            this.clearTimers();

            if (this.intervalSeconds === 0) {
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
     * Start the spaced repetition session
     * Mode: Play audio in loop, then after user-defined interval, play again
     * For continuous mode: set intervalSeconds to 0
     */
    start(): void {
        if (this.isActive) return;

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

        // If interval is 0, just play continuously (gapless loop)
        if (this.intervalSeconds === 0) {
            this.audioEngine.play();
            this.broadcastState();
            return;
        }

        // Play audio once (we'll handle the loop manually for spaced repetition)
        // For now, play in loop mode and stop after duration for interval
        this.audioEngine.play();
        this.loopCount++;
        this.onLoopComplete?.(this.loopCount);
        this.broadcastState();

        // Schedule interval after one play cycle
        const duration = this.audioEngine.getDuration() || 5;

        // After one loop cycle, pause and start interval
        this.intervalTimer = setTimeout(() => {
            if (!this.isActive) return;

            this.audioEngine.pause();
            this.startCountdown(this.intervalSeconds);
        }, duration * 1000);
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
