/**
 * Loop - A saved audio loop item
 */
export interface Loop {
    id: string;
    userId: string;
    title: string;
    category: LoopCategory;
    sourceType: 'tts' | 'recording';
    text?: string; // Original text if TTS
    audioUrl: string; // Firebase Storage URL
    duration: number; // seconds
    intervalSeconds: number; // Spaced repetition interval
    createdAt: Date;
    updatedAt: Date;
    playCount: number;
}

/**
 * Vault categories
 */
export type LoopCategory = 'faith' | 'study' | 'vision' | 'habits';

/**
 * Playback state
 */
export interface PlaybackState {
    isPlaying: boolean;
    isPaused: boolean;
    currentLoop: Loop | null;
    currentTime: number;
    duration: number;
    intervalRemaining: number | null; // Seconds until next play (spaced repetition)
}

/**
 * User profile
 */
export interface UserProfile {
    id: string;
    email: string;
    createdAt: Date;
    settings: UserSettings;
}

/**
 * User settings
 */
export interface UserSettings {
    theme: 'light' | 'dark' | 'system';
    defaultInterval: number; // Default spaced repetition interval
    defaultCategory: LoopCategory;
}

/**
 * TTS request
 */
export interface TTSRequest {
    text: string;
    voiceId?: string; // For future voice profiles
}

/**
 * TTS response
 */
export interface TTSResponse {
    audioContent: string; // Base64 encoded audio
    duration: number;
}
