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
        background: "#ffffff",
        surface: "#ffffff",
        "surface-subtle": "#f8f9fa",
        "surface-muted": "#f1f3f4",
        border: "#dadce0",
        "border-strong": "#bdc1c6",
        text: {
          primary: "#202124",
          secondary: "#5f6368",
          muted: "#80868b",
          disabled: "#9aa0a6",
        },
        primary: {
          DEFAULT: "#008550",
          hover: "#006c45",
          pressed: "#005638",
          subtle: "#e8f4ee",
        },
        emergency: {
          DEFAULT: "#d93025",
          bg: "#fce8e6",
        },
        urgent: {
          DEFAULT: "#e37400",
          bg: "#fef7e0",
        },
        soon: {
          DEFAULT: "#b06000",
          bg: "#fef7e0",
        },
        routine: {
          DEFAULT: "#188038",
          bg: "#e6f4ea",
        },
        anatomy: {
          selected: "#008550",
          bg: "#e8f4ee",
        },
      },
      boxShadow: {
        menu: "0 2px 8px rgb(60 64 67 / 16%)",
        dialog: "0 8px 24px rgb(60 64 67 / 18%)",
      },
      borderRadius: {
        control: "8px",
        card: "12px",
        panel: "16px",
      },
      fontFamily: {
        sans: ["Inter", "Google Sans", "Roboto", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
