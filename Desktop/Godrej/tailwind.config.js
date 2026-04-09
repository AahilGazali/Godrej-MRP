/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        success: "#16A34A",
        danger: "#DC2626",
        appbg: "#F8FAFC",
        border: "#E2E8F0",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 16px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
}

