import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/animations.css'
import App from './App.tsx'

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
