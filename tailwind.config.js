export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vibe: {
          dark: "#0f172a",
          surface: "#1e293b",
          accent: "#22d3ee",
          secondary: "#a855f7",
        },
      },
    },
  },
  plugins: [],
};
