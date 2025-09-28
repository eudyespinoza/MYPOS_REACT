/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f8ff',
          100: '#e0e9ff',
          200: '#bed0ff',
          300: '#94afff',
          400: '#6c86ff',
          500: '#4b5eff',
          600: '#3b48db',
          700: '#2f38aa',
          800: '#272f83',
          900: '#242b6a',
        },
      },
    },
  },
  plugins: [],
};
