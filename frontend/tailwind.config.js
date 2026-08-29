/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141319',
        surface: '#1E1C27',
        surfaceRaised: '#26232F',
        border: '#332F3F',
        text: '#EDEAF6',
        textMuted: '#8B879C',
        error: '#FF6B5E',
        warn: '#F5B45A',
        ok: '#6EE7C0',
        signal: '#A996FF',
        signalMuted: '#4C4569',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 1 },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        slideIn: 'slideIn 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
