/**
 * Memory Engine Prompt Templates
 *
 * Templates for mnemonic generation, chunking, and
 * spaced repetition scheduling.
 *
 * DESIGN PRINCIPLE:
 * Each chunk should be short enough to repeat aloud (7-18 seconds).
 * Mnemonics should be vivid and immediately memorable.
 */

/**
 * System prompt for generating memory aids from user input.
 */
export function buildMemoryAidsPrompt(inputText: string): string {
    return `You are a memory optimization expert. The user wants to memorize the following content:

"${inputText}"

Generate the following:

1. MNEMONIC: A vivid, immediately memorable device. Use one of:
   - A visual story connecting the concepts
   - A rhyme or rhythm pattern
   - An acronym where each letter triggers recall
   Choose whichever technique best fits the content.

2. CHUNKS: Break the content into 2-4 learning segments. Each chunk MUST:
   - Be self-contained (one idea per chunk)
   - Be 15-30 words (short enough to repeat aloud in ~10 seconds)
   - Have a concise descriptive label (2-3 words)
   - Use clear, conversational language

3. SCHEDULE: A spaced repetition schedule:
   "Review after 1 hour, then 1 day, then 3 days, then 7 days, then 14 days"

Output as structured JSON:
{
  "mnemonic": "A vivid memory device",
  "chunks": [
    { "label": "Concise Label", "text": "Short repeatable text", "intervalSeconds": 180 },
    { "label": "Concise Label", "text": "Short repeatable text", "intervalSeconds": 300 }
  ],
  "schedule": "Review after 1 hour, then 1 day, then 3 days, then 7 days"
}`;
}
