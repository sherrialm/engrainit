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
    voiceId?: string; // Voice used for TTS
    duration: number; // seconds
    intervalSeconds: number; // Spaced repetition interval
    createdAt: Date;
    updatedAt: Date;
    playCount: number;
    pinned?: boolean; // Pinned to home Quick Loops
    tags?: LoopTag[]; // System-assigned tags for filtering/ordering
}

/**
 * Vault categories
 */
export type LoopCategory = 'faith' | 'study' | 'vision' | 'habits' | 'memory';

/**
 * Loop tags — used for session ordering and smart filtering
 */
export type LoopTag = 'identity' | 'focus' | 'memory' | 'briefing' | 'habit';

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

/**
 * User tier levels
 */
export type UserTier = 'free' | 'core' | 'pro';

/**
 * Tier limits configuration
 */
export interface TierLimits {
    maxLoops: number;           // Max saved loops
    maxGenerationsPerMonth: number;
    maxTextLength: number;      // Character limit for TTS
    availableVoices: string[];  // Voice IDs allowed
    hasDocumentUpload: boolean;
    hasBackgroundSounds: boolean;
}

/**
 * User profile stored in Firestore
 */
export interface UserProfileData {
    email: string;
    tier: UserTier;
    generationsUsed: number;
    generationsResetDate: Date;
    createdAt: Date;
}

/**
 * AI Affirmation — category options
 */
export type AffirmationCategory = 'Faith' | 'Study' | 'Vision' | 'Habits';

/**
 * AI Affirmation — tone options
 */
export type AffirmationTone = 'Gentle' | 'Mentor' | 'Bold' | 'Calm';

/**
 * AI Affirmation — refine request (client → API)
 */
export interface AffirmationRefineRequest {
    sourceText: string;
    category: AffirmationCategory;
    tone: AffirmationTone;
    believability: number;
    faithStyle?: boolean;
}

/**
 * AI Affirmation — refine response (API → client)
 */
export interface AffirmationRefineResponse {
    options: string[];
}

// ── Loop Generation (AI-guided flow) ──────────────────────────

export type LoopMood = 'calm' | 'focused' | 'stressed' | 'motivated' | 'tired';
export type LoopGoal = 'start-day' | 'improve-focus' | 'build-confidence' | 'stay-disciplined' | 'reduce-stress';
export type LoopProblem = 'overwhelmed' | 'distracted' | 'low-motivation' | 'negative-thinking';

export interface LoopGenerationInput {
    moods: LoopMood[];
    goals: LoopGoal[];
    problems: LoopProblem[];
    details?: string;
}

export interface GeneratedLoopSuggestion {
    name: string;
    text: string;
    voiceId: string;
    intervalSeconds: number;
}

// ── Memory Engine ─────────────────────────────────────────────

export interface MemoryChunk {
    label: string;
    text: string;
    intervalSeconds: number;
}

export interface MemoryAidsResult {
    mnemonic: string;
    chunks: MemoryChunk[];
    schedule: string; // Human-readable repetition schedule
}

// ── Daily Briefing ────────────────────────────────────────────

export interface BriefingContext {
    goals: string[];
    habits: string[];
    recentMoods: LoopMood[];
    recentLoopNames: string[];
}

export interface DailyBriefing {
    text: string;
    generatedAt: Date;
    date: string; // YYYY-MM-DD
}

// ── Habit Tracking ────────────────────────────────────────────

export type HabitGoalCategory = 'health' | 'money' | 'family' | 'spiritual' | 'learning';

export interface Habit {
    id: string;
    userId: string;
    name: string;
    goalCategory?: HabitGoalCategory;
    createdAt: Date;
    entries: Record<string, boolean>; // date string (YYYY-MM-DD) → completed
}

export interface HabitEntry {
    date: string; // YYYY-MM-DD
    completed: boolean;
}
