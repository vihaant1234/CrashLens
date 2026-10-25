import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-pitch': '#07080a',
        'bg-card': '#0d0f16',
        'bg-panel': '#0a0b10',
        'border-cad': 'rgba(255, 237, 214, 0.08)',
        'border-cad-bright': 'rgba(255, 237, 214, 0.20)',
        'accent-amber': '#ff8539',
        'accent-cyan': '#38bdf8',
        'text-cream': '#ffedd6',
        'text-muted': '#94a3b8',
        'radar-green': '#00ff88',
        'radar-red': '#ff2a55',
        'radar-amber': '#ffaa40',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'cad-glow': '0 0 25px -5px rgba(255, 133, 57, 0.15)',
        'amber-glow': '0 0 20px 0 rgba(255, 133, 57, 0.35)',
        'radar-glow': '0 0 30px -5px rgba(0, 240, 255, 0.20)',
      },
    },
  },
  plugins: [],
};

export default config;
