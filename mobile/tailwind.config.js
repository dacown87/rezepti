/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FEF5F3',
          100: '#FDE8E4',
          200: '#FAC8BF',
          300: '#F4A090',
          400: '#E8674D',
          500: '#C84B31',   // Haupt-Terrakotta
          600: '#B03E27',
          700: '#8C3020',
          800: '#6B2418',
          900: '#4A1810',
        },
        gold: {
          400: '#ECAD4B',
          500: '#D4A853',
          600: '#B8922E',
        },
        warm: {
          50:  '#FAFAFA',
          100: '#F7F3EF',
          200: '#F0EBE4',
          300: '#D4C4B8',
          400: '#BBA898',
          500: '#9E8878',
          600: '#8B7355',
          700: '#6B5540',
          800: '#4A3828',
          900: '#2C1810',
        },
        espresso: {
          700: '#3D2018',
          800: '#2D1810',
          900: '#1A0F0A',
        },
      },
    },
  },
  plugins: [],
};
