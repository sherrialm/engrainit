import { NextRequest, NextResponse } from 'next/server';
import {
    AffirmationCategory,
    AffirmationTone,
    RefineAffirmationInput,
} from '@/services/llm/LLMProvider';
import { MockProvider } from '@/services/llm/MockProvider';

// ── Constants ─────────────────────────────────────────────────

const VALID_CATEGORIES: AffirmationCategory[] = ['Faith', 'Study', 'Vision', 'Habits'];
const VALID_TONES: AffirmationTone[] = ['Gentle', 'Mentor', 'Bold', 'Calm'];
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 1500;

// ── Category guidance (used in the instruction prompt) ────────

const CATEGORY_GUIDANCE: Record<AffirmationCategory, string> = {
    Faith:
        'Emphasise spiritual identity and trust. If faithStyle is enabled, ' +
        'include "With God\'s help…" style language. Do NOT quote full scripture verses.',
    Study:
        'Emphasise recall, clarity, and academic consistency. ' +
        'Use phrases related to learning, focus, and knowledge retention.',
    Vision:
        'Emphasise direction, commitment, and follow-through. ' +
        'Use phrases related to purpose, goals, and forward momentum.',
    Habits:
        'Emphasise daily identity and micro-actions. ' +
        'Use phrases related to routine, consistency, and small powerful steps.',
};

// ── Build NLP instructions ────────────────────────────────────

function buildInstructions(
    category: AffirmationCategory,
    believability: number,
    faithStyle?: boolean,
): string {
    const lines = [
        '## NLP Affirmation Writing Rules',
        '- Use present tense only.',
        '- Use positive framing — avoid "not", "never", "don\'t".',
        '- Use identity-based phrasing: "I am / I choose / I practice / I become".',
        `- Believability score is ${believability}/100.`,
    ];

    if (believability <= 40) {
        lines.push(
            '- Believability is LOW: use scaffolding language such as ' +
            '"I am learning…", "I am beginning to…", "I choose to explore…".',
        );
    } else if (believability <= 70) {
        lines.push(
            '- Believability is MODERATE: use confident but grounded language.',
        );
    } else {
        lines.push(
            '- Believability is HIGH: use strong, declarative identity statements.',
        );
    }

    lines.push(
        '- Target length: 8–22 words per affirmation.',
        '- Return 3–5 affirmation options.',
        '',
        `## Category: ${category}`,
        CATEGORY_GUIDANCE[category],
    );

    if (category === 'Faith' && faithStyle) {
        lines.push(
            '- Faith style is enabled: include "With God\'s help…" phrasing where appropriate.',
        );
    }

    return lines.join('\n');
}

// ── Validation helpers ────────────────────────────────────────

function validateBody(body: unknown): { input: RefineAffirmationInput } | { error: string } {
    if (!body || typeof body !== 'object') {
        return { error: 'Request body must be a JSON object.' };
    }

    const b = body as Record<string, unknown>;

    // sourceText
    if (typeof b.sourceText !== 'string') {
        return { error: 'sourceText is required and must be a string.' };
    }
    const trimmed = b.sourceText.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) {
        return { error: `sourceText must be at least ${MIN_TEXT_LENGTH} character(s) after trimming.` };
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
        return { error: `sourceText must be ${MAX_TEXT_LENGTH} characters or fewer.` };
    }

    // category
    if (!VALID_CATEGORIES.includes(b.category as AffirmationCategory)) {
        return { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` };
    }

    // tone
    if (!VALID_TONES.includes(b.tone as AffirmationTone)) {
        return { error: `tone must be one of: ${VALID_TONES.join(', ')}.` };
    }

    // believability
    if (typeof b.believability !== 'number' || !Number.isFinite(b.believability)) {
        return { error: 'believability is required and must be a number.' };
    }
    if (b.believability < 0 || b.believability > 100) {
        return { error: 'believability must be between 0 and 100.' };
    }

    // faithStyle (optional)
    const faithStyle = b.faithStyle === true ? true : undefined;

    const category = b.category as AffirmationCategory;
    const tone = b.tone as AffirmationTone;
    const believability = b.believability as number;
    const instructions = buildInstructions(category, believability, faithStyle);

    return {
        input: {
            sourceText: trimmed,
            category,
            tone,
            believability,
            faithStyle,
            instructions,
        },
    };
}

// ── Route handler ─────────────────────────────────────────────

/**
 * POST /api/affirmations/refine
 *
 * Accepts a user's raw thought and returns 3–5 NLP-aligned
 * affirmation options. Currently wired to MockProvider;
 * swap the provider implementation to use a real LLM later.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const result = validateBody(body);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const provider = new MockProvider();
        const options = await provider.refineAffirmations(result.input);

        return NextResponse.json({ options });
    } catch (error) {
        console.error('Affirmation refine error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred while refining affirmations.' },
            { status: 500 },
        );
    }
}
