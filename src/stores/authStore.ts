import { create } from 'zustand';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isInitialized: boolean;

    // Actions
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
    initializeAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: false,
    error: null,
    isInitialized: false,

    signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            await signInWithEmailAndPassword(auth, email, password);
            set({ isLoading: false });
        } catch (err: any) {
            set({
                isLoading: false,
                error: getAuthErrorMessage(err.code)
            });
            throw err;
        }
    },

    signUp: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            set({ isLoading: false });
        } catch (err: any) {
            set({
                isLoading: false,
                error: getAuthErrorMessage(err.code)
            });
            throw err;
        }
    },

    signOut: async () => {
        set({ isLoading: true, error: null });
        try {
            await firebaseSignOut(auth);
            set({ user: null, isLoading: false });
        } catch (err: any) {
            set({
                isLoading: false,
                error: 'Failed to sign out. Please try again.'
            });
            throw err;
        }
    },

    clearError: () => set({ error: null }),

    initializeAuth: () => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            set({ user, isInitialized: true, isLoading: false });
        });
        return unsubscribe;
    },
}));

// Helper to convert Firebase error codes to user-friendly messages
function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try signing in instead.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign-in is not enabled.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return 'An error occurred. Please try again.';
    }
}
