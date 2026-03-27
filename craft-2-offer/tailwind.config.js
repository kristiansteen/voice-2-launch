/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        aison: '#1B4F72',
        'aison-light': '#2E86C1',
        'aison-accent': '#F39C12',
      },
    },
  },
  plugins: [],
};
