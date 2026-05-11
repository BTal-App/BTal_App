import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/animations.css'
import App from './App.tsx'

// ── Estilo del nav inferior · aplicar body class lo antes posible ──
// La preferencia persistente vive en `preferences.navStyle`
// (localStorage + Firestore vía PreferencesProvider). PreferencesProvider
// también gestiona el body class en un effect, pero ese effect corre
// DESPUÉS del primer render · si esperamos a eso, la primera pintada
// muestra el bar sin clase (FOUC). Aquí leemos directamente del
// localStorage / sessionStorage para aplicar la clase ANTES de que
// React monte · misma fuente de verdad, sin lag visual.
//
// Override temporal vía URL param para compartir previews:
//   ?nav=labeled → fuerza estilo con etiquetas (sessionStorage, solo esta pestaña)
//   ?nav=compact → fuerza solo iconos (sessionStorage)
//   ?nav=reset   → limpia override y vuelve a la preferencia persistente
//
// Compat: valores legados `?nav=tiktok|ig` se aceptan también
// (normalizan al guardar en sessionStorage).
{
  const url = new URL(window.location.href)
  const navParam = url.searchParams.get('nav')
  const normalizedParam =
    navParam === 'tiktok' || navParam === 'labeled' ? 'labeled'
    : navParam === 'ig' || navParam === 'compact' ? 'compact'
    : null
  if (normalizedParam) {
    sessionStorage.setItem('btal-nav-preview', normalizedParam)
  } else if (navParam === 'default' || navParam === 'reset') {
    sessionStorage.removeItem('btal-nav-preview')
  }
  // Resolver estilo efectivo: override de URL > preferencia persistente
  // > default 'labeled'. Acepta legacy values en localStorage.
  let effectiveNav: 'labeled' | 'compact' = 'labeled'
  try {
    const preview = sessionStorage.getItem('btal-nav-preview')
    if (preview === 'labeled' || preview === 'tiktok') {
      effectiveNav = 'labeled'
    } else if (preview === 'compact' || preview === 'ig') {
      effectiveNav = 'compact'
    } else {
      const raw = localStorage.getItem('btal_preferences')
      if (raw) {
        const parsed = JSON.parse(raw) as { navStyle?: string }
        if (parsed.navStyle === 'compact' || parsed.navStyle === 'ig') {
          effectiveNav = 'compact'
        }
      }
    }
  } catch {
    /* private mode · best effort, default 'labeled' */
  }
  document.body.classList.add(
    effectiveNav === 'compact' ? 'nav-compact' : 'nav-labeled',
  )
}

// ── Auto-blur global cuando cualquier overlay de Ionic va a abrirse ─
// Cualquier IonModal / IonAlert / IonPopover / IonActionSheet aplica
// aria-hidden="true" al ion-router-outlet de fondo. Si el botón que
// disparó la apertura conserva foco (típico en IonButton, cuyo focus
// vive en `<a.button-native>` del shadow DOM), saltan warnings de
// accesibilidad: "Blocked aria-hidden because its descendant retained
// focus".
//
// En lugar de añadir blur() en cada onClick (frágil), registramos UNA
// vez los eventos *WillPresent de Ionic y hacemos blur del
// activeElement antes de que el aria-hidden caiga. Cubre TODOS los
// overlays presentes y futuros sin tener que tocar cada componente.
//
// Bandera anti-doble-registro · evita que Vite HMR / re-imports del
// módulo acumulen listeners cada vez que el código cambia en dev.
type WindowWithBtalFlag = typeof window & { __btalOverlayBlurInstalled?: true }
if (!(window as WindowWithBtalFlag).__btalOverlayBlurInstalled) {
  ;(window as WindowWithBtalFlag).__btalOverlayBlurInstalled = true
  const overlayWillPresentEvents = [
    'ionModalWillPresent',
    'ionAlertWillPresent',
    'ionPopoverWillPresent',
    'ionActionSheetWillPresent',
    'ionPickerWillPresent',
  ] as const
  overlayWillPresentEvents.forEach((evt) => {
    document.addEventListener(evt, () => {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && typeof active.blur === 'function') {
        active.blur()
      }
    })
  })
}



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Splash screen: lo eliminamos tras un mínimo, dando tiempo a que React monte.
// En PWA standalone iOS ya muestra su splash nativo antes; encadenamos uno más
// corto para una transición fluida. En navegador, el HTML splash es lo único
// que ve el usuario, así que dejamos un pelín más para que se note el pulse.
const splash = document.getElementById('btal-splash')
if (splash) {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  const minDuration = isStandalone ? 250 : 500
  setTimeout(() => {
    splash.classList.add('fade-out')
    // Tras la animación de fade-out (.35s) lo eliminamos del DOM
    setTimeout(() => splash.remove(), 380)
  }, minDuration)
}
