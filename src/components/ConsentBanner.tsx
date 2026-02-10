'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ConsentBanner() {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('engrainit_consent');
        if (!consent) {
            setShowBanner(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('engrainit_consent', 'accepted');
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-forest-700 text-parchment-100 shadow-lg animate-slide-in">
            <div className="max-w-4xl mx-auto px-4 py-4 sm:flex sm:items-center sm:gap-4">
                <div className="flex-1 mb-3 sm:mb-0">
                    <p className="text-sm">
                        🔒 <strong>Your data is safe.</strong> EngrainIt stores your loops securely in Firebase.
                        We never sell or share your data.{' '}
                        <Link href="/privacy" className="underline hover:text-amber-400">
                            Privacy Policy
                        </Link>
                    </p>
                </div>
                <button
                    onClick={handleAccept}
                    className="w-full sm:w-auto px-6 py-2 rounded-lg bg-amber-500 text-forest-900 font-semibold hover:bg-amber-400 transition-colors text-sm"
                >
                    I Understand
                </button>
            </div>
        </div>
    );
}
