export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Basa gelap solid, bukan violet. Aksen tunggal (cyan) dipakai hemat.
        ink: "#0A0E17",
        panel: "#121826",
        hairline: "#1F2737",
        accent: "#4CC9F0", // satu aksen, untuk state fokus dan satu tombol primer
        dim: "#8A93A6",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        ui: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        none: "0px",
        tiny: "2px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};
