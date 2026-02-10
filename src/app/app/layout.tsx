'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import { useTierStore } from '@/stores/tierStore';
import { TIER_DISPLAY } from '@/config/tiers';

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isInitialized, initializeAuth, signOut } = useAuthStore();
    const { tier, isLoaded, loadProfile } = useTierStore();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Initialize auth listener on mount
    useEffect(() => {
        const unsubscribe = initializeAuth();
        return () => unsubscribe();
    }, [initializeAuth]);

    // Load tier profile when user is authenticated
    useEffect(() => {
        if (user?.uid && user?.email) {
            loadProfile(user.uid, user.email);
        }
    }, [user, loadProfile]);

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
                        {/* Logo */}
                        <a href="/app" className="flex items-center gap-2">
                            <Image
                                src="/logo.png"
                                alt="EngrainIt"
                                width={36}
                                height={36}
                                className="rounded-full"
                            />
                            <h1 className="font-serif text-xl sm:text-2xl font-bold text-forest-700">
                                EngrainIt
                            </h1>
                        </a>

                        {/* Desktop Navigation */}
                        <nav className="hidden sm:flex items-center gap-4">
                            {isLoaded && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-forest-100 text-forest-600">
                                    {TIER_DISPLAY[tier].emoji} {TIER_DISPLAY[tier].name}
                                </span>
                            )}
                            <a href="/app" className="btn-ghost text-sm">
                                Create
                            </a>
                            <a href="/app/vault" className="btn-ghost text-sm">
                                Vault
                            </a>
                            <button
                                onClick={() => signOut()}
                                className="btn-ghost text-forest-400 hover:text-forest-600 text-sm"
                            >
                                Sign Out
                            </button>
                        </nav>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="sm:hidden p-2 text-forest-600 hover:text-forest-800 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile menu dropdown */}
                {mobileMenuOpen && (
                    <div className="sm:hidden border-t border-forest-100 bg-parchment-100 px-4 py-3 space-y-2">
                        <a
                            href="/app"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block py-2 px-3 rounded-lg text-forest-600 hover:bg-parchment-300 transition-colors"
                        >
                            ✍️ Create
                        </a>
                        <a
                            href="/app/vault"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block py-2 px-3 rounded-lg text-forest-600 hover:bg-parchment-300 transition-colors"
                        >
                            🗃️ Vault
                        </a>
                        <button
                            onClick={() => {
                                signOut();
                                setMobileMenuOpen(false);
                            }}
                            className="block w-full text-left py-2 px-3 rounded-lg text-forest-400 hover:bg-parchment-300 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main>
                {children}
            </main>
        </div>
    );
}
