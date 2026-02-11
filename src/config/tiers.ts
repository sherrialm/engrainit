import { UserTier, TierLimits } from '@/types';

/**
 * Tier configuration - defines limits for each tier
 */
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        maxLoops: 3,
        maxGenerationsPerMonth: 5,
        maxTextLength: 200,
        availableVoices: ['sage'],
        hasDocumentUpload: false,
        hasBackgroundSounds: false,
    },
    core: {
        maxLoops: 25,
        maxGenerationsPerMonth: 30,
        maxTextLength: 500,
        availableVoices: ['sage', 'mentor', 'anchor', 'parent'],
        hasDocumentUpload: true,
        hasBackgroundSounds: false,
    },
    pro: {
        maxLoops: Infinity,
        maxGenerationsPerMonth: Infinity,
        maxTextLength: 5000,
        availableVoices: ['sage', 'mentor', 'anchor', 'parent'],
        hasDocumentUpload: true,
        hasBackgroundSounds: true,
    },
};

/**
 * Owner emails automatically get Pro access
 */
export const OWNER_EMAILS = [
    'sherrialmurray@gmail.com',
    'sherrialmurray@icloud.com',
];

/**
 * Display info for tiers
 */
export const TIER_DISPLAY: Record<UserTier, { name: string; price: string; emoji: string }> = {
    free: { name: 'Free', price: '$0/mo', emoji: '🌱' },
    core: { name: 'Core', price: '$4.99/mo', emoji: '🌿' },
    pro: { name: 'Pro', price: '$9.99/mo', emoji: '🌳' },
};
