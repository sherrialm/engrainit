import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Ink-on-Paper palette
                paper: {
                    50: '#FDFCFB',
                    100: '#F9F6F2',
                    200: '#F5F0E8',
                    300: '#EDE5D8',
                    400: '#E0D4C3',
                    500: '#D1C4AD',
                },
                ink: {
                    50: '#F7F7F7',
                    100: '#E3E3E3',
                    200: '#C8C8C8',
                    300: '#A4A4A4',
                    400: '#818181',
                    500: '#666666',
                    600: '#515151',
                    700: '#434343',
                    800: '#383838',
                    900: '#1A1A1A',
                    950: '#0D0D0D',
                },
            },
            fontFamily: {
                serif: ['Playfair Display', 'Georgia', 'serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'breathe': 'breathe 4s ease-in-out infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                breathe: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
                    '50%': { transform: 'scale(1.05)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
