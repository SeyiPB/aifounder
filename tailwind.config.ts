import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Civic Hall Summer Camp palette: deep navy + bright yellow accent.
        ink: "#0e1827", // slightly darker navy for full-bleed backgrounds
        navy: "#162639", // primary brand / interactive
        navyhover: "#22364f",
        accent: { DEFAULT: "#fff96d", soft: "#fffcb5" }, // signature yellow
        // `brand` aliases navy so existing primary buttons stay accessible
        brand: { DEFAULT: "#162639", light: "#22364f" },
      },
    },
  },
  plugins: [],
};
export default config;
