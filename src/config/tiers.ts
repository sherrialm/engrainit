import { UserTier, TierLimits } from '@/types';

/**
 * Tier configuration — defines limits for each tier
 *
 * Monetization pressure points:
 * 1. Loop limit (3 → 25) — users hit this fast
 * 2. AI generation limit (5/mo) — creates urgency around AI features
 * 3. Smart Resurfacing (Core+) — surfaces value of existing loops
 * 4. Memory Engine (1 topic/mo Free) — students hit this immediately
 * 5. Session variety (Morning only Free) — experience value, want more
 */
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        maxLoops: 3,
        maxGenerationsPerMonth: 5,
        maxTextLength: 2000,
        availableVoices: ['sage'],
        hasDocumentUpload: false,
        hasBackgroundSounds: false,
        maxHabits: 2,
        maxMemoryTopicsPerMonth: 1,
        hasSmartResurfacing: false,
        availableSessionTypes: ['morning'],
    },
    core: {
        maxLoops: 25,
        maxGenerationsPerMonth: 30,
        maxTextLength: 2000,
        availableVoices: ['sage', 'mentor', 'anchor', 'parent'],
        hasDocumentUpload: true,
        hasBackgroundSounds: false,
        maxHabits: 10,
        maxMemoryTopicsPerMonth: Infinity,
        hasSmartResurfacing: true,
        availableSessionTypes: ['morning', 'focus', 'study', 'confidence', 'calm', 'night'],
    },
    pro: {
        maxLoops: Infinity,
        maxGenerationsPerMonth: Infinity,
        maxTextLength: 5000,
        availableVoices: ['sage', 'mentor', 'anchor', 'parent'],
        hasDocumentUpload: true,
        hasBackgroundSounds: true,
        maxHabits: Infinity,
        maxMemoryTopicsPerMonth: Infinity,
        hasSmartResurfacing: true,
        availableSessionTypes: ['morning', 'focus', 'study', 'confidence', 'calm', 'night'],
    },
};

/**
 * Owner emails automatically get Pro access
 */
export const OWNER_EMAILS = [
    'sherrialmurray@gmail.com',
    'sherrialmurray@icloud.com',
    'vialabs.ai@gmail.com',
    'sherrial@gmail.com',
];

/**
 * Display info for tiers
 */
export const TIER_DISPLAY: Record<UserTier, { name: string; price: string; emoji: string }> = {
    free: { name: 'Free', price: '$0/mo', emoji: '🌱' },
    core: { name: 'Core', price: '$4.99/mo', emoji: '🌿' },
    pro: { name: 'Pro', price: '$9.99/mo', emoji: '🌳' },
};
