import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // Changed for custom domain (www.sandford.systems)
  server: {
    port: 5173
  }
})
