import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MASTER.md — OLED Dark Strategy
        background: "#020617",
        surface: "#0f172a",
        primary: "#2dd4bf",
        warning: "#f59e0b",
        critical: "#e11d48",
        "text-primary": "#f8fafc",
        "text-secondary": "#94a3b8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        h1: [
          "24px",
          { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.02em" },
        ],
        h2: [
          "18px",
          { lineHeight: "1.4", fontWeight: "500", letterSpacing: "-0.01em" },
        ],
        body: ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        data: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      spacing: {
        // 8px grid system
        "grid-1": "8px",
        "grid-2": "16px",
        "grid-3": "24px",
        "grid-4": "32px",
        "grid-5": "40px",
      },
      borderRadius: {
        card: "12px",
        pill: "9999px",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
