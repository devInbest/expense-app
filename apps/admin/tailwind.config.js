/** @type {import('tailwindcss').Config} */
export default {
  important: '#root',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables so the theme color can change at runtime (constants/themeColors.ts).
        primary: {
          ...Object.fromEntries(
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => [
              shade,
              `rgb(var(--primary-${shade}) / <alpha-value>)`,
            ]),
          ),
          contrast: 'var(--primary-contrast)',
        },
        brand: {
          deep: 'var(--brand-deep)',
          mid: 'var(--brand-mid)',
          light: 'var(--brand-light)',
          on: 'var(--brand-on)',
        },
      },
    },
  },
  plugins: [],
};
