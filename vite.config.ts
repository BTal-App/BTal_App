import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
