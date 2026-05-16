/**
 * AudioEngine - Web Audio API wrapper for gapless looping
 * 
 * Uses Web Audio API for precise timing and gapless playback.
 * Falls back to HTMLAudioElement for voice recordings (webm/opus)
 * which decodeAudioData() cannot reliably handle.
 */

export class AudioEngine {
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private targetVolume: number = 1;

    // HTMLAudioElement fallback for voice recordings
    private htmlAudio: HTMLAudioElement | null = null;
    private usingHtmlAudio: boolean = false;

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
     * Load audio from a URL or base64 data using Web Audio API (decodeAudioData).
     * Best for TTS-generated audio (mp3/wav).
     */
    async loadAudio(source: string): Promise<void> {
        console.log('[AudioEngine] loadAudio called, source length:', source.length);

        // Clean up any prior HTMLAudioElement playback
        this.disposeHtmlAudio();
        this.usingHtmlAudio = false;

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
                if (!response.ok) {
                    console.error('[AudioEngine] Fetch failed:', response.status, response.statusText);
                    throw new Error(`Audio fetch failed (${response.status}). The file may have expired or been removed.`);
                }
                const contentType = response.headers.get('content-type');
                console.log('[AudioEngine] Response content-type:', contentType);
                arrayBuffer = await response.arrayBuffer();
                console.log('[AudioEngine] Fetched audio, buffer size:', arrayBuffer.byteLength);

                if (arrayBuffer.byteLength === 0) {
                    throw new Error('Fetched audio is empty (0 bytes).');
                }
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
     * Load audio using HTMLAudioElement — native browser playback.
     * Used for voice recordings (webm/opus) which decodeAudioData()
     * cannot reliably decode across browsers.
     *
     * NOTE: We do NOT set crossOrigin on the element. Firebase Storage
     * download URLs include an access token and don't require (or support)
     * CORS headers by default.  Setting crossOrigin = 'anonymous' causes
     * the browser to demand CORS headers, which Firebase won't send,
     * resulting in MEDIA_ELEMENT_ERROR: Format error.
     */
    async loadAudioAsElement(source: string): Promise<void> {
        console.log('[AudioEngine] loadAudioAsElement called, source length:', source.length);

        // Stop any Web Audio API playback
        this.stopSource();
        this.audioBuffer = null;

        // Clean up previous HTMLAudioElement
        this.disposeHtmlAudio();

        this.usingHtmlAudio = true;

        // Validate URL before attempting load
        if (!source || source.length === 0) {
            throw new Error('Audio source is empty');
        }

        return new Promise<void>((resolve, reject) => {
            const audio = new Audio();
            // Do NOT set crossOrigin — see note above
            audio.preload = 'auto';
            audio.loop = true;

            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
            };

            const onCanPlay = () => {
                cleanup();
                console.log('[AudioEngine] HTMLAudioElement ready — duration:', audio.duration, 'src length:', source.length);
                this.htmlAudio = audio;

                // Wire up time update
                audio.addEventListener('timeupdate', () => {
                    if (this.isPlaying && this.onTimeUpdate) {
                        this.onTimeUpdate(audio.currentTime);
                    }
                });

                resolve();
            };

            const onError = () => {
                cleanup();
                const errCode = audio.error?.code;
                const errMsg = audio.error?.message || 'Unknown HTMLAudioElement error';
                console.error('[AudioEngine] HTMLAudioElement load failed — code:', errCode, 'message:', errMsg, 'src:', source.substring(0, 80));
                reject(new Error(`Failed to load audio (code ${errCode}): ${errMsg}`));
            };

            audio.addEventListener('canplaythrough', onCanPlay);
            audio.addEventListener('error', onError);

            console.log('[AudioEngine] Setting HTMLAudioElement src (first 80 chars):', source.substring(0, 80));
            audio.src = source;
            audio.load();
        });
    }

    /**
     * Play the loaded audio.
     * @param loop — if true (default), the audio loops natively (gapless).
     *               Pass false when the SpacedRepetitionController manages
     *               the repeat cycle so native looping doesn't race the timer.
     */
    play(loop: boolean = true): void {
        if (this.usingHtmlAudio) {
            this.playHtmlAudio();
            return;
        }

        if (!this.audioContext || !this.audioBuffer || !this.gainNode) {
            console.error('Cannot play: audio not loaded');
            return;
        }

        // Stop any existing playback
        this.stopSource();

        // Create new source node
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.loop = loop;
        this.sourceNode.connect(this.gainNode);

        // Handle loop event
        this.sourceNode.onended = () => {
            if (this.isPlaying && this.onLoop) {
                this.onLoop();
            }
        };

        // Calculate offset if resuming from pause
        const offset = this.pauseTime % this.audioBuffer.duration;

        // Fade in over 200ms for smooth start
        const now = this.audioContext.currentTime;
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(this.targetVolume, now + 0.2);

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
        if (this.usingHtmlAudio) {
            this.pauseHtmlAudio();
            return;
        }

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
        if (this.usingHtmlAudio) {
            this.stopHtmlAudio();
            return;
        }

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
        if (this.usingHtmlAudio && this.htmlAudio) {
            return this.htmlAudio.currentTime;
        }

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
        if (this.usingHtmlAudio && this.htmlAudio) {
            const d = this.htmlAudio.duration;
            return isFinite(d) ? d : 0;
        }
        return this.audioBuffer?.duration || 0;
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        const clamped = Math.max(0, Math.min(1, volume));
        this.targetVolume = clamped;

        if (this.usingHtmlAudio && this.htmlAudio) {
            this.htmlAudio.volume = clamped;
        }

        if (this.gainNode && this.audioContext) {
            this.gainNode.gain.setValueAtTime(clamped, this.audioContext.currentTime);
        }
    }

    /**
     * Get the underlying AudioContext (for sharing with background audio)
     */
    getAudioContext(): AudioContext | null {
        return this.audioContext;
    }

    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Check if currently using HTMLAudioElement path
     */
    getIsUsingHtmlAudio(): boolean {
        return this.usingHtmlAudio;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stop();
        this.disposeHtmlAudio();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    // ── HTMLAudioElement playback helpers ──────────────────────

    private playHtmlAudio(): void {
        if (!this.htmlAudio) {
            console.error('[AudioEngine] Cannot play: HTMLAudioElement not loaded');
            return;
        }

        this.htmlAudio.volume = this.targetVolume;
        this.htmlAudio.play().then(() => {
            this.isPlaying = true;
            this.onPlayStateChange?.(true);
            console.log('[AudioEngine] HTMLAudioElement playing');
        }).catch((err) => {
            console.error('[AudioEngine] HTMLAudioElement play() rejected:', err);
        });
    }

    private pauseHtmlAudio(): void {
        if (!this.htmlAudio) return;
        this.htmlAudio.pause();
        this.isPlaying = false;
        this.onPlayStateChange?.(false);
    }

    private stopHtmlAudio(): void {
        if (!this.htmlAudio) return;
        this.htmlAudio.pause();
        this.htmlAudio.currentTime = 0;
        this.isPlaying = false;
        this.onPlayStateChange?.(false);
    }

    private disposeHtmlAudio(): void {
        if (this.htmlAudio) {
            this.htmlAudio.pause();
            this.htmlAudio.removeAttribute('src');
            this.htmlAudio.load(); // release resources
            this.htmlAudio = null;
        }
    }

    // ── Web Audio API helpers ─────────────────────────────────

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
        // Reset gain to target volume so next play starts at correct level
        if (this.gainNode && this.audioContext) {
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(this.targetVolume, this.audioContext.currentTime);
        }
        this.stopTimeUpdate();
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
