// # Filename: tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          app: "#030607",
          "app-soft": "#071011",
          "app-panel": "#090D0F",
        },
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          elevated: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.09)",
        },
        border: {
          soft: "rgba(255,255,255,0.08)",
          DEFAULT: "rgba(255,255,255,0.12)",
          strong: "rgba(255,255,255,0.18)",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#A1A1AA",
          muted: "#71717A",
          faint: "#52525B",
        },
        brand: {
          cyan: {
            50: "#ECFEFF",
            100: "#CFFAFE",
            200: "#A5F3FC",
            300: "#67E8F9",
            400: "#22D3EE",
            500: "#06B6D4",
            600: "#0891B2",
            700: "#0E7490",
            800: "#155E75",
            900: "#164E63",
            DEFAULT: "#22D3EE",
          },
          emerald: {
            50: "#ECFDF5",
            100: "#D1FAE5",
            200: "#A7F3D0",
            300: "#6EE7B7",
            400: "#34D399",
            500: "#10B981",
            600: "#059669",
            700: "#047857",
            800: "#065F46",
            900: "#064E3B",
            DEFAULT: "#34D399",
          },
          violet: {
            50: "#F5F3FF",
            100: "#EDE9FE",
            200: "#DDD6FE",
            300: "#C4B5FD",
            400: "#A78BFA",
            500: "#8B5CF6",
            600: "#7C3AED",
            700: "#6D28D9",
            800: "#5B21B6",
            900: "#4C1D95",
            DEFAULT: "#A78BFA",
          },
          amber: {
            50: "#FFFBEB",
            100: "#FEF3C7",
            200: "#FDE68A",
            300: "#FCD34D",
            400: "#FBBF24",
            500: "#F59E0B",
            600: "#D97706",
            700: "#B45309",
            800: "#92400E",
            900: "#78350F",
            DEFAULT: "#FBBF24",
          },
          rose: {
            50: "#FFF1F2",
            100: "#FFE4E6",
            200: "#FECDD3",
            300: "#FDA4AF",
            400: "#FB7185",
            500: "#F43F5E",
            600: "#E11D48",
            700: "#BE123C",
            800: "#9F1239",
            900: "#881337",
            DEFAULT: "#FB7185",
          },
        },
      },
      fontFamily: {
        sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "1.5rem",
        panel: "2rem",
        button: "9999px",
      },
      boxShadow: {
        "glow-cyan": "0 0 36px rgba(34, 211, 238, 0.22)",
        "glow-emerald": "0 0 36px rgba(52, 211, 153, 0.2)",
        "glow-violet": "0 0 36px rgba(167, 139, 250, 0.22)",
        "glow-rose": "0 0 36px rgba(251, 113, 133, 0.22)",
        "card-soft":
          "0 24px 80px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
      backgroundImage: {
        "radial-cyan-glow":
          "radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.22), transparent 34rem)",
        "radial-violet-glow":
          "radial-gradient(circle at 50% 0%, rgba(167, 139, 250, 0.2), transparent 34rem)",
        "dot-grid":
          "radial-gradient(circle, rgba(255, 255, 255, 0.14) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
