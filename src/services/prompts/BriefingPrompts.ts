/**
 * Daily Briefing Prompt Templates
 *
 * Templates for generating personalized daily mental briefings.
 *
 * TUNING NOTES (for real LLM integration):
 * - Time-of-day awareness creates personal relevance
 * - Strict word count prevents rambling output
 * - Referencing specific goals/habits creates accountability
 * - Warm but direct tone — like a trusted mentor, not a motivational poster
 */

import { BriefingContext } from '@/types';

/**
 * Get time-of-day category for tone calibration.
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

const TIME_TONE: Record<string, string> = {
    morning: 'Energizing and forward-looking. Set the tone for a focused day.',
    afternoon: 'Grounding and refocusing. Reconnect with priorities mid-day.',
    evening: 'Reflective and affirming. Acknowledge progress and set intention for rest.',
};

/**
 * System prompt for generating a daily mental briefing.
 */
export function buildBriefingPrompt(context: BriefingContext): string {
    const timeOfDay = getTimeOfDay();

    const goalsStr = context.goals.length > 0
        ? context.goals.join(', ')
        : 'general personal growth';

    const habitsStr = context.habits.length > 0
        ? context.habits.join(', ')
        : 'building consistency';

    const moodsStr = context.recentMoods.length > 0
        ? context.recentMoods.join(', ')
        : 'balanced';

    const loopsStr = context.recentLoopNames.length > 0
        ? context.recentLoopNames.slice(0, 3).join(', ')
        : 'various mental alignment loops';

    return `You are a personal mental alignment coach. Generate a short, warm daily briefing for the user.

TIME OF DAY: ${timeOfDay}
TONE GUIDANCE: ${TIME_TONE[timeOfDay]}

CONTEXT:
- Active goals: ${goalsStr}
- Tracked habits: ${habitsStr}
- Recent mood patterns: ${moodsStr}
- Recent loops used: ${loopsStr}

REQUIREMENTS:
- STRICT LENGTH: 80-150 words (no more, no less)
- Start with a warm greeting appropriate to ${timeOfDay}
- Reference at least one of their specific goals or habits by name
- Include one concrete, actionable focus suggestion for today
- End with an encouraging, empowering closing statement
- Tone: warm, confident, and direct (like a trusted mentor)
- Do NOT use bullet points, headers, or emojis — write flowing prose
- Write as if speaking directly to the person`;
}
