/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#151922',
        surface: '#1E2330',
        primary: '#4ADE80',
        secondary: '#2C3444',
        text: '#E2E8F0',
      }
    },
  },
  plugins: [],
}