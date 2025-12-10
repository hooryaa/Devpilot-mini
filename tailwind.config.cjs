// tailwind.config.cjs
module.exports = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,html}",
    "./out/FigmaDashboard.html" // <-- VERY IMPORTANT
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
