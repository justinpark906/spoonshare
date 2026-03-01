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
        // Aligned to logo: off-white background, teal spoon, warm red/orange heart, charcoal text
        background: "#F8F8F8",
        surface: "#FFFFFF",
        "surface-muted": "#F0F5F4",
        primary: "#4BA8A7",
        "primary-light": "#71C8BF",
        "primary-pale": "#C4F0E8",
        accent: "#FF6B6B",
        "accent-glow": "#FFD700",
        "accent-soft": "#FFECB3",
        "text-primary": "#4C525A",
        "text-secondary": "#595F66",
        "text-muted": "#6B7280",
        warning: "#F59E0B",
        critical: "#E11D48",
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
