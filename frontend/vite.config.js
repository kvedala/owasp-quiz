
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',  // Relative base for GitHub Pages subdirectory deployment
  plugins: [react()],
  server: { port: 5173 }
})
