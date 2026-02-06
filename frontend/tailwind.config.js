module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'beam-orange': '#ff6a00',
        'beam-orange-dark': '#e55a00',
        'beam-orange-light': '#ff8a1f',
        'beam-graphite': '#0b0f14',
        'beam-graphite-light': '#0f1419',
        'beam-graphite-lighter': '#131820',
      },
      backgroundColor: {
        primary: '#0b0f14',
        secondary: '#0f1419',
        tertiary: '#131820',
        hover: '#1a202c',
        card: '#0f1419',
      },
      textColor: {
        primary: '#f1f5f9',
        secondary: '#cbd5e1',
        muted: '#94a3b8',
      },
      borderColor: {
        primary: '#1e293b',
        subtle: '#0f172a',
      },
    },
  },
  plugins: [],
};
