/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      '#1a1a2e',
          surface: '#16213e',
          card:    '#0f3460',
          accent:  '#e94560',
          light:   '#a8dadc',
        },
        fb: {
          blue:    '#1877f2',
          gray:    '#3a3b3c',
          text:    '#e4e6ea',
          muted:   '#b0b3b8',
          divider: '#3a3b3c',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
