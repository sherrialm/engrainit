import { create } from 'zustand';
import { Loop, PlaybackState } from '@/types';
import { AudioEngine, getAudioEngine } from '@/services/AudioEngine';
import { BackgroundAudioEngine } from '@/services/BackgroundAudioEngine';
import { SpacedRepetitionController } from '@/services/SpacedRepetitionController';
import { AMBIENCE_TRACKS } from '@/config/ambience';

interface AudioState extends PlaybackState {
    // Services (initialized lazily)
    audioEngine: AudioEngine | null;
    spacedController: SpacedRepetitionController | null;
    backgroundEngine: BackgroundAudioEngine | null;

    // Background ambience state
    backgroundEnabled: boolean;
    backgroundVolume: number;
    backgroundTrackId: string | null;
    isBackgroundPlaying: boolean;

    // Master volume state
    masterVolume: number;

    // Fade-in-progress flag (NightSession)
    fadeInProgress: boolean;

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
    setMasterVolume: (v: number) => void;
    startSpacedRepetition: () => void;
    stopSpacedRepetition: () => void;
    setFadeInProgress: (active: boolean) => void;

    // Background actions
    setBackgroundEnabled: (enabled: boolean) => void;
    setBackgroundVolume: (v: number) => void;
    setBackgroundTrack: (trackId: string) => Promise<void>;
    startBackground: () => void;
    stopBackground: () => void;
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
    backgroundEngine: null,

    // Background initial state
    backgroundEnabled: false,
    backgroundVolume: 0.25,
    backgroundTrackId: null,
    isBackgroundPlaying: false,

    // Master volume
    masterVolume: 1,

    // Fade protection
    fadeInProgress: false,

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

        // Initialize background engine on same AudioContext
        let bgEngine: BackgroundAudioEngine | null = null;
        const ctx = engine.getAudioContext();
        if (ctx) {
            bgEngine = new BackgroundAudioEngine(ctx);
            bgEngine.setVolume(state.backgroundVolume);
        }

        set({ audioEngine: engine, spacedController: controller, backgroundEngine: bgEngine });
    },

    loadAndPlay: async (loop: Loop) => {
        const { audioEngine } = get();
        if (!audioEngine) {
            get().initializeAudio();
        }

        console.log('[AudioStore] loadAndPlay called for:', loop.title);

        // STOP any active session/timers first to avoid race conditions
        get().stop();

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

            // Start background if enabled
            if (get().backgroundEnabled) {
                get().startBackground();
            }

            // Auto-start spaced repetition so the loop interval is used
            if (get().spacedController && loop.intervalSeconds > 0) {
                console.log('[AudioStore] Auto-starting spaced repetition with interval:', loop.intervalSeconds);
                get().spacedController!.start();
            }
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

        console.log('[AudioStore] loadFromUrl called');

        // STOP any active session/timers first
        get().stop();

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

            // Start background if enabled
            if (get().backgroundEnabled) {
                get().startBackground();
            }
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
        get().stopBackground();
    },

    stop: () => {
        get().audioEngine?.stop();
        get().spacedController?.stop();
        get().stopBackground();
        set({ currentTime: 0, intervalRemaining: null });
    },

    toggle: () => {
        const { audioEngine, isPlaying } = get();
        if (isPlaying) {
            audioEngine?.pause();
            get().stopBackground();
        } else {
            audioEngine?.play();
            // Resume background if enabled and primary is loaded
            if (get().backgroundEnabled && get().currentLoop && !get().isBackgroundPlaying) {
                get().startBackground();
            }
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

    setMasterVolume: (v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        set({ masterVolume: clamped });
        // During fade, only update state — NightSession controls the engine
        if (!get().fadeInProgress) {
            get().audioEngine?.setVolume(clamped);
        }
    },

    startSpacedRepetition: () => {
        get().spacedController?.start();
    },

    stopSpacedRepetition: () => {
        get().spacedController?.stop();
        set({ intervalRemaining: null });
    },

    setFadeInProgress: (active: boolean) => {
        set({ fadeInProgress: active });
    },

    // ── Background ambience actions ───────────────────────────

    setBackgroundEnabled: (enabled: boolean) => {
        set({ backgroundEnabled: enabled });
        if (!enabled) {
            get().stopBackground();
        }
    },

    setBackgroundVolume: (v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        set({ backgroundVolume: clamped });
        // During fade, only update state — NightSession controls the engine
        if (!get().fadeInProgress) {
            get().backgroundEngine?.setVolume(clamped);
        }
    },

    setBackgroundTrack: async (trackId: string) => {
        const track = AMBIENCE_TRACKS.find((t) => t.id === trackId);
        if (!track) return;

        const { backgroundEngine, isBackgroundPlaying } = get();
        if (!backgroundEngine) return;

        // Stop current playback while loading new track
        if (isBackgroundPlaying) {
            backgroundEngine.stop();
            set({ isBackgroundPlaying: false });
        }

        set({ backgroundTrackId: trackId });

        const loaded = await backgroundEngine.loadTrack(track.file);
        if (!loaded) {
            console.warn('[AudioStore] Background track failed to load:', track.file);
            return;
        }

        // Restart only if enabled AND primary is actively playing with a loaded loop
        if (get().backgroundEnabled && get().isPlaying && get().currentLoop) {
            backgroundEngine.play();
            set({ isBackgroundPlaying: true });
        }
    },

    startBackground: () => {
        const { backgroundEngine, backgroundTrackId, backgroundEnabled, isBackgroundPlaying, currentLoop, isPlaying } = get();
        // Only play when enabled, primary loop is loaded, AND primary is actively playing
        if (!backgroundEngine || !backgroundTrackId || !backgroundEnabled) return;
        if (isBackgroundPlaying || !currentLoop || !isPlaying) return;

        backgroundEngine.play();
        set({ isBackgroundPlaying: true });
    },

    stopBackground: () => {
        const { backgroundEngine } = get();
        if (!backgroundEngine) return;

        backgroundEngine.stop();
        set({ isBackgroundPlaying: false });
    },
}));
