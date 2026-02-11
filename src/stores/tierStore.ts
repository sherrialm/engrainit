import { create } from 'zustand';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore/lite';
import { db } from '@/lib/firebase';
import { UserTier, UserProfileData } from '@/types';
import { TIER_LIMITS, OWNER_EMAILS } from '@/config/tiers';

interface TierState {
    tier: UserTier;
    generationsUsed: number;
    generationsResetDate: Date | null;
    isLoaded: boolean;

    // Actions
    loadProfile: (userId: string, email: string) => Promise<void>;
    incrementGenerations: (userId: string) => Promise<void>;
    canGenerate: () => boolean;
    canSaveLoop: (currentLoopCount: number) => boolean;
    canUseVoice: (voiceId: string) => boolean;
    canUploadDocument: () => boolean;
    getMaxTextLength: () => number;
    getRemainingGenerations: () => number;
}

export const useTierStore = create<TierState>((set, get) => ({
    tier: 'free',
    generationsUsed: 0,
    generationsResetDate: null,
    isLoaded: false,

    loadProfile: async (userId: string, email: string) => {
        // Check if owner — auto-assign Pro
        const isOwner = OWNER_EMAILS.includes(email.toLowerCase());
        console.log('[Tier] Loading profile for', email, '| isOwner:', isOwner, '| db:', !!db);

        if (!db) {
            // No Firestore available, use owner check
            set({ tier: isOwner ? 'pro' : 'free', isLoaded: true });
            return;
        }

        try {
            const profileRef = doc(db, 'users', userId, 'profile', 'data');
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                const data = profileSnap.data() as UserProfileData;

                // Check if we need to reset monthly generations
                const resetDateRaw = data.generationsResetDate as any;
                const resetDate = resetDateRaw?.toDate ? resetDateRaw.toDate() : resetDateRaw;
                const now = new Date();
                let generationsUsed = data.generationsUsed || 0;

                if (resetDate && new Date(resetDate) < now) {
                    // Reset monthly counter
                    generationsUsed = 0;
                    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    await updateDoc(profileRef, {
                        generationsUsed: 0,
                        generationsResetDate: nextReset,
                    });
                }

                // If owner, ensure they're Pro
                const tier = isOwner ? 'pro' : (data.tier || 'free');
                if (isOwner && data.tier !== 'pro') {
                    await updateDoc(profileRef, { tier: 'pro' });
                }

                console.log('[Tier] Loaded profile:', { tier, generationsUsed });
                set({
                    tier,
                    generationsUsed,
                    generationsResetDate: resetDate ? new Date(resetDate) : null,
                    isLoaded: true,
                });
            } else {
                // New user — create profile
                const tier: UserTier = isOwner ? 'pro' : 'free';
                const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

                await setDoc(profileRef, {
                    email,
                    tier,
                    generationsUsed: 0,
                    generationsResetDate: nextReset,
                    createdAt: new Date(),
                });

                console.log('[Tier] Created new profile:', { tier });
                set({
                    tier,
                    generationsUsed: 0,
                    generationsResetDate: nextReset,
                    isLoaded: true,
                });
            }
        } catch (error) {
            console.error('[Tier] Failed to load user profile:', error);
            // Fallback: check owner list even if Firestore fails
            console.log('[Tier] Falling back to owner check:', isOwner);
            set({ tier: isOwner ? 'pro' : 'free', isLoaded: true });
        }
    },

    incrementGenerations: async (userId: string) => {
        if (!db) return;

        const newCount = get().generationsUsed + 1;
        set({ generationsUsed: newCount });

        try {
            const profileRef = doc(db, 'users', userId, 'profile', 'data');
            await updateDoc(profileRef, { generationsUsed: newCount });
        } catch (error) {
            console.error('Failed to update generation count:', error);
        }
    },

    canGenerate: () => {
        const { tier, generationsUsed } = get();
        const limits = TIER_LIMITS[tier];
        return generationsUsed < limits.maxGenerationsPerMonth;
    },

    canSaveLoop: (currentLoopCount: number) => {
        const { tier } = get();
        const limits = TIER_LIMITS[tier];
        return currentLoopCount < limits.maxLoops;
    },

    canUseVoice: (voiceId: string) => {
        const { tier } = get();
        const limits = TIER_LIMITS[tier];
        return limits.availableVoices.includes(voiceId);
    },

    canUploadDocument: () => {
        const { tier } = get();
        return TIER_LIMITS[tier].hasDocumentUpload;
    },

    getMaxTextLength: () => {
        const { tier } = get();
        return TIER_LIMITS[tier].maxTextLength;
    },

    getRemainingGenerations: () => {
        const { tier, generationsUsed } = get();
        const limits = TIER_LIMITS[tier];
        return Math.max(0, limits.maxGenerationsPerMonth - generationsUsed);
    },
}));
