import { create } from 'zustand';
import { refineAffirmations } from '@/services/AffirmationAIService';
import type { AffirmationCategory, AffirmationTone } from '@/types';

interface AffirmationState {
    // Modal visibility
    isOpen: boolean;

    // Request lifecycle
    isLoading: boolean;
    error: string | null;

    // User inputs
    sourceText: string;
    category: AffirmationCategory;
    tone: AffirmationTone;
    believability: number;
    faithStyle: boolean;

    // Results
    options: string[];
    selectedOption: string | null;

    // Basic debounce guard
    lastRequestAt: number | null;

    // Actions
    openModal: (sourceText?: string) => void;
    closeModal: () => void;
    setSourceText: (text: string) => void;
    setCategory: (category: AffirmationCategory) => void;
    setTone: (tone: AffirmationTone) => void;
    setBelievability: (value: number) => void;
    setFaithStyle: (value: boolean) => void;
    refine: () => Promise<void>;
    selectOption: (option: string) => void;
}

export const useAffirmationStore = create<AffirmationState>((set, get) => ({
    // ── Defaults ──────────────────────────────────────────────
    isOpen: false,
    isLoading: false,
    error: null,
    sourceText: '',
    category: 'Vision',
    tone: 'Gentle',
    believability: 60,
    faithStyle: false,
    options: [],
    selectedOption: null,
    lastRequestAt: null,

    // ── Actions ───────────────────────────────────────────────

    openModal: (sourceText?: string) => {
        set({
            isOpen: true,
            error: null,
            options: [],
            selectedOption: null,
            ...(sourceText !== undefined ? { sourceText } : {}),
        });
    },

    closeModal: () => {
        // Preserve user preferences (category, tone, believability, faithStyle)
        set({
            isOpen: false,
            isLoading: false,
            error: null,
            options: [],
            selectedOption: null,
        });
    },

    setSourceText: (text: string) => {
        set({ sourceText: text });
    },

    setCategory: (category: AffirmationCategory) => {
        set({
            category,
            // Auto-clear faithStyle when leaving Faith
            ...(category !== 'Faith' ? { faithStyle: false } : {}),
        });
    },

    setTone: (tone: AffirmationTone) => {
        set({ tone });
    },

    setBelievability: (value: number) => {
        set({ believability: Math.max(0, Math.min(100, value)) });
    },

    setFaithStyle: (value: boolean) => {
        const { category } = get();
        // Only meaningful when category is Faith
        if (category === 'Faith') {
            set({ faithStyle: value });
        }
    },

    refine: async () => {
        const { sourceText, category, tone, believability, faithStyle } = get();

        // Validate
        if (sourceText.trim().length === 0) {
            set({ error: 'Please enter some text to refine.' });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const { options } = await refineAffirmations({
                sourceText: sourceText.trim(),
                category,
                tone,
                believability,
                ...(category === 'Faith' ? { faithStyle } : {}),
            });

            set({ options, isLoading: false, lastRequestAt: Date.now() });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            set({ error: message, isLoading: false });
        }
    },

    selectOption: (option: string) => {
        set({ selectedOption: option });
    },
}));
