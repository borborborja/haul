/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        darkBg: '#0f172a',
        darkSurface: '#1e293b',
      },
      animation: {
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop': 'pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      },
      keyframes: {
        'shake': { '0%, 100%': { transform: 'rotate(0deg)' }, '25%': { transform: 'rotate(1deg)' }, '75%': { transform: 'rotate(-1deg)' } },
        'fadeIn': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slideUp': { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'pop': { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } }
      }
    },
  },
  plugins: [],
}
