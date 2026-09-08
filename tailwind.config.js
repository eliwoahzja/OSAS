/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        maroon: {
          dark: '#241A22',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
