import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        brand: {
          green: "var(--brand-green)",
          dark: "var(--brand-dark-green)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
        danger: "var(--danger-alert)",
        // Semantic colors (both modes)
        success: "#10B981",
        warning: "#F59E0B",
        error: "#DC2626",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        bengali: ["var(--font-noto-bengali)", "Noto Sans Bengali", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      borderRadius: {
        custom: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
