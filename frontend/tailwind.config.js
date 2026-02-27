/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bnb: {
          gold: "#F0B90B",
          "gold-light": "#F8D12F",
          "gold-dim": "#9e7c08",
          dark: "#0B0E11",
          "dark-2": "#14181e",
          "dark-3": "#1a1f27",
          border: "#2b3139",
          text: "#EAECEF",
          muted: "#848E9C",
          green: "#0ECB81",
          red: "#F6465D",
          blue: "#1E9FF2",
        },
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, #F0B90B, #F8D12F)",
        "gradient-dark": "linear-gradient(180deg, #0B0E11, #12161c)",
      },
    },
  },
  plugins: [],
};
