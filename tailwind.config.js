/** @type {import('tailwindcss').Config} */

// Braun-style palette, shared with the ailean.dk landing page.
// Paper ground, black ink, one orange signal, thin warm-grey rules.
// The older colour families the components use are remapped here, so the whole
// app follows the new look without rewriting every class:
//   grey-ish and cool hues (gray, slate, blue, violet, green, …) → warm neutrals
//   amber / orange / yellow → the orange signal
//   red stays red: errors and destructive actions.
const neutral = {
  50: '#FAFAF8', 100: '#F1F1EE', 200: '#E2E2DD', 300: '#C6C6C0', 400: '#8C8C86',
  500: '#62625D', 600: '#4A4A46', 700: '#343431', 800: '#232323', 900: '#151515', 950: '#0D0D0D',
};
const signal = {
  50: '#FEF3EC', 100: '#FDE4D3', 200: '#F9C6A6', 300: '#F4A06F', 400: '#EE7737',
  500: '#E8500A', 600: '#C2420A', 700: '#9A3509', 800: '#7A2B0B', 900: '#5E220B', 950: '#3B1507',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F1F1EE',
        case: '#E2E2DD',
        panel: '#FAFAF8',
        line: '#C6C6C0',
        mid: '#62625D',
        ink: { DEFAULT: '#151515', hover: '#33332F' },
        signal: { DEFAULT: '#E8500A', ...signal },
        // Legacy names, kept so nothing renders unstyled
        vimpl: { DEFAULT: '#151515', dark: '#33332F', light: '#C6C6C0' },
        gray: neutral, slate: neutral, zinc: neutral, neutral, stone: neutral,
        green: neutral, emerald: neutral, lime: neutral, teal: neutral, cyan: neutral,
        sky: neutral, blue: neutral, indigo: neutral, violet: neutral, purple: neutral,
        fuchsia: neutral, pink: neutral,
        amber: signal, orange: signal, yellow: signal,
      },
      fontFamily: {
        sans: ['Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
