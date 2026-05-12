// Importamos `defineConfig` de 'vitest/config' (no de 'vite') · es un
// superset que añade el typing del bloque `test`. Compatible 1:1 con
// las opciones de Vite, así que el resto del archivo no cambia.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // ──────────────────────────────────────────────────────────────────
  // Vitest config (mismo archivo · comparte plugins y resolve con Vite).
  // El triple-slash reference de arriba hace que TypeScript reconozca
  // este bloque sin errores.
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Excluimos node_modules y dist por defecto · añadimos el dir de
    // build de Firebase Functions cuando exista.
    exclude: ['node_modules', 'dist', '.idea', '.git', 'cypress'],
    css: false, // no procesamos CSS en tests · acelera y evita
                // problemas con @import de Ionic.
  },
  plugins: [
    react(),
    // ──────────────────────────────────────────────────────────────────
    // Service Worker · Workbox vía vite-plugin-pwa.
    //
    // Estrategia:
    //   - registerType: 'autoUpdate' → el SW se actualiza solo en
    //     background cuando hay deploy nuevo. Sin prompt al user (BTal
    //     aún no tiene UI de "Hay una nueva versión, recarga").
    //   - injectRegister: 'auto' → el plugin inyecta el script de
    //     registro en index.html en build · no tocamos main.tsx.
    //   - manifest: false → respetamos el `manifest.json` estático
    //     existente en `public/` (linkado desde index.html). Si lo
    //     pusiéramos inline aquí, Workbox generaría un .webmanifest
    //     paralelo y tendríamos dos manifests compitiendo.
    //   - devOptions.enabled: false → el SW solo se monta en build.
    //     En `vite dev` se desactiva para evitar caching agresivo
    //     durante desarrollo (típica trampa: editas un archivo y el
    //     SW sigue sirviendo el viejo).
    //
    // Qué se cachea:
    //   1. Precache · todos los JS/CSS/HTML/imágenes emitidos en `dist/`
    //      (vía globPatterns). En cold start offline, la app entera
    //      arranca sin red.
    //   2. Runtime · Google Fonts (CSS + .woff2) con políticas
    //      apropiadas (SWR para CSS, CacheFirst 1 año para fuentes).
    //   3. Firestore / Auth · NUNCA se cachean (NetworkOnly). Los
    //      datos del usuario tienen que ser live · servirlos desde
    //      caché stale sería peligroso.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Precache de todo lo que sale del build · incluye el manifest.json
        // estático y los iconos PWA. El globIgnore evita cachear los splash
        // de Apple (40+ imágenes específicas de device-pixel-ratio que pesan
        // ~40 MB · solo se usan en la primera carga PWA standalone).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,woff2}'],
        globIgnores: ['**/splash/**', '**/node_modules/**'],
        // Si el precache se queda sin una ruta SPA (cualquier `/app/...`),
        // servimos index.html · React Router resuelve el path.
        navigateFallback: '/index.html',
        // Excluir las rutas que NO son SPA · auth/action son links de
        // email de verificación que necesitan ir al servidor para
        // resolverse contra Firebase.
        navigateFallbackDenylist: [/^\/auth\//, /^\/__\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Aumentamos un poco el límite por archivo · el bundle de
        // tabler-icons-* puede acercarse a los 3 MB sin gzip antes de
        // compresión del Hosting.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // CSS de Google Fonts · se actualiza ocasionalmente · SWR
            // sirve la versión cacheada inmediatamente y revalida en bg.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Archivos .woff2 de Google Fonts · inmutables (versionados
            // por hash) · cache 1 año, no revalidar.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firestore + Auth + Identity Toolkit · NUNCA cachear.
            // Los datos del usuario tienen que ser live · el SW debe
            // dejar pasar las peticiones tal cual.
            urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken|firebaseinstallations)\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Firebase Realtime Database (no usado hoy pero protegido
            // por si se añade en el futuro · NetworkOnly preventivo).
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Imágenes de perfil de Google (avatar) · CacheFirst 7 días.
            // Cambian poco y el user no nota si tarda un día en
            // refrescarse después de cambiar el avatar.
            urlPattern: /^https:\/\/.*\.googleusercontent\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-userimages',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    // Expone la versión del package.json al código en build (AboutModal).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Code splitting manual · sin esto Rollup empaqueta todo en un solo
    // chunk de ~1.5 MB. Separando vendors grandes el chunk principal
    // baja a ~600 KB y firebase/ionic/react cargan en paralelo desde la
    // caché del navegador en navegaciones futuras.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendors externos
          if (id.includes('node_modules')) {
            // Firebase Auth es muy pesado por sí solo · chunk separado
            if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
              return 'firebase-auth';
            }
            // Firebase Firestore (ya lazy-loaded vía dynamic import en
            // services/db.ts, pero algunas piezas pueden colarse aquí)
            if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
              return 'firebase-firestore';
            }
            // Firebase core (app, util)
            if (id.includes('@firebase/') || id.includes('firebase/')) {
              return 'firebase-core';
            }
            // Ionic React + ionicons + componentes web
            if (id.includes('@ionic/') || id.includes('ionicons')) {
              return 'ionic';
            }
            // Tabler Icons React · subset curado (~100 iconos del
            // barrel `utils/iconBarrel.ts`) · ~30-50 KB gzip tras
            // tree-shake. Lazy chunk · solo se carga al primer mount
            // de un `<MealIcon>` (ver utils/iconLoader.ts que hace
            // `import('./iconBarrel')` dinámico).
            if (id.includes('@tabler/icons-react')) {
              return 'tabler-icons';
            }
            // React DOM y router
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // El resto de node_modules cae al chunk vendor genérico
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
})
