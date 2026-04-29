/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Stripe-style design tokens for Pine Labs
        stripe: {
          bg:        '#ffffff',
          surface:   '#f6f8fa',
          border:    '#e3e8ee',
          border2:   '#d5dbe1',
          text:      '#30313d',
          muted:     '#687385',
          subtle:    '#a3acba',
          blue:      '#0570de',
          'blue-light': '#cff5f6',
          green:     '#228403',
          'green-bg':'#ecfed7',
          orange:    '#c84801',
          'orange-bg':'#fef9da',
          red:       '#df1b41',
          'red-bg':  '#fff5fa',
          dark:      '#0a2540',
        },
        pine: {
          50:  '#eef3ff',
          100: '#dce8ff',
          500: '#1A56DB',
          600: '#1446c0',
          700: '#0f3a9e',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Source Code Pro"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'stripe': '0 2px 5px 0 rgba(64,68,82,0.08)',
        'stripe-hover': '0 2px 5px 0 rgba(64,68,82,0.08), 0 3px 9px 0 rgba(64,68,82,0.08)',
      },
      borderRadius: {
        'stripe': '6px',
      },
    }
  },
  plugins: []
}

