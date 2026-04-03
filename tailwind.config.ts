import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#6366f1', hover: '#818cf8' },
        surface: { base: '#0c0e14', DEFAULT: '#13161f', elevated: '#1a1e2a', hover: '#1f2436' },
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], mono: ['DM Mono', 'monospace'] },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        dialog: '0 24px 64px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
export default config
