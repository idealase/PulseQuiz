/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--pq-accent) / <alpha-value>)',
        secondary: 'rgb(var(--pq-accent-2) / <alpha-value>)',
        accent: 'rgb(var(--pq-accent-2) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
