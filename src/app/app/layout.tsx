'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isInitialized, initializeAuth, signOut } = useAuthStore();
    const router = useRouter();

    // Initialize auth listener on mount
    useEffect(() => {
        const unsubscribe = initializeAuth();
        return () => unsubscribe();
    }, [initializeAuth]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (isInitialized && !user) {
            router.push('/login');
        }
    }, [isInitialized, user, router]);

    // Show loading while checking auth
    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-paper-100 dark:bg-ink-900">
                <div className="text-center">
                    <div className="animate-spin h-10 w-10 border-4 border-ink-200 border-t-ink-900 dark:border-ink-700 dark:border-t-paper-100 rounded-full mx-auto mb-4"></div>
                    <p className="text-ink-500 dark:text-paper-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render protected content if not logged in
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-paper-100 dark:bg-ink-900">
            {/* Navigation Header */}
            <header className="border-b border-ink-100 dark:border-ink-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Back Button + Logo */}
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    console.log('Back button clicked');
                                    router.back();
                                }}
                                className="text-ink-400 hover:text-ink-600 dark:text-paper-500 dark:hover:text-paper-300 transition-colors"
                                aria-label="Go back"
                            >
                                ← Back
                            </button>
                            <h1 className="font-serif text-2xl font-bold text-ink-900 dark:text-paper-100">
                                EngrainIt
                            </h1>
                        </div>

                        {/* Navigation */}
                        <nav className="flex items-center gap-6">
                            <a href="/app" className="btn-ghost">
                                Create
                            </a>
                            <a href="/app/vault" className="btn-ghost">
                                Vault
                            </a>
                            <button
                                onClick={() => signOut()}
                                className="btn-ghost text-ink-400 hover:text-ink-600"
                            >
                                Sign Out
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main>
                {children}
            </main>
        </div>
    );
}
