/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#f43f5e",
        "primary-dark": "#e11d48",
        secondary: "#8b5cf6",
        cardiac: "#ef4444",
      },
    },
  },
  plugins: [],
};
