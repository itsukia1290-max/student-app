/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // ← React + Vite 用
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1rem",
        lg: "2rem",
        xl: "4rem",
      },
    },
    extend: {
      // ここにカスタムカラーやフォントを追加できます
      zIndex: {
        '999': '999',
      },
    },
  },
  plugins: [],
}
