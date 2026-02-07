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
                // Glow-Grain Palette
                parchment: {
                    DEFAULT: '#F5F5DC',
                    50: '#FDFDF5',
                    100: '#FAFAED',
                    200: '#F5F5DC',
                    300: '#E8E8CC',
                    400: '#DBDBB8',
                    500: '#CECEA4',
                },
                forest: {
                    DEFAULT: '#2D5A27',
                    50: '#E8F0E7',
                    100: '#D1E1CF',
                    200: '#A3C39F',
                    300: '#75A56F',
                    400: '#47873F',
                    500: '#2D5A27',
                    600: '#244A1F',
                    700: '#1E3D1A',
                    800: '#172E14',
                    900: '#0F1F0D',
                },
                amber: {
                    DEFAULT: '#FFBF00',
                    50: '#FFF8E6',
                    100: '#FFF1CC',
                    200: '#FFE599',
                    300: '#FFD966',
                    400: '#FFCD33',
                    500: '#FFBF00',
                    600: '#CC9900',
                    700: '#997300',
                    800: '#664D00',
                    900: '#332600',
                },
                // Legacy support (maps to new colors)
                paper: {
                    50: '#FDFDF5',
                    100: '#FAFAED',
                    200: '#F5F5DC',
                    300: '#E8E8CC',
                    400: '#DBDBB8',
                    500: '#CECEA4',
                    600: '#B8B88C',
                },
                ink: {
                    50: '#E8F0E7',
                    100: '#D1E1CF',
                    200: '#A3C39F',
                    300: '#75A56F',
                    400: '#47873F',
                    500: '#2D5A27',
                    600: '#244A1F',
                    700: '#1E3D1A',
                    800: '#172E14',
                    900: '#0F1F0D',
                    950: '#0A140A',
                },
            },
            fontFamily: {
                serif: ['Crimson Pro', 'Georgia', 'serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'breathe': 'breathe 4s ease-in-out infinite',
                'glow-pulse': 'glowPulse 2s ease-in-out infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                breathe: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
                    '50%': { transform: 'scale(1.05)', opacity: '1' },
                },
                glowPulse: {
                    '0%, 100%': {
                        boxShadow: '0 0 20px rgba(255, 191, 0, 0.4), 0 0 40px rgba(255, 191, 0, 0.2)'
                    },
                    '50%': {
                        boxShadow: '0 0 40px rgba(255, 191, 0, 0.6), 0 0 80px rgba(255, 191, 0, 0.4)'
                    },
                },
            },
        },
    },
    plugins: [],
};

export default config;
