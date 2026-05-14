import { defineConfig, devices } from '@playwright/test';

// Tests E2E con Playwright. Cubren los flujos críticos que no se pueden
// validar con Vitest (la suite actual es solo unit · userDisplay).
//
// Estrategia:
//   - `webServer` arranca automáticamente `npm run preview` (vite preview
//     sobre el bundle ya construido) en el puerto 4173. Si el build no
//     existe, Playwright falla con un error claro · `test:e2e` corre
//     `npm run build` antes para garantizar dist/ presente.
//   - Solo Chromium en CI · suficiente para detectar regresiones a nivel
//     de aplicación. Webkit/Firefox los podemos sumar después si hace
//     falta (más superficie, más tiempo).
//   - `forbidOnly: !!process.env.CI` evita que un `.only()` accidental
//     se cuele a main y haga la suite verde sin correr el resto.
//   - `reporter: 'list'` en local (output limpio) + `html` en CI para
//     poder descargar el artefacto del run y ver screenshots.
//
// Para tests autenticados contra Firebase real:
//   No los hacemos aún · necesitarían Firebase Auth emulator o usuarios
//   de prueba. Los tests actuales se quedan en flujos PRE-AUTH (landing
//   form, legal pages, navegación sin login) que ya cubren un buen %
//   de superficie sin riesgo de ensuciar Firestore.

const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries solo en CI · localmente preferimos ver fallos al instante.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    // Screenshots solo en fallo · evita inflar el artefacto del run.
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    // No reutilizamos servidor existente en CI · queremos un proceso
    // limpio por run. En local sí (más rápido al iterar tests).
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
