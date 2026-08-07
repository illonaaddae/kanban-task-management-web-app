import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the large dependencies into their own chunks.
         *
         * Two reasons. Caching: these change only when a dependency is upgraded,
         * so a routine app deploy no longer invalidates ~150 kB of React for
         * every returning visitor. And clarity: with everything in one file the
         * size warning says only "your bundle is big", which is not actionable.
         *
         * Route-level code is already split with React.lazy in App.tsx; this
         * handles the vendor half, which lazy loading cannot reach because these
         * are shared by every route.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
