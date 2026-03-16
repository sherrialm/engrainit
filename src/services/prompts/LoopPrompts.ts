/**
 * Loop Generation Prompt Templates
 *
 * Separated from AIService so prompts are easily editable
 * and swappable without touching service logic.
 *
 * DESIGN PRINCIPLE:
 * Loops are optimized for repetition-based mental training.
 * Ideal loop = 7-18 seconds spoken = 20-50 words.
 * Structure: Short affirmation → Short reinforcement → Short directive.
 */

import { LoopGenerationInput } from '@/types';

const MOOD_LABELS: Record<string, string> = {
    calm: 'Calm',
    focused: 'Focused',
    stressed: 'Stressed',
    motivated: 'Motivated',
    tired: 'Tired',
};

const GOAL_LABELS: Record<string, string> = {
    'start-day': 'Start the day right',
    'improve-focus': 'Improve focus',
    'build-confidence': 'Build confidence',
    'stay-disciplined': 'Stay disciplined',
    'reduce-stress': 'Reduce stress',
};

const PROBLEM_LABELS: Record<string, string> = {
    overwhelmed: 'Overwhelmed',
    distracted: 'Distracted',
    'low-motivation': 'Low motivation',
    'negative-thinking': 'Negative thinking',
};

/**
 * Build a human-readable summary of the user's selections
 * for the AI confirmation step.
 */
export function buildIntentSummary(input: LoopGenerationInput): string {
    const moods = input.moods.map(m => MOOD_LABELS[m] || m).join(', ');
    const goals = input.goals.map(g => GOAL_LABELS[g] || g).join(', ');
    const problems = input.problems.map(p => PROBLEM_LABELS[p] || p).join(', ');

    let summary = `It sounds like your goal is to create a loop`;

    if (goals) summary += ` to help you ${goals.toLowerCase()}`;
    if (moods) summary += `. You're feeling ${moods.toLowerCase()}`;
    if (problems) summary += ` and dealing with ${problems.toLowerCase()}`;

    summary += '. Is that correct?';

    return summary;
}

/**
 * System prompt for AI loop generation.
 *
 * KEY CONSTRAINTS:
 * - 20-50 words total (7-18 seconds spoken)
 * - 3-5 short lines, NOT paragraphs
 * - Each line stands alone when repeated
 * - Present tense, first person, positive framing
 * - Clear rhythm and cadence for audio repetition
 */
export function buildLoopGenerationPrompt(input: LoopGenerationInput): string {
    const moods = input.moods.map(m => MOOD_LABELS[m] || m).join(', ');
    const goals = input.goals.map(g => GOAL_LABELS[g] || g).join(', ');
    const problems = input.problems.map(p => PROBLEM_LABELS[p] || p).join(', ');

    return `You are creating a mental loop for audio repetition-based training.

CONTEXT:
- Current mood: ${moods || 'Not specified'}
- Goals: ${goals || 'General improvement'}
- Challenges: ${problems || 'None specified'}
${input.details ? `- Additional context: "${input.details}"` : ''}

CRITICAL CONSTRAINTS:
- TOTAL LENGTH: 20-50 words only (7-18 seconds when spoken aloud)
- FORMAT: 3-5 short lines, one idea per line
- Each line should be a complete thought that works on its own
- Write in first person, present tense
- Positive framing only — never use "not", "don't", "stop"
- Begin with an identity statement ("I am...")
- End with a directive or action statement
- Use clear rhythm — alternate between short (3-5 words) and medium (6-10 words) lines
- Be SPECIFIC to the user's mood and goals

STRUCTURE:
Line 1: Identity statement (who I am)
Line 2: Reinforcement (what I embody)
Line 3: Directive (what I do)
Optional Line 4-5: Additional reinforcement

OUTPUT FORMAT (valid JSON):
{
  "name": "2-3 word title",
  "text": "Line 1.\\nLine 2.\\nLine 3.",
  "voiceId": "one of: david, rachel, calm-mentor, focused-coach",
  "intervalSeconds": 180-300
}

STRONG EXAMPLES:
{
  "name": "Morning Focus",
  "text": "I am focused and steady.\\nMy mind is clear, my energy is calm.\\nI finish the first task before noon.\\nI move with purpose.",
  "voiceId": "focused-coach",
  "intervalSeconds": 240
}

{
  "name": "Calm Confidence",
  "text": "I am calm and capable.\\nEvery challenge sharpens me.\\nI breathe, I decide, I act.",
  "voiceId": "calm-mentor",
  "intervalSeconds": 180
}

WEAK EXAMPLE (avoid — too vague and too long):
{
  "name": "Positive Vibes",
  "text": "I am great. I am amazing. Everything is wonderful. I believe in myself and I know that today will be a wonderful day full of possibilities and joy and I am grateful for everything.",
  "voiceId": "calm-mentor",
  "intervalSeconds": 180
}`;
}
