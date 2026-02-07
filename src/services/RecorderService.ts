/**
 * RecorderService - MediaRecorder wrapper for voice capture
 * 
 * Uses MediaRecorder API for high-fidelity voice recording.
 * Outputs WebM audio format (widely supported in browsers).
 */

export class RecorderService {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private isRecording: boolean = false;
    private startTime: number = 0;

    // Callbacks
    public onRecordingStateChange?: (isRecording: boolean) => void;
    public onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
    public onError?: (error: string) => void;
    public onTimeUpdate?: (seconds: number) => void;

    private timeUpdateInterval: NodeJS.Timeout | null = null;

    /**
     * Request microphone permission and initialize recorder
     */
    async requestPermission(): Promise<boolean> {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true, // Auto-gain control for consistent volume
                }
            });
            return true;
        } catch (error: any) {
            console.error('Microphone permission denied:', error);
            this.onError?.('Microphone permission denied. Please enable it in your browser settings.');
            return false;
        }
    }

    /**
     * Start recording
     */
    async start(): Promise<void> {
        if (this.isRecording) {
            console.warn('Already recording');
            return;
        }

        // Ensure we have permission
        if (!this.stream) {
            const hasPermission = await this.requestPermission();
            if (!hasPermission) return;
        }

        this.audioChunks = [];

        try {
            // Try different MIME types for compatibility
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = ''; // Let browser choose
                    }
                }
            }

            console.log('[Recorder] Using MIME type:', mimeType || 'default');

            if (mimeType) {
                this.mediaRecorder = new MediaRecorder(this.stream!, { mimeType });
            } else {
                this.mediaRecorder = new MediaRecorder(this.stream!);
            }

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('[Recorder] ondataavailable, data size:', event.data.size);
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('[Recorder] onstop fired, chunks:', this.audioChunks.length);
                const audioBlob = new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
                console.log('[Recorder] Created blob, size:', audioBlob.size);
                const duration = (Date.now() - this.startTime) / 1000;
                this.onRecordingComplete?.(audioBlob, duration);
                this.stopTimeUpdate();
            };

            this.mediaRecorder.onerror = (event: any) => {
                console.error('[Recorder] MediaRecorder error:', event);
                this.onError?.('Recording failed. Please try again.');
                this.stopRecording();
            };

            // Start recording - don't use timeslice, request data on stop instead
            this.mediaRecorder.start();
            console.log('[Recorder] MediaRecorder started, state:', this.mediaRecorder.state);

            this.startTime = Date.now();
            this.isRecording = true;
            this.onRecordingStateChange?.(true);
            this.startTimeUpdate();
        } catch (error: any) {
            console.error('[Recorder] Failed to start recording:', error);
            this.onError?.('Failed to start recording. Please try again.');
        }
    }

    /**
     * Stop recording
     */
    stop(): void {
        if (this.mediaRecorder && this.isRecording) {
            console.log('[Recorder] Stopping, requesting data first...');
            // Request final data before stopping
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.requestData();
            }
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.onRecordingStateChange?.(false);
        }
        this.stopTimeUpdate();
    }

    /**
     * Check if currently recording
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Get current recording duration in seconds
     */
    getCurrentDuration(): number {
        if (!this.isRecording) return 0;
        return (Date.now() - this.startTime) / 1000;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stopRecording();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    private stopRecording(): void {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.onRecordingStateChange?.(false);
        }
        this.stopTimeUpdate();
    }

    private startTimeUpdate(): void {
        this.stopTimeUpdate();
        this.timeUpdateInterval = setInterval(() => {
            if (this.isRecording && this.onTimeUpdate) {
                this.onTimeUpdate(this.getCurrentDuration());
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
let recorderInstance: RecorderService | null = null;

export function getRecorderService(): RecorderService {
    if (!recorderInstance) {
        recorderInstance = new RecorderService();
    }
    return recorderInstance;
}

/**
 * Convert Blob to base64 data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
