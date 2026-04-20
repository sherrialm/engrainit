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
        // Without this, any route importing firebase-admin crashes at module
        // init time with content-length: 0 / 500 and no response body.
        serverComponentsExternalPackages: [
            'firebase-admin',
            '@google-cloud/firestore',
            '@google-cloud/storage',
            '@firebase/auth',
        ],
    },
};

module.exports = nextConfig;
