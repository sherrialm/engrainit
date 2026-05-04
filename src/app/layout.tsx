import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import ConsentBanner from '@/components/ConsentBanner';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
    title: 'EngrainIt — Mental Training Through Intelligent Repetition',
    description: 'Build focus, reinforce identity, and create daily mental training rituals through intelligent repetition. Your mind learns through rhythm — EngrainIt makes it effortless.',
    keywords: ['mental training', 'daily ritual', 'identity reinforcement', 'focus training', 'intelligent repetition', 'mental engraving', 'affirmations', 'spaced repetition'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.webmanifest" />
                <meta name="theme-color" content="#2d5016" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
            </head>
            <body className="min-h-screen bg-parchment-200 antialiased">
                <ToastProvider>
                    {children}
                    <ConsentBanner />
                    <PWARegister />
                </ToastProvider>
            </body>
        </html>
    );
}
