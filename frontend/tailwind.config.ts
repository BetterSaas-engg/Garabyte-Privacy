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
        // Garabyte brand palette — pragmatic, editorial, calm
        garabyte: {
          // Deep navy-teal, from the logo. Primary actions, headings.
          primary: {
            50:  "#f0f5f7",
            100: "#d9e4ea",
            200: "#b3c9d5",
            300: "#7fa2b5",
            400: "#4d7a92",
            500: "#2c5a73",   // main brand
            600: "#1f4458",
            700: "#183548",
            800: "#12283a",   // deepest, headers
            900: "#0b1a28",
          },
          // Warm amber — accents, highlights, the "next step" CTA color.
          accent: {
            50:  "#fdf8f0",
            100: "#f9ecd4",
            200: "#f3d9a9",
            300: "#ebc17a",
            400: "#e0a650",
            500: "#d48b2f",   // main accent
            600: "#b57325",
            700: "#8f5a1f",
            800: "#6d441a",
            900: "#4a2e14",
          },
          // Warm cream background. Not pure white — softer, more editorial.
          cream: {
            50:  "#fefdfb",   // primary page background
            100: "#faf8f3",
            200: "#f4f0e8",
            300: "#ebe4d5",
          },
          // Text and borders
          ink: {
            900: "#0f1419",   // body text (charcoal, not black)
            700: "#3a4550",
            500: "#6b7682",
            300: "#b3bac2",
            100: "#e4e7ea",   // subtle borders
          },
          // Status colors for gap severity
          // Deliberately NOT red — calmer, editorial feel
          status: {
            critical: "#b85450",  // muted terracotta
            high:     "#d48b2f",  // brand amber
            moderate: "#7fa2b5",  // muted teal
            good:     "#6b8e6b",  // muted sage
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Georgia", "Cambria", "serif"],
      },
      // Editorial-feeling type scale
      fontSize: {
        "display": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "h1":      ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "h2":      ["1.75rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "h3":      ["1.375rem", { lineHeight: "1.3" }],
      },
      // Softer, slightly larger shadows — feels premium, not flat
      boxShadow: {
        "soft":   "0 2px 8px 0 rgb(15 20 25 / 0.06)",
        "card":   "0 4px 16px 0 rgb(15 20 25 / 0.08)",
        "lifted": "0 8px 32px 0 rgb(15 20 25 / 0.12)",
      },
      borderRadius: {
        "xl": "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
