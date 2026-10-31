import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

const palme = { 50: "#EAF3F0", 100: "#CFE3DC", 200: "#A3CABD", 300: "#6FAB99", 400: "#3F8B76", 500: "#1E705C", 600: "#0E5A4B", 700: "#0B4A3E", 800: "#093A31", 900: "#062A24", 950: "#031B17" };
const deglet = { 50: "#FBF4E4", 100: "#F5E5BF", 200: "#ECCE8A", 300: "#E0B155", 400: "#D49A2E", 500: "#C98A1B", 600: "#A86F0C", 700: "#87580C", 800: "#6B460F", 900: "#53370F", 950: "#2E1E07" };
const danger = { 50: "#FBEDEB", 100: "#F6D5D1", 200: "#ECABA4", 300: "#DF7C72", 400: "#CF5246", 500: "#B3261E", 600: "#9A1F18", 700: "#7E1913", 800: "#651511", 900: "#4E110E", 950: "#2C0907" };
const djerid = { 50: "#E9F1F6", 100: "#CCDFEA", 200: "#9FC3D8", 300: "#6CA2C1", 400: "#4286A9", 500: "#1F6287", 600: "#1A5374", 700: "#154560", 800: "#11384E", 900: "#0D2B3C", 950: "#071A25" };
const pierre = { 50: "#F6F7F6", 100: "#ECEEEC", 200: "#DDE0DD", 300: "#C5C9C5", 400: "#9A9F9A", 500: "#6F746F", 600: "#555A55", 700: "#424642", 800: "#2E312E", 900: "#1F211F", 950: "#121312" };

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["Barlow Semi Condensed", "Barlow", "system-ui", "sans-serif"],
        mono: ["Barlow Semi Condensed", "Barlow", "system-ui", "sans-serif"],
      },
      colors: {
        // One palette for the whole product: Tailwind's colour names resolve to the
        // Date Harvest scales, so no module can introduce a colour of its own.
        emerald: palme, green: palme, lime: palme, teal: palme,
        amber: deglet, yellow: deglet, orange: deglet,
        red: danger, rose: danger, pink: danger,
        sky: djerid, blue: djerid, cyan: djerid, indigo: djerid, violet: djerid, purple: djerid, fuchsia: djerid,
        slate: pierre, gray: pierre, zinc: pierre, neutral: pierre, stone: pierre,
        datte: { DEFAULT: "#2B1810", light: "#3C2418" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        "3xl": "var(--radius-lg)",
        "2xl": "var(--radius-lg)",
        xl: "var(--radius)",
        lg: "var(--radius)",
        md: "var(--radius-sm)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        sm: "none",
        DEFAULT: "none",
        md: "0 1px 3px hsl(18 30% 12% / 0.12)",
        lg: "0 6px 20px hsl(18 30% 12% / 0.14)",
        xl: "0 12px 32px hsl(18 30% 12% / 0.18)",
        "2xl": "0 16px 40px hsl(18 30% 12% / 0.2)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "page-enter": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "blur-in": {
          from: { opacity: "0", filter: "blur(6px)" },
          to: { opacity: "1", filter: "blur(0px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.82)", opacity: "0" },
          "55%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-once": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "tab-indicator": {
          from: { transform: "scaleX(0)", opacity: "0" },
          to: { transform: "scaleX(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-up": "slide-up 0.35s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "page-enter": "page-enter 0.14s ease-out",
        "scale-in": "scale-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        "blur-in": "blur-in 0.4s ease-out",
        float: "float 3s ease-in-out infinite",
        "pulse-subtle": "pulse-subtle 2.5s ease-in-out infinite",
        "bounce-in": "bounce-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.8s infinite linear",
        "spin-once": "spin-once 0.5s ease-out",
        "tab-indicator": "tab-indicator 0.25s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate, plugin(({ addVariant }) => addVariant("pointer-coarse", "@media (pointer: coarse)"))],
} satisfies Config;
