/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        vimpl: {
          DEFAULT: '#65c434',
          dark:    '#3d7a1f',
          light:   '#a3e085',
        },
      },
    },
  },
  plugins: [],
};
