import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
