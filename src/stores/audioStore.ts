import { create } from 'zustand';
import { Loop, PlaybackState } from '@/types';
import { AudioEngine, getAudioEngine } from '@/services/AudioEngine';
import { SpacedRepetitionController } from '@/services/SpacedRepetitionController';

interface AudioState extends PlaybackState {
    // Services (initialized lazily)
    audioEngine: AudioEngine | null;
    spacedController: SpacedRepetitionController | null;

    // Actions
    initializeAudio: () => void;
    loadAndPlay: (loop: Loop) => Promise<void>;
    loadFromUrl: (url: string, loop?: Partial<Loop>) => Promise<void>;
    loadFromBase64: (base64: string, loop?: Partial<Loop>) => Promise<void>;
    play: () => void;
    pause: () => void;
    stop: () => void;
    toggle: () => void;
    setInterval: (seconds: number) => void;
    setVolume: (volume: number) => void;
    startSpacedRepetition: () => void;
    stopSpacedRepetition: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
    // Initial state
    isPlaying: false,
    isPaused: false,
    currentLoop: null,
    currentTime: 0,
    duration: 0,
    intervalRemaining: null,
    audioEngine: null,
    spacedController: null,

    initializeAudio: () => {
        if (typeof window === 'undefined') return;

        const state = get();
        if (state.audioEngine) return; // Already initialized

        const engine = getAudioEngine();
        const controller = new SpacedRepetitionController(engine, 30);

        // Set up callbacks
        engine.onPlayStateChange = (isPlaying) => {
            set({ isPlaying, isPaused: !isPlaying });
        };

        engine.onTimeUpdate = (currentTime) => {
            set({ currentTime });
        };

        controller.onStateChange = (isActive, isPlaying, intervalRemaining) => {
            set({ isPlaying, isPaused: !isPlaying, intervalRemaining });
        };

        set({ audioEngine: engine, spacedController: controller });
    },

    loadAndPlay: async (loop: Loop) => {
        const { audioEngine } = get();
        if (!audioEngine) {
            get().initializeAudio();
        }

        const engine = get().audioEngine!;

        try {
            await engine.loadAudio(loop.audioUrl);
            set({
                currentLoop: loop,
                duration: engine.getDuration(),
                currentTime: 0
            });

            // Sync interval
            if (get().spacedController) {
                get().spacedController!.setInterval(loop.intervalSeconds);
            }

            engine.play();
        } catch (error) {
            console.error('Failed to load audio:', error);
            throw error;
        }
    },

    loadFromUrl: async (url: string, loopData?: Partial<Loop>) => {
        const { audioEngine } = get();
        if (!audioEngine) {
            get().initializeAudio();
        }

        const engine = get().audioEngine!;

        try {
            await engine.loadAudio(url);
            const duration = engine.getDuration();

            // Create a temporary loop object
            const tempLoop: Loop = {
                id: 'temp-' + Date.now(),
                userId: '',
                title: loopData?.title || 'Untitled Loop',
                category: loopData?.category || 'study',
                sourceType: loopData?.sourceType || 'tts',
                text: loopData?.text,
                audioUrl: url,
                duration,
                intervalSeconds: loopData?.intervalSeconds ?? 30,
                createdAt: new Date(),
                updatedAt: new Date(),
                playCount: 0,
            };

            set({
                currentLoop: tempLoop,
                duration,
                currentTime: 0
            });

            // Sync interval
            if (get().spacedController) {
                get().spacedController!.setInterval(tempLoop.intervalSeconds);
            }

            engine.play();
        } catch (error) {
            console.error('Failed to load audio from URL:', error);
            throw error;
        }
    },

    loadFromBase64: async (base64: string, loopData?: Partial<Loop>) => {
        return get().loadFromUrl(base64, loopData);
    },

    play: () => {
        get().audioEngine?.play();
    },

    pause: () => {
        get().audioEngine?.pause();
    },

    stop: () => {
        get().audioEngine?.stop();
        get().spacedController?.stop();
        set({ currentTime: 0, intervalRemaining: null });
    },

    toggle: () => {
        const { audioEngine, isPlaying } = get();
        if (isPlaying) {
            audioEngine?.pause();
        } else {
            audioEngine?.play();
        }
    },

    setInterval: (seconds: number) => {
        const { spacedController, currentLoop } = get();
        spacedController?.setInterval(seconds);
        if (currentLoop) {
            set({
                currentLoop: { ...currentLoop, intervalSeconds: seconds }
            });
        }
    },

    setVolume: (volume: number) => {
        get().audioEngine?.setVolume(volume);
    },

    startSpacedRepetition: () => {
        get().spacedController?.start();
    },

    stopSpacedRepetition: () => {
        get().spacedController?.stop();
        set({ intervalRemaining: null });
    },
}));
