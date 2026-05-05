# BTal

> Fitness & nutrition tracker · multi-usuario · PWA + nativo (iOS/Android)

## Stack

- **Frontend**: Vite + React 19 + TypeScript
- **UI**: Ionic 8 (web components nativos en móvil)
- **Móvil**: Capacitor (Android + iOS · `com.btal.app`)
- **Backend**: Firebase (Auth + Firestore + Cloud Functions)
- **IA**: Gemini Flash-Lite (en Cloud Functions)
- **Pagos**: Stripe (pago único 4,99€ · suscripción Pro 9,99€/mes)

## Comandos

```bash
npm run dev      # Servidor de desarrollo (http://localhost:5173)
npm run build    # Build de producción → dist/
npm run preview  # Preview del build
```

## Estructura

```
src/
├── pages/          Pantallas principales (Landing, Onboarding, Dashboard…)
├── components/     Componentes reutilizables (organizados por dominio)
│   ├── nutrition/
│   ├── training/
│   ├── shopping/
│   ├── supplements/
│   └── ui/         Header, Modal, EmptyState, ConfirmModal…
├── services/       Capa de datos · TODO acceso a Firebase pasa por aquí
│   ├── firebase.ts (App + Auth)
│   ├── auth.ts     (sign-in/up/out, Google con redirect en PWA)
│   ├── db.ts       (Firestore lazy-loaded)
│   └── functions.ts (pendiente · Cloud Functions)
├── hooks/          AuthContext (useAuth), useProfile, useUserData
├── templates/      defaultUser.ts, demoUser.ts, exercises.ts, badges.ts
└── theme/          variables.css (paleta + overrides Ionic)
```

## Variables de entorno

Copia `.env.example` a `.env` y rellena con las claves de tu proyecto Firebase.
**Nunca subas `.env` a Git** (ya está en `.gitignore`).

## Roadmap

Ver `index_estructura_CLAUDE.html` (en la raíz del workspace) — contiene la hoja de ruta completa fase a fase y el modelo de monetización.
