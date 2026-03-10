/**
 * BackgroundAudioEngine
 *
 * Manages a looping background ambience track on its own GainNode,
 * routed into a shared AudioContext so it mixes with the primary loop.
 *
 * Designed to never interfere with primary AudioEngine playback.
 */

export class BackgroundAudioEngine {
    private context: AudioContext;
    private gainNode: GainNode;
    private sourceNode: AudioBufferSourceNode | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private playing = false;
    private loadToken = 0; // race-condition guard for rapid track switching

    constructor(context: AudioContext) {
        this.context = context;
        this.gainNode = context.createGain();
        this.gainNode.gain.value = 0.25; // sensible default
        this.gainNode.connect(context.destination);
    }

    // ── Load ──────────────────────────────────────────────────

    async loadTrack(url: string): Promise<boolean> {
        // Increment token — only the latest load can commit its result
        const token = ++this.loadToken;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[BackgroundAudio] Track not found: ${url} (${res.status})`);
                return false;
            }

            const arrayBuffer = await res.arrayBuffer();

            // Stale load — a newer loadTrack() was called while we were fetching
            if (token !== this.loadToken) return false;

            this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            // Check again after decode (also async)
            if (token !== this.loadToken) return false;

            return true;
        } catch (err) {
            console.warn('[BackgroundAudio] Failed to load track:', err);
            if (token === this.loadToken) this.audioBuffer = null;
            return false;
        }
    }

    // ── Playback ──────────────────────────────────────────────

    play(): void {
        if (!this.audioBuffer || this.playing) return;

        this.stopSource();

        const source = this.context.createBufferSource();
        source.buffer = this.audioBuffer;
        source.loop = true;
        source.connect(this.gainNode);
        source.start(0);

        this.sourceNode = source;
        this.playing = true;
    }

    stop(): void {
        this.stopSource();
        this.playing = false;
    }

    // ── Volume ────────────────────────────────────────────────

    setVolume(v: number): void {
        this.gainNode.gain.value = Math.max(0, Math.min(1, v));
    }

    // ── State ─────────────────────────────────────────────────

    getIsPlaying(): boolean {
        return this.playing;
    }

    // ── Internal ──────────────────────────────────────────────

    private stopSource(): void {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch {
                // may already be stopped
            }
            this.sourceNode = null;
        }
    }
}
