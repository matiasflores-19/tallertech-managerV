/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070d19',
          900: '#0a1220',
          850: '#0d1626',
          800: '#111c30',
          750: '#15223a',
          700: '#1b2a44',
          600: '#263a5a',
        },
        tech: {
          50: '#eff8ff',
          100: '#dbefff',
          200: '#bce4ff',
          300: '#8ed3ff',
          400: '#59b9ff',
          500: '#339bff',
          600: '#1d7ef5',
          700: '#1566e1',
          800: '#1854b6',
          900: '#19488f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 24px 60px -32px rgba(0, 0, 0, 0.8)',
        glow: '0 0 0 1px rgba(51, 155, 255, 0.12), 0 18px 50px -24px rgba(51, 155, 255, 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-800px 0' },
          '100%': { backgroundPosition: '800px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out backwards',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
