import { useState, useSyncExternalStore } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { LinkGuestAccountModal } from './LinkGuestAccountModal';
import { MealIcon } from './MealIcon';
import { blurAndRun } from '../utils/focus';
import './GuestBanner.css';

// Banner permanente que recuerda al invitado:
//   1. Está en modo prueba (datos no persisten en una cuenta real).
//   2. La cuenta caduca en N días · TTL Firestore borra el doc.
//   3. Pulsar = abrir LinkGuestAccountModal para vincular cuenta y
//      mantener todo lo que ha tocado.
//
// El componente se auto-oculta para cuentas reales (devuelve null si
// !user.isAnonymous) · seguro de montar en TODAS las tabs sin
// condicional en el caller. Idempotente: cada montaje crea su propio
// state local, pero el banner UI se ve igual en cualquier tab y solo
// hay UN LinkGuestAccountModal abierto a la vez en el árbol Ionic.
//
// Estado "urgente" (coral pulsante) cuando queda ≤ 1 día · llama la
// atención sin ser intrusivo. El cálculo de días vive en
// useSyncExternalStore para sincronizarse con el reloj externo sin
// violar la regla react-hooks/purity (Date.now() es impura).

export function GuestBanner() {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [linkOpen, setLinkOpen] = useState(false);

  // Días restantes · re-evaluado cada 60s. Para cuentas reales
  // (!user.isAnonymous) devuelve null y el banner no se renderiza.
  // Para invitados sin `expiresAt` (race muy improbable al primer
  // load) tampoco mostramos contador · solo el banner base.
  const guestDaysLeft = useSyncExternalStore(
    (callback) => {
      const id = window.setInterval(callback, 60_000);
      return () => window.clearInterval(id);
    },
    () => {
      if (!user?.isAnonymous) return null;
      const exp = userDoc?.expiresAt;
      if (!exp) return null;
      const expiresMs = typeof exp === 'object' && 'toMillis' in exp
        ? (exp as { toMillis(): number }).toMillis()
        : Number(exp);
      if (!Number.isFinite(expiresMs)) return null;
      return Math.max(0, Math.ceil((expiresMs - Date.now()) / 86400000));
    },
    () => null,
  );

  // Solo aplicable a invitados · devolvemos null para cuentas reales
  // para que los tab pages puedan montar <GuestBanner /> sin condicional.
  if (!user?.isAnonymous) return null;

  return (
    <>
      <button
        type="button"
        className={
          'guest-banner'
          + (guestDaysLeft !== null && guestDaysLeft <= 1
            ? ' guest-banner--urgent'
            : '')
        }
        onClick={blurAndRun(() => setLinkOpen(true))}
      >
        <div className="guest-banner-info">
          <span className="guest-banner-tag">
            Modo prueba
            {guestDaysLeft !== null && (
              <span className="guest-banner-countdown">
                {guestDaysLeft === 0
                  ? '· caduca hoy'
                  : guestDaysLeft === 1
                  ? '· 1 día restante'
                  : `· ${guestDaysLeft} días restantes`}
              </span>
            )}
          </span>
          <span className="guest-banner-text">
            Crea una cuenta para <strong>guardar tus cambios</strong>.
          </span>
        </div>
        <MealIcon value="tb:arrow-right" size={16} />
      </button>

      {/* Modal montado solo cuando se abre · evita renders + listeners
          cuando no se necesita. */}
      {linkOpen && (
        <LinkGuestAccountModal
          isOpen={linkOpen}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </>
  );
}
