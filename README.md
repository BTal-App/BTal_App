# BTal

> Fitness & nutrition tracker · multi-usuario · PWA en web + nativo en iOS/Android vía Capacitor

Deploy en producción: <https://btal-app.web.app>

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| UI | Ionic 8 (web components nativos · tab bar, modals, sheets) |
| Iconos | Tabler Icons via `<MealIcon>` (lazy load + tree-shake barrel) + Ionicons (solo `IonTabBar` y `logoGoogle`) |
| Móvil | Capacitor 8 (`com.btal.app`) — proyectos nativos iOS + Android |
| Backend | Firebase (Auth + Firestore + Hosting) |
| Estado | Context providers (`AuthProvider`, `ProfileProvider`, `PreferencesProvider`, `ErrorProvider`) |
| IA | Gemini Flash-Lite (en Cloud Functions · pendiente Fase 6) |
| Pagos | Stripe (pago único + suscripción Pro · pendiente Fase 7) |

## Comandos

```bash
npm install            # Dependencias
npm run dev            # Dev server con HMR (http://localhost:5173)
npm run build          # tsc -b + vite build → dist/
npm run preview        # Servir el build localmente
npm run lint           # ESLint
npx tsc --noEmit       # Typecheck sin emitir archivos

# Deploy (requiere `firebase login` previo)
firebase deploy --only hosting      # solo el frontend
firebase deploy --only firestore    # solo las reglas + indexes
firebase deploy                     # todo
```

## Estructura

```
src/
├── pages/
│   ├── Landing.tsx                 Login / Register / Modo prueba
│   ├── Onboarding.tsx              4 pasos · medical disclaimer · IA/Manual
│   ├── AuthAction.tsx              Handler de los 6 modos Firebase
│   ├── Settings.tsx                Avatar editable · Account · Preferences · Soporte · About
│   ├── LegalPlaceholder.tsx        Privacy / Terms / Cookies
│   └── app/                        Shell tabs autenticado
│       ├── AppShell.tsx            IonTabs + 5 sub-rutas + bottom bar
│       ├── HoyPage.tsx             Tab Hoy · entreno + comidas + supl. del día
│       ├── MenuPage.tsx            Tab Menú · 7 días × 4 comidas + extras + supl
│       ├── CompraPage.tsx          Tab Compra · categorías + tracker + coste suplem.
│       ├── EntrenoPage.tsx         Tab Entreno · plan switcher + DiaCard + sheet
│       └── RegistroPage.tsx        Tab Registro · calendar + stats + day panel + sparklines
├── components/                     Reutilizables (modals, sheets, inputs)
│   ├── MealIcon.tsx                Render Tabler universal con lazy load
│   ├── IconPicker.tsx              Picker visual con tabs y búsqueda ES
│   ├── MealSheet.tsx               Bottom sheet detalle de Comida/ComidaExtra
│   ├── TrainSheet.tsx              Bottom sheet detalle de DiaEntreno
│   ├── ProfileSheet.tsx            Bottom sheet perfil + atajos a Edit/Settings/Graphs
│   ├── ConfirmDiffAlert.tsx        Modal "antes → después" custom (no IonAlert)
│   ├── ErrorBoundary.tsx           Fallback con "Recargar" + "Ir al inicio"
│   └── graphs/GraphsModal.tsx      Modal de gráficas (entrenos / PRs / pesos / supl)
├── hooks/                          Context providers + hooks
│   ├── AuthContext + useAuth       Firebase Auth + refreshUser
│   ├── ProfileProvider + useProfile  Firestore /users/{uid} + optimistic updates
│   ├── PreferencesProvider + usePreferences  Units, week start, navStyle
│   ├── ErrorProvider + useError    Canal global de errores → toast rojo
│   ├── VerifyBannerProvider        Banner "Verifica tu email" auto-dismiss
│   ├── AdblockBanner               Detector ERR_BLOCKED_BY_CLIENT → banner
│   └── useSaveStatus               saving/saved/error con `runSave` wrapper
├── services/                       Capa de datos · TODO acceso a Firebase pasa por aquí
│   ├── firebase.ts                 App + Auth (sync) + lazy Firestore
│   ├── auth.ts                     Sign-in/up/out · linkAnonymous · MFA TOTP · reauth
│   ├── db.ts                       Firestore lazy-loaded · update helpers tipados
│   ├── functions.ts                (pendiente Fase 6) Cloud Functions wrapper
│   └── analytics.ts                (pendiente) GA4 / Firebase Analytics
├── templates/                      Schemas + factories + defaults
│   ├── defaultUser.ts              Tipos `UserDocument`, `Menu`, `Entrenos`, `Compra`, `Suplementos`
│   ├── demoUser.ts                 Plan completo para invitados (Push/Pull/Legs+Brazos · 4 días)
│   └── exerciseCatalog.ts          Tipos de badges (PECHO, TRICEPS, ESPALDA, etc.)
├── utils/
│   ├── units.ts                    Conversiones kg↔lb, cm↔in · formatWeight, formatHeight
│   ├── ia.ts                       canGenerateAi(userDoc, scope) · límite mensual del plan
│   ├── timeParser.ts               parseTiempoEstimado / formatTiempoEstimado / horaToMinutes
│   ├── dateKeys.ts                 todayDateStr, todayKey, isoWeekKey, monthKey, yearKey
│   ├── focus.ts                    blurAndRun() · accessibility helper
│   ├── confirmDiff.ts              pushDiff helper para ConfirmDiffAlert
│   └── numericInput.ts             blockNonInteger, clampInt
├── theme/
│   └── variables.css               Paleta + overrides Ionic + tab bar styles
├── styles/
│   └── animations.css              Keyframes globales + press feedback + reduced-motion
├── App.tsx                         Composición de providers + IonReactRouter
├── main.tsx                        Entrypoint + body class para nav style
└── index.css                       Reset + anti iOS auto-zoom para inputs
```

## Variables de entorno

Copia `.env.example` → `.env` y rellena con las claves de tu proyecto Firebase. El validador en `services/firebase.ts` avisa por consola si falta alguna `VITE_FIREBASE_*` en dev.

**Nunca subas `.env` a Git** (ya está en `.gitignore`).

## Configuración Firebase

- **Firestore**: reglas en `firestore.rules` · Sub-fase 11-1 valida rangos de profile + tamaño máx 100 KB del doc.
- **Hosting**: config en `firebase.json` con CSP completa, HSTS, X-Frame-Options, Permissions-Policy, Cache-Control granular.
- **Auth**: Identity Platform habilitado · email+password + Google · MFA TOTP código listo (falta activar en consola).

## Cómo añadir...

### Un componente reutilizable

1. Crea `src/components/MiComponente.tsx` + `MiComponente.css`.
2. Si necesita estado global, usa los providers existentes (`useProfile`, `usePreferences`, `useError`).
3. Si necesita un toast de error, importa `useError` y llama `showError(msg)` en el catch.
4. Si tiene animaciones, usa las clases helper de `styles/animations.css` (`btal-anim-pop-in`, `btal-anim-fade-up`, etc.) o keyframes propios con prefijo `btal-`.
5. Mantén `text-transform`, `font-family: 'Inter'`, paleta `var(--btal-*)` y `border-radius` coherentes con el resto de la app.

### Un icono nuevo (Tabler)

1. Verifica que existe el archivo en `node_modules/@tabler/icons-react/dist/esm/icons/IconXxxx.mjs`.
2. Añade entrada en `src/utils/iconRegistry.ts` con `id: 'tb:slug'`, `importName: 'IconXxxx'`, `category` y `tags_es`.
3. Añade el `importName` en orden alfabético en `src/utils/iconBarrel.ts` (la lista de re-exports NAMED · es lo que tree-shake al chunk lazy de Tabler).
4. Úsalo en JSX: `<MealIcon value="tb:slug" size={N} />`.

### Una pestaña / página nueva

1. Crea `src/pages/app/MiTab.tsx`.
2. Añádela como `<Route>` dentro de `AppShell.tsx`.
3. Añade su `<IonTabButton>` con icono + label en el `<IonTabBar>` del shell.

### Un campo nuevo al `UserDocument`

1. Añade el campo (opcional para retrocompat) al tipo en `src/templates/defaultUser.ts`.
2. Si es un campo crítico (default necesario), añade lógica a `ensureUserDocumentSchema` en `services/db.ts` para sembrar el default al leer docs antiguos.
3. Si tiene rango validable (rango numérico o lista cerrada), añade su validación a `firestore.rules` dentro de `profileValid()` o equivalente.
4. Si vive en `preferences`, recuerda actualizar también `loadFromLocal` en `PreferencesProvider.tsx` para normalizar lecturas locales.

## Roadmap

Ver `web plan muscular HTML/web_estructura_APP/index.html` (en la raíz del workspace) — contiene el banner de estado actual del proyecto, hoja de ruta completa fase a fase, y el modelo de monetización.

## Notas técnicas relevantes

- **iOS auto-zoom**: `index.css` fuerza `font-size: 16px` en inputs en `@media (hover: none) and (pointer: coarse)` para evitar el auto-zoom de Safari iOS al focusar.
- **Optimistic updates**: todos los writes en `ProfileProvider` aplican el cambio en local PRIMERO y revierten si Firestore falla · el snapshot pre-cambio se guarda en una closure local.
- **Sub-colecciones**: `/users/{uid}/registros/{YYYY-MM-DD}` para no inflar el doc principal con histórico.
- **Anti-doble registro**: `main.tsx` registra los listeners `ionXxxWillPresent` globalmente con bandera `__btalOverlayBlurInstalled` · evita acumulación tras HMR.
- **Lazy loading**: Firestore y Tabler Icons se cargan vía `import()` dinámico · no entran al bundle inicial. Chunk inicial ~107 KB gz.
- **Press feedback global**: `styles/animations.css` aplica `transform: translateY(1px) scale(0.97); filter: brightness(0.92)` con `!important` a TODOS los `<button>`, `<IonButton>`, `<a>`, `[role="button"]`, y partes shadow DOM de IonAlert/IonActionSheet/IonToast/IonPicker.
- **Backward-compat de prefs**: `loadFromLocal` en `PreferencesProvider` acepta los nombres legacy `'tiktok'`/`'ig'` de `navStyle` y los normaliza a `'labeled'`/`'compact'`.
