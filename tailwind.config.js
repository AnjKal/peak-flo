/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFF8FB',
        accent: '#D81B60',
        text: '#2D2D2D',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(216, 27, 96, 0.08)',
      },
    },
  },
  plugins: [],
}
