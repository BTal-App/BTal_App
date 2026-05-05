import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
