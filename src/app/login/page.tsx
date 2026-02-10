'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Check if sign-ups are allowed (defaults to true if not set)
const ALLOW_SIGNUPS = process.env.NEXT_PUBLIC_ALLOW_SIGNUPS !== 'false';

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetSent, setResetSent] = useState(false);

    const { signIn, signUp, isLoading, error, clearError } = useAuthStore();
    const router = useRouter();

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            alert('Please enter your email address first, then click Forgot Password.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth!, email);
            setResetSent(true);
        } catch (err: any) {
            alert('Could not send reset email. Please check your email address.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        // Block sign-ups if not allowed
        if (isSignUp && !ALLOW_SIGNUPS) {
            return;
        }

        if (isSignUp && password !== confirmPassword) {
            return; // Could set a local error here
        }

        try {
            if (isSignUp) {
                await signUp(email, password);
                // New users go to onboarding
                router.push('/onboarding');
            } else {
                await signIn(email, password);
                // Returning users check if they've seen onboarding
                const hasSeenOnboarding = localStorage.getItem('engrainit_onboarding_complete');
                router.push(hasSeenOnboarding ? '/app' : '/onboarding');
            }
        } catch {
            // Error is handled in store
        }
    };

    const toggleMode = () => {
        // Don't allow switching to sign-up if not allowed
        if (!isSignUp && !ALLOW_SIGNUPS) {
            return;
        }
        setIsSignUp(!isSignUp);
        clearError();
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-parchment-200">
            <div className="w-full max-w-md">
                {/* Header with Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <Image
                            src="/logo.png"
                            alt="EngrainIt"
                            width={80}
                            height={80}
                            className="mx-auto mb-4"
                        />
                        <h1 className="font-serif text-4xl font-bold text-forest-700">
                            EngrainIt
                        </h1>
                    </Link>
                    <p className="text-forest-500 mt-2">
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </p>
                </div>

                {/* Form Card */}
                <div className="card">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-forest-600 mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-forest-600 mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            />
                            {!isSignUp && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs text-forest-500 hover:text-forest-700 mt-1 hover:underline"
                                >
                                    Forgot password?
                                </button>
                            )}
                            {resetSent && (
                                <p className="text-xs text-green-600 mt-1">✅ Reset email sent! Check your inbox.</p>
                            )}
                        </div>

                        {/* Confirm Password (Sign Up only) */}
                        {isSignUp && (
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-forest-600 mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="input-field"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                {password !== confirmPassword && confirmPassword && (
                                    <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                                )}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || (isSignUp && password !== confirmPassword)}
                            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                                </span>
                            ) : (
                                isSignUp ? 'Create Account' : 'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Toggle Mode - Only show if sign-ups are allowed */}
                    {ALLOW_SIGNUPS && (
                        <div className="mt-6 text-center text-sm text-forest-500">
                            {isSignUp ? (
                                <>
                                    Already have an account?{' '}
                                    <button onClick={toggleMode} className="text-forest-700 font-medium hover:underline">
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    Don&apos;t have an account?{' '}
                                    <button onClick={toggleMode} className="text-forest-700 font-medium hover:underline">
                                        Create one
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-sm text-forest-400 hover:text-forest-600">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </main>
    );
}

