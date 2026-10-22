export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vibe Pixel Wall - Corkboard/Sticker palette
        paper: "#F2EADF",      // warm cream background
        ink: "#16140F",        // deep charcoal text
        accent: "#FF5A36",     // orange-red marker
        accent2: "#FFD23F",    // sticky-note yellow
        cork: "#C9A876",       // corkboard frame
        corkDark: "#A68B5E",   // darker cork for shadow
      },
      fontFamily: {
        display: ["var(--font-anton)", "var(--font-archivo-black)", "sans-serif"],
        mono: ["var(--font-space-mono)", "var(--font-jetbrains-mono)", "monospace"],
        ui: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
        tiny: "2px",
        sm: "4px",
      },
      boxShadow: {
        'sticker': '3px 3px 0 0 #16140F',  // hard drop shadow for sticker effect
        'sticker-lg': '4px 4px 0 0 #16140F',
        'cork': 'inset 0 0 60px -10px rgba(22,20,15,0.15)',
      },
    },
  },
  plugins: [],
};
