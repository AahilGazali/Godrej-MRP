/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#FFFFFF",
        secondary: "#810055",
        neutral: "#000000",
        page: "#ffffff",
        card: "#FFFFFF",
        line: "#E5E7EB",
        success: "#16A34A",
        danger: "#DC2626",
        appbg: "#F5F7FA",
        border: "#E5E7EB",
      },
      fontFamily: {
        sans: ["GEGHeadline", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08)",
        card: "0 1px 3px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
