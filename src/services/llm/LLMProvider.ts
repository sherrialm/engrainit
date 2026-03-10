/**
 * LLM Provider Interface
 *
 * Provider-agnostic adapter for AI features.
 * Swap implementations (Mock → OpenAI, Gemini, etc.) without
 * changing the API route or service contracts.
 */

// ── Shared Types ──────────────────────────────────────────────

export type AffirmationCategory = 'Faith' | 'Study' | 'Vision' | 'Habits';

export type AffirmationTone = 'Gentle' | 'Mentor' | 'Bold' | 'Calm';

/**
 * Input passed from the API route to any LLM provider.
 */
export interface RefineAffirmationInput {
    /** The user's raw thought / draft affirmation (1–1500 chars). */
    sourceText: string;
    /** Vault category the affirmation belongs to. */
    category: AffirmationCategory;
    /** Desired tone for the refined affirmations. */
    tone: AffirmationTone;
    /** Self-reported believability score (0–100). */
    believability: number;
    /** If true and category is Faith, include faith-style language. */
    faithStyle?: boolean;
    /**
     * NLP writing rules & category guidance assembled by the API route.
     * Real providers will forward this as a system/instruction prompt.
     */
    instructions: string;
}

// ── Loop Generation Types ─────────────────────────────────────

export interface GenerateLoopInput {
    /** System prompt built from LoopPrompts template */
    prompt: string;
}

export interface GenerateLoopOutput {
    name: string;
    text: string;
    voiceId: string;
    intervalSeconds: number;
}

// ── Memory Aids Types ─────────────────────────────────────────

export interface GenerateMemoryAidsInput {
    /** System prompt built from MemoryPrompts template */
    prompt: string;
}

export interface GenerateMemoryAidsOutput {
    mnemonic: string;
    chunks: Array<{ label: string; text: string; intervalSeconds: number }>;
    schedule: string;
}

// ── Briefing Types ────────────────────────────────────────────

export interface GenerateBriefingInput {
    /** System prompt built from BriefingPrompts template */
    prompt: string;
}

// ── Provider Interface ────────────────────────────────────────

export interface LLMProvider {
    /**
     * Given a user's raw thought and context, return 3–5
     * NLP-aligned affirmation options.
     */
    refineAffirmations(input: RefineAffirmationInput): Promise<string[]>;

    /**
     * Generate a mental alignment loop from user selections.
     */
    generateLoop(input: GenerateLoopInput): Promise<GenerateLoopOutput>;

    /**
     * Generate memory aids (mnemonic, chunks, schedule) for content.
     */
    generateMemoryAids(input: GenerateMemoryAidsInput): Promise<GenerateMemoryAidsOutput>;

    /**
     * Generate a personalized daily mental briefing.
     */
    generateBriefing(input: GenerateBriefingInput): Promise<string>;
}

