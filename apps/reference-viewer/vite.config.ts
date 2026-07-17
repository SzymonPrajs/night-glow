import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/stars-mag6.json') || id.includes('/src/data/starCatalog.ts')) return 'stars'
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/leaflet/')) return 'map'
          if (id.includes('/node_modules/astronomy-engine/')) return 'astronomy'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/lucide-react/')) return 'ui'
        },
      },
    },
  },
})
