import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ship operations color palette — deep navy and amber for maritime feel
        ship: {
          navy: "#0a1628",
          blue: "#1e3a5f",
          steel: "#2d4a6e",
          amber: "#f59e0b",
          gold: "#fbbf24",
        },
      },
    },
  },
  plugins: [],
};
export default config;
