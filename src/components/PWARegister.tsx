'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on mount.
 * Renders nothing — just a side-effect component.
 */
export default function PWARegister() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => console.log('[PWA] SW registered:', reg.scope))
            .catch((err) => console.warn('[PWA] SW registration failed:', err));
    }, []);

    return null;
}
