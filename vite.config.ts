import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // ← 追加

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),                             // ← 追加
  ],
})
