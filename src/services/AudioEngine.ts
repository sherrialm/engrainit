/**
 * AudioEngine - Web Audio API wrapper for gapless looping
 * 
 * Uses Web Audio API for precise timing and gapless playback.
 * Falls back to HTMLAudioElement if Web Audio is not available.
 */

export class AudioEngine {
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private pauseTime: number = 0;

    // Callbacks
    public onPlayStateChange?: (isPlaying: boolean) => void;
    public onTimeUpdate?: (currentTime: number) => void;
    public onLoop?: () => void;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initAudioContext();
        }
    }

    private initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        } catch (e) {
            console.error('Web Audio API not supported:', e);
        }
    }

    /**
     * Load audio from a URL or base64 data
     */
    async loadAudio(source: string): Promise<void> {
        console.log('[AudioEngine] loadAudio called, source length:', source.length);

        if (!this.audioContext) {
            console.error('[AudioEngine] AudioContext not initialized');
            throw new Error('AudioContext not initialized');
        }

        // Resume context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            console.log('[AudioEngine] Resuming suspended AudioContext');
            await this.audioContext.resume();
        }

        let arrayBuffer: ArrayBuffer;

        try {
            if (source.startsWith('data:')) {
                // Base64 encoded audio
                console.log('[AudioEngine] Decoding base64 audio...');
                const base64Data = source.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
                console.log('[AudioEngine] Base64 decoded, buffer size:', arrayBuffer.byteLength);
            } else {
                // URL
                console.log('[AudioEngine] Fetching audio from URL...');
                const response = await fetch(source);
                arrayBuffer = await response.arrayBuffer();
                console.log('[AudioEngine] Fetched audio, buffer size:', arrayBuffer.byteLength);
            }

            console.log('[AudioEngine] Decoding audio data...');
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('[AudioEngine] Audio decoded successfully, duration:', this.audioBuffer.duration);
        } catch (error: any) {
            console.error('[AudioEngine] Failed to load/decode audio:', error);
            throw new Error(`Failed to decode audio: ${error.message}. The audio format may not be supported.`);
        }
    }

    /**
     * Play the loaded audio in a loop
     */
    play(): void {
        if (!this.audioContext || !this.audioBuffer || !this.gainNode) {
            console.error('Cannot play: audio not loaded');
            return;
        }

        // Stop any existing playback
        this.stopSource();

        // Create new source node
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.loop = true;
        this.sourceNode.connect(this.gainNode);

        // Handle loop event
        this.sourceNode.onended = () => {
            if (this.isPlaying && this.onLoop) {
                this.onLoop();
            }
        };

        // Calculate offset if resuming from pause
        const offset = this.pauseTime % this.audioBuffer.duration;

        this.sourceNode.start(0, offset);
        this.startTime = this.audioContext.currentTime - offset;
        this.isPlaying = true;
        this.pauseTime = 0;

        this.onPlayStateChange?.(true);
        this.startTimeUpdate();
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (!this.audioContext || !this.isPlaying) return;

        this.pauseTime = this.getCurrentTime();
        this.stopSource();
        this.isPlaying = false;

        this.onPlayStateChange?.(false);
    }

    /**
     * Stop playback completely
     */
    stop(): void {
        this.stopSource();
        this.pauseTime = 0;
        this.isPlaying = false;

        this.onPlayStateChange?.(false);
    }

    /**
     * Toggle play/pause
     */
    toggle(): void {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Get current playback time
     */
    getCurrentTime(): number {
        if (!this.audioContext || !this.audioBuffer) return 0;

        if (this.isPlaying) {
            const elapsed = this.audioContext.currentTime - this.startTime;
            return elapsed % this.audioBuffer.duration;
        }

        return this.pauseTime % (this.audioBuffer?.duration || 1);
    }

    /**
     * Get audio duration
     */
    getDuration(): number {
        return this.audioBuffer?.duration || 0;
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    private stopSource(): void {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch {
                // Source may already be stopped
            }
            this.sourceNode = null;
        }
    }

    private timeUpdateInterval: NodeJS.Timeout | null = null;

    private startTimeUpdate(): void {
        this.stopTimeUpdate();
        this.timeUpdateInterval = setInterval(() => {
            if (this.isPlaying && this.onTimeUpdate) {
                this.onTimeUpdate(this.getCurrentTime());
            }
        }, 100);
    }

    private stopTimeUpdate(): void {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }
}

// Singleton instance
let audioEngineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
    if (!audioEngineInstance) {
        audioEngineInstance = new AudioEngine();
    }
    return audioEngineInstance;
}
