/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: 'var(--brand-navy)',
          sky: 'var(--brand-sky)',
          ice: 'var(--brand-ice)',
          slate: 'var(--brand-slate)',
          orange: 'var(--brand-orange)',
        }
      }
    },
  },
  plugins: [],
}

