import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        // SEU brand palette (extracted from official logo).
        seu: {
          navy: "#31313B",
          red: "#B1222A",
          "red-hover": "#9d1d24",
          gold: "#E4BD4F",
          "gold-hover": "#cda737",
          cream: "#F3EDE4",
          gray: "#67666A",
        },
        // Semantic statuses.
        status: {
          success: "#2E7D32",
          warning: "#E4BD4F",
          danger: "#B1222A",
          info: "#1976D2",
        },
        // Token-driven aliases (drive everything off CSS vars so dark mode is trivial later).
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
        },
      },
      // Round 2 — tighter, sharper.
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      // Quieter shadow vocabulary; brand-tinted "lift" on primary buttons.
      boxShadow: {
        card: "0 1px 2px rgba(49, 49, 59, 0.04), 0 0 0 1px rgba(49, 49, 59, 0.04)",
        "card-lift":
          "0 4px 16px rgba(49, 49, 59, 0.10), 0 0 0 1px rgba(49, 49, 59, 0.06)",
        modal: "0 8px 40px rgba(49, 49, 59, 0.18)",
        "btn-hover": "0 4px 16px rgba(177, 34, 42, 0.28)",
        "inner-line": "inset 0 -1px 0 rgba(49, 49, 59, 0.08)",
      },
      // Linear-style monospace fallback for IDs / numbers.
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Density-aware spacing helpers (in addition to the standard 4px scale).
      spacing: {
        header: "var(--density-header)",
        row: "var(--density-row)",
        th: "var(--density-th)",
        ctl: "var(--density-input)",
      },
      // Type scale aligned with WCAG AA + ui-ux-pro-max guidance:
      // body ≥ 14px, secondary ≥ 12px. Still denser than Material defaults
      // but no longer falls below the legibility floor.
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.4" }],
        xs: ["12px", { lineHeight: "1.45" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.55" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["19px", { lineHeight: "1.4" }],
        "2xl": ["23px", { lineHeight: "1.3" }],
        "3xl": ["29px", { lineHeight: "1.2" }],
      },
      keyframes: {
        // Page enter
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Sidebar active red border slide-in
        "border-slide-in": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
        // Skeleton shimmer (gradient sweeps left→right)
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Toast progress bar drain
        drain: {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
        // Conflict pulse (schedule slot border)
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(177, 34, 42, 0.5)" },
          "50%": { boxShadow: "0 0 0 6px rgba(177, 34, 42, 0)" },
        },
        // Live dot
        "live-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.7" },
        },
        // Modal spring
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "border-slide-in": "border-slide-in 150ms ease-out both",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        drain: "drain 4s linear forwards",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "live-dot": "live-dot 1.4s ease-in-out infinite",
        "scale-in": "scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
