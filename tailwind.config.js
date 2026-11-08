/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        paper: token('paper'),
        surface: token('surface'),
        ink: token('ink'),
        muted: token('muted'),
        subtle: token('subtle'),
        line: token('line'),
        clay: token('clay'),
        'on-clay': token('on-clay'),
        sunday: token('sunday'),
      },
      boxShadow: {
        card: '0 18px 50px -24px rgb(var(--c-shadow) / 0.35)',
        soft: '0 6px 20px -10px rgb(var(--c-shadow) / 0.3)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-4px) rotate(-6deg)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        float: 'float 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
