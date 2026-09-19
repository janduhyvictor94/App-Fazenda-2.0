/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        base: {
          DEFAULT: '#0A0F0D',
          soft: '#0E1512'
        },
        surface: {
          DEFAULT: '#121A16',
          raised: '#161F1A'
        },
        line: 'rgba(234, 242, 236, 0.18)',
        'line-soft': 'rgba(234, 242, 236, 0.07)',
        ink: {
          DEFAULT: '#F5FAF7',
          muted: '#AABFB6',
          faint: '#86998F'
        },
        brand: {
          DEFAULT: '#3EE089',
          dim: '#28B06B',
          glow: 'rgba(62, 224, 137, 0.18)'
        },
        tech: {
          DEFAULT: '#33C9E8',
          glow: 'rgba(51, 201, 232, 0.16)'
        },
        amber: {
          DEFAULT: '#F0A93B',
          glow: 'rgba(240, 169, 59, 0.16)'
        },
        rose: {
          DEFAULT: '#F2607F',
          glow: 'rgba(242, 96, 127, 0.16)'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(234,242,236,0.06), 0 8px 24px -8px rgba(0,0,0,0.6)',
        'glow-brand': '0 0 0 1px rgba(62,224,137,0.25), 0 0 32px -4px rgba(62,224,137,0.25)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};
