import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          map: ['leaflet'],
          astronomy: ['astronomy-engine'],
          ui: ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
})
