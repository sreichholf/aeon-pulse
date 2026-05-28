import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 800, // Silences warnings for larger cacheable third-party chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group Three.js separately as it is the primary engine dependency
            if (id.includes('three')) {
              return 'vendor-three';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
