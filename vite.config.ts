import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/PulseQuiz/',  // For GitHub Pages at idealase.github.io/PulseQuiz/
  server: {
    port: 5173
  }
})
