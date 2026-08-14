/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        black: {
          DEFAULT: '#0D0D0D',
          deep: '#070707',
        },
        graphite: {
          DEFAULT: '#1C1C1E',
          light: '#2A2A2E',
          lighter: '#3A3A3F',
        },
        gold: {
          DEFAULT: '#C9A84C',
          bright: '#FFD700',
          dark: '#8C7431',
          muted: 'rgba(201, 168, 76, 0.16)',
        },
        rarity: {
          green: '#3FB950',
          blue: '#3B82F6',
          purple: '#A855F7',
          red: '#EF4444',
          gold: '#FFD700',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 24px rgba(201, 168, 76, 0.28)',
        'gold-lg': '0 0 60px rgba(201, 168, 76, 0.35)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #FFD700 50%, #C9A84C 100%)',
        'dark-gradient': 'linear-gradient(160deg, #0D0D0D 0%, #1C1C1E 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 168, 76, 0.5)' },
          '70%': { boxShadow: '0 0 0 14px rgba(201, 168, 76, 0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
