import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#26211b",
        paper: "#f7f2ea",
        brass: "#a05f22",
      },
      fontFamily: {
        ui: ["var(--font-geist-sans)", "Arial", "sans-serif"],
        certificate: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        sheet: "0 22px 70px -35px rgba(38, 33, 27, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
