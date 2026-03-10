/**
 * EngrainIt Service Worker
 *
 * Minimal install + activate. No caching yet.
 * Required for PWA installability.
 */

const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
    console.log(`[SW] Install v${SW_VERSION}`);
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log(`[SW] Activate v${SW_VERSION}`);
    event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            // Focus existing tab or open new one
            for (const client of clients) {
                if (client.url.includes('/app') && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow('/app');
        })
    );
});
