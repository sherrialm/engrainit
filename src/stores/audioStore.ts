import { create } from 'zustand';
import { Loop, PlaybackState } from '@/types';
import { AudioEngine, getAudioEngine } from '@/services/AudioEngine';
import { BackgroundAudioEngine } from '@/services/BackgroundAudioEngine';
import { generateSpeech } from '@/services/TTSService';
import { SpacedRepetitionController } from '@/services/SpacedRepetitionController';
import { usePlaylistStore } from './playlistStore';
import { AMBIENCE_TRACKS } from '@/config/ambience';

// Module-level cancellation token: incremented on each loadAndPlay call
// so stale async operations (TTS synthesis, audio loading) bail out
let _playRequestId = 0;

interface AudioState extends PlaybackState {
    // Services (initialized lazily)
    audioEngine: AudioEngine | null;
    spacedController: SpacedRepetitionController | null;
    backgroundEngine: BackgroundAudioEngine | null;

    // Playback loading state
    isLoading: boolean;
    loadingLoopId: string | null;
    loadError: string | null;

    // Background ambience state
    backgroundEnabled: boolean;
    backgroundVolume: number;
    backgroundTrackId: string | null;
    isBackgroundPlaying: boolean;

    // Master volume state
    masterVolume: number;

    // Repeat count tracking
    repeatCount: number | null; // null = infinite
    currentRepeat: number;

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
    setRepeatCount: (n: number | null) => void;
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

    // Repeat count
    repeatCount: null,
    currentRepeat: 0,

    // Fade protection
    fadeInProgress: false,

    // Playback loading
    isLoading: false,
    loadingLoopId: null,
    loadError: null,

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

        controller.onLoopComplete = (loopCount, maxRepeats) => {
            set({ currentRepeat: loopCount });
        };

        // When all repeats for a loop are done, advance the queue
        controller.onSessionComplete = () => {
            usePlaylistStore.getState().onQueueLoopFinished();
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

        // Increment request ID — any in-flight async operation with a stale ID will bail out
        _playRequestId++;
        const thisRequestId = _playRequestId;

        // Stop current audio playback without clearing the playlist queue.
        // We must NOT call get().stop() here because stop() now clears the
        // playlist queue — which breaks session startup (startQueue → loadAndPlay
        // → stop → queue wiped). Instead, stop only the audio/spaced-rep engine.
        get().audioEngine?.stop();
        get().spacedController?.stop();
        get().stopBackground();
        set({ isPlaying: false, isPaused: false, currentTime: 0, intervalRemaining: null });

        // If a playlist queue is active but this loadAndPlay was NOT triggered
        // by the queue (single-loop play from Vault / Dashboard), clear the
        // stale queue so the UI renders NowPlayingBar, not QueueNowPlayingBar.
        const ps = usePlaylistStore.getState();
        if (ps.isQueueMode) {
            const currentQueueItem = ps.queue[ps.queueIndex];
            const isFromQueue = currentQueueItem && currentQueueItem.loopId === loop.id;
            if (!isFromQueue) {
                console.log('[AudioStore] Clearing stale queue mode for single-loop play');
                if (ps.dwellTimer) clearTimeout(ps.dwellTimer);
                ps._clearDwellTick();
                usePlaylistStore.setState({ queue: [], queueIndex: 0, isQueueMode: false, dwellTimer: null });
            }
        }

        set({ isLoading: true, loadingLoopId: loop.id, loadError: null });

        const engine = get().audioEngine!;

        try {
            let audioSource = loop.audioUrl;

            // ── Synthesize TTS audio on-the-fly ──────────────────────
            // Helper that calls the TTS API and returns a base64 data-URL.
            // Used both for loops with no audioUrl AND as a fallback when
            // an existing audioUrl is stale/expired (see retry below).
            const synthesizeTTS = async (): Promise<string | null> => {
                if (!loop.text) return null;
                console.log('[AudioStore] Synthesizing TTS for:', loop.title);
                const ttsResult = await generateSpeech({
                    text: loop.text,
                    voiceId: loop.voiceId || 'sage',
                });
                if (thisRequestId !== _playRequestId) return null; // stale
                if (!ttsResult.audioContent) throw new Error('TTS returned no audio');
                console.log('[AudioStore] TTS synthesis complete');
                return ttsResult.audioContent;
            };

            // If no audio URL but has text, synthesize TTS on-the-fly
            if ((!audioSource || audioSource.length === 0) && loop.text) {
                console.log('[AudioStore] No audioUrl, will synthesize TTS');
                try {
                    const content = await synthesizeTTS();
                    if (thisRequestId !== _playRequestId) return;
                    if (content) {
                        audioSource = content;
                    } else {
                        throw new Error('TTS returned no audio');
                    }
                } catch (ttsError: any) {
                    if (thisRequestId !== _playRequestId) return;
                    console.error('[AudioStore] TTS synthesis failed:', ttsError.message);
                    set({ isLoading: false, loadingLoopId: null, loadError: ttsError.message || 'Audio synthesis failed' });
                    return;
                }
            }

            if (!audioSource || audioSource.length === 0) {
                if (thisRequestId !== _playRequestId) return;
                console.warn('[AudioStore] Loop has no audio and no text:', loop.title);
                set({ isLoading: false, loadingLoopId: null, loadError: 'This loop has no audio or text content' });
                return;
            }

            // Voice recordings (webm/opus from MediaRecorder) cannot be reliably
            // decoded by decodeAudioData on Safari/WebKit.  Use native
            // HTMLAudioElement playback for these.  TTS loops (mp3) continue
            // through the Web Audio API path for gapless looping.
            const isVoiceRecording = loop.sourceType === 'recording';
            console.log('[AudioStore] Loading audio —', isVoiceRecording ? 'HTMLAudioElement path (voice)' : 'Web Audio API path (TTS)', '— source length:', audioSource.length);

            // ── Load audio with TTS fallback for stale URLs ──────────
            // For TTS loops: if the stored audioUrl fails (expired Firebase
            // Storage token, deleted file, etc.), fall back to regenerating
            // the audio via TTS rather than showing the user an error.
            try {
                if (isVoiceRecording) {
                    await engine.loadAudioAsElement(audioSource);
                } else {
                    await engine.loadAudio(audioSource);
                }
            } catch (loadError: any) {
                // Only attempt TTS fallback for TTS loops that have text
                if (loop.sourceType === 'tts' && loop.text && !audioSource.startsWith('data:')) {
                    console.warn('[AudioStore] Audio load failed, attempting TTS fallback regeneration:', loadError.message);
                    if (thisRequestId !== _playRequestId) return;
                    try {
                        const fallbackContent = await synthesizeTTS();
                        if (thisRequestId !== _playRequestId) return;
                        if (fallbackContent) {
                            audioSource = fallbackContent;
                            await engine.loadAudio(audioSource);
                        } else {
                            throw loadError; // re-throw original
                        }
                    } catch (fallbackError: any) {
                        if (thisRequestId !== _playRequestId) return;
                        console.error('[AudioStore] TTS fallback also failed:', fallbackError.message);
                        throw fallbackError;
                    }
                } else {
                    throw loadError; // Not a TTS loop or no text — propagate
                }
            }

            // BAIL if a newer request started while we were loading audio
            if (thisRequestId !== _playRequestId) {
                console.log('[AudioStore] Stale load request, bailing:', loop.title);
                return;
            }

            // Stop anything that might have started playing in the meantime.
            // Skip for HTMLAudioElement path — stop() would reset the element
            // we just loaded and cause play() to fail or race.
            if (!engine.getIsUsingHtmlAudio()) {
                engine.stop();
            }

            set({
                currentLoop: loop,
                duration: engine.getDuration() || loop.duration || 0,
                currentTime: 0,
                isLoading: false,
                loadingLoopId: null,
                loadError: null,
            });

            // Sync interval and repeat count (used for standalone play only)
            if (get().spacedController) {
                get().spacedController!.setInterval(loop.intervalSeconds);
                get().spacedController!.setMaxRepeats(get().repeatCount);
            }

            set({ currentRepeat: 0 });

            // ── Queue/Session mode: play once, advance on audio end ──
            const ps = usePlaylistStore.getState();
            if (ps.isQueueMode && ps.queue.length > 0) {
                console.log('[AudioStore] Queue mode — playing once, will advance on audio end');
                // Play WITHOUT native looping so it stops when done
                engine.play(false);

                // Listen for audio completion to advance to next loop.
                // For Web Audio API path, sourceNode.onended fires.
                // For HTMLAudioElement path, the 'ended' event fires.
                const onAudioEnded = () => {
                    // Bail if a newer request started (user skipped manually)
                    if (thisRequestId !== _playRequestId) return;
                    console.log('[AudioStore] Audio ended in queue mode — advancing');
                    set({ isPlaying: false, isPaused: false });
                    usePlaylistStore.getState().onQueueLoopFinished();
                };

                if (engine.getIsUsingHtmlAudio()) {
                    // HTMLAudioElement path — disable loop, listen for 'ended'
                    const htmlAudio = (engine as any).htmlAudio as HTMLAudioElement | null;
                    if (htmlAudio) {
                        htmlAudio.loop = false;
                        htmlAudio.addEventListener('ended', onAudioEnded, { once: true });
                    }
                } else {
                    // Web Audio API path — onended fires when loop=false
                    engine.onLoop = onAudioEnded;
                }
            } else {
                // ── Standalone play ──
                // Voice recordings always use native loop (SpacedRep can't manage HTMLAudioElement timing)
                if (loop.sourceType === 'recording') {
                    console.log('[AudioStore] Voice recording — playing with native loop');
                    engine.play();
                } else if (get().spacedController) {
                    // TTS loops: delegate to SpacedRepetitionController which
                    // handles -1 (manual/play once), 0 (continuous), and >0 (interval)
                    console.log('[AudioStore] Delegating play to SpacedRepetitionController, interval:', loop.intervalSeconds);
                    get().spacedController!.start();
                } else {
                    engine.play();
                }
            }

            // Start background if enabled
            if (get().backgroundEnabled) {
                get().startBackground();
            }
        } catch (error: any) {
            if (thisRequestId !== _playRequestId) return;
            console.error('Failed to load audio:', error);
            set({ isLoading: false, loadingLoopId: null, loadError: error.message || 'Playback failed' });
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
        const { spacedController, audioEngine } = get();
        if (spacedController?.getIsActive()) {
            // Resume the spaced repetition controller (it handles play internally)
            spacedController.resume();
        } else {
            audioEngine?.play();
        }
    },

    pause: () => {
        const { spacedController, audioEngine } = get();
        // Pause the spaced repetition controller first (stops its timers)
        if (spacedController?.getIsActive()) {
            spacedController.pause();
        } else {
            audioEngine?.pause();
        }
        get().stopBackground();
    },

    stop: () => {
        get().audioEngine?.stop();
        get().spacedController?.stop();
        get().stopBackground();
        // Clear the playlist queue if active — done inline to avoid
        // circular call (playlistStore.stopQueue → audioStore.stop → …)
        const ps = usePlaylistStore.getState();
        if (ps.isQueueMode) {
            if (ps.dwellTimer) clearTimeout(ps.dwellTimer);
            ps._clearDwellTick();
            usePlaylistStore.setState({ queue: [], queueIndex: 0, isQueueMode: false, dwellTimer: null });
        }
        set({ currentLoop: null, isPlaying: false, isPaused: false, currentTime: 0, duration: 0, intervalRemaining: null });
    },

    toggle: () => {
        const { spacedController, audioEngine, isPlaying } = get();
        if (isPlaying) {
            // Pause — must also pause the spaced repetition controller
            if (spacedController?.getIsActive()) {
                spacedController.pause();
            } else {
                audioEngine?.pause();
            }
            get().stopBackground();
        } else {
            // Resume — must also resume the spaced repetition controller
            if (spacedController?.getIsActive()) {
                spacedController.resume();
            } else {
                audioEngine?.play();
            }
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

    setRepeatCount: (n: number | null) => {
        set({ repeatCount: n, currentRepeat: 0 });
        const { spacedController } = get();
        if (spacedController) {
            spacedController.setMaxRepeats(n);
        }
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
