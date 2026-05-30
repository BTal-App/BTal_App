import { defineConfig } from 'vitest/config';

// Config de tests AISLADA para functions/. Sin esto, vitest sube por el
// árbol de directorios y hereda la config del frontend (btal/vite.config.ts),
// que referencia src/test/setup.ts (jsdom) inexistente aquí. Las Cloud
// Functions corren en Node, así que environment 'node' y sin setup files.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
