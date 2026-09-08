/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./js/**/*.js", "./js/*.js"],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
