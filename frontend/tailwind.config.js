/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        liara: {
          bg: '#181818',
          card: '#222222',
          cardHover: '#282828',
          border: '#333333',
          borderLight: '#ffffff15',
          blue: '#0076ff',
          blueHover: '#0062d6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          text: '#eeeeee',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Yekan Bakh', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
