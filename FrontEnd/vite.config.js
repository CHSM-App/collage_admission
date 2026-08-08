import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    outDir: '../BackEnd/public',  // build SPA straight into the backend web root
    emptyOutDir: true,
    sourcemap: false,  // never expose source in production bundle
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
