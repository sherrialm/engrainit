'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
            <div className="min-h-screen flex items-center justify-center bg-parchment-200">
                <div className="text-center">
                    {/* Pulsing logo during load */}
                    <div className="w-16 h-16 mx-auto mb-4 glow-pulse rounded-full">
                        <Image
                            src="/logo.png"
                            alt="EngrainIt"
                            width={64}
                            height={64}
                            className="rounded-full"
                        />
                    </div>
                    <p className="text-forest-500 font-serif">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render protected content if not logged in
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-parchment-200">
            {/* Navigation Header */}
            <header className="border-b border-forest-100 bg-parchment-100/80 backdrop-blur-sm">
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
                                className="text-forest-400 hover:text-forest-600 transition-colors"
                                aria-label="Go back"
                            >
                                ← Back
                            </button>
                            <a href="/app" className="flex items-center gap-2">
                                <Image
                                    src="/logo.png"
                                    alt="EngrainIt"
                                    width={40}
                                    height={40}
                                    className="rounded-full"
                                />
                                <h1 className="font-serif text-2xl font-bold text-forest-700">
                                    EngrainIt
                                </h1>
                            </a>
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
                                className="btn-ghost text-forest-400 hover:text-forest-600"
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
