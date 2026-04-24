'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SplashScreen from '@/components/SplashScreen';

export default function HomePage() {
    const [showSplash, setShowSplash] = useState(true);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        // Check if user has seen splash before (session-based)
        const hasSeenSplash = sessionStorage.getItem('engrainit_splash_seen');
        if (hasSeenSplash) {
            setShowSplash(false);
        }
        setHasChecked(true);
    }, []);

    const handleSplashComplete = () => {
        sessionStorage.setItem('engrainit_splash_seen', 'true');
        setShowSplash(false);
    };

    // Don't render until we've checked sessionStorage (prevents flash)
    if (!hasChecked) {
        return null;
    }

    return (
        <>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

            <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-parchment-200">
                <div className="max-w-2xl text-center space-y-8">
                    {/* Logo */}
                    <Image
                        src="/logo.png"
                        alt="EngrainIt"
                        width={120}
                        height={120}
                        className="mx-auto"
                    />

                    {/* Title */}
                    <h1 className="font-serif text-5xl md:text-6xl font-bold text-forest-700">
                        EngrainIt
                    </h1>

                    {/* Tagline */}
                    <p className="text-xl md:text-2xl text-forest-600 font-light">
                        Train your mind. Shape your identity.
                    </p>

                    {/* Description */}
                    <p className="text-forest-500 max-w-md mx-auto">
                        EngrainIt uses intelligent repetition to help you build focus,
                        reinforce identity, and create a daily mental training ritual.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        <Link href="/login" className="btn-primary text-center">
                            Start Training Free
                        </Link>
                        <Link href="/about" className="btn-secondary text-center">
                            Learn More
                        </Link>
                    </div>

                    {/* Value Pillars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                        <div className="card text-center">
                            <div className="text-3xl mb-3">🧠</div>
                            <h3 className="font-serif text-lg font-semibold mb-2 text-forest-700">Identity &amp; Focus</h3>
                            <p className="text-sm text-forest-500">
                                Reinforce who you are and what you&apos;re building toward — every single day.
                            </p>
                        </div>

                        <div className="card text-center">
                            <div className="text-3xl mb-3">🌅</div>
                            <h3 className="font-serif text-lg font-semibold mb-2 text-forest-700">Daily Ritual</h3>
                            <p className="text-sm text-forest-500">
                                Start each day with a 90-second mental alignment to set your intention.
                            </p>
                        </div>

                        <div className="card text-center">
                            <div className="text-3xl mb-3">🔁</div>
                            <h3 className="font-serif text-lg font-semibold mb-2 text-forest-700">Intelligent Repetition</h3>
                            <p className="text-sm text-forest-500">
                                The more you listen, the deeper it sinks. Your mind learns through rhythm.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-16 pb-8 text-center text-sm text-forest-400">
                    © 2026 EngrainIt. All rights reserved.
                </footer>
            </main>
        </>
    );
}
