/**
 * Daily Briefing Prompt Templates
 *
 * Templates for generating personalized daily mental briefings.
 */

import { BriefingContext } from '@/types';

/**
 * System prompt for generating a daily mental briefing.
 */
export function buildBriefingPrompt(context: BriefingContext): string {
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

CONTEXT:
- Active goals: ${goalsStr}
- Tracked habits: ${habitsStr}
- Recent mood patterns: ${moodsStr}
- Recent loops used: ${loopsStr}

REQUIREMENTS:
- 30-90 seconds when read aloud (approximately 75-225 words)
- Start with a warm greeting appropriate to time of day
- Reference their specific goals and habits
- Include one actionable focus suggestion
- End with an encouraging, empowering statement
- Tone: warm, confident, and direct (like a trusted mentor)
- Do NOT use bullet points or headers — write flowing prose`;
}
