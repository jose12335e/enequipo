import type { Config } from 'tailwindcss'

export default {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: {
          50: '#fff7f8',
          100: '#ffe8ed',
          200: '#f8c9d5',
          300: '#ef9fb5',
          400: '#df728f',
          500: '#c85072',
          600: '#a83b5b',
          700: '#852f49',
          800: '#61283a',
          900: '#40202b',
        },
        lavender: {
          50: '#f8f5ff',
          100: '#eee7ff',
          200: '#d8c9ff',
          300: '#baa3f7',
          400: '#9677df',
          500: '#7657bd',
          600: '#5d4299',
          700: '#493678',
          800: '#342b55',
          900: '#242138',
        },
        peach: {
          50: '#fff7f1',
          100: '#ffe9d8',
          200: '#ffd1ac',
          300: '#f8ad7b',
          400: '#e98b58',
          500: '#ca6638',
          600: '#a14d2a',
          700: '#783d27',
          800: '#543021',
          900: '#35241c',
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(82, 47, 62, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
