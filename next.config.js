/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
        // firebase-admin (and its Google Cloud dependencies) use native Node.js
        // modules and dynamic require() that webpack cannot correctly bundle.
        // Marking them as external tells Next.js to leave them as plain
        // Node.js require() calls resolved at runtime — not bundled by webpack.
        // WITHOUT this, any route importing firebase-admin crashes at module
        // init time with content-length: 0 / 500 and no response body.
        // NOTE: @firebase/auth is the CLIENT sdk — do NOT add it here.
        serverComponentsExternalPackages: [
            'firebase-admin',
            '@google-cloud/firestore',
            '@google-cloud/storage',
        ],
    },
};

module.exports = nextConfig;
