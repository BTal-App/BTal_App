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
//   3. Pulsar el chevron expande con el detalle completo + CTA hacia
//      LinkGuestAccountModal para mantener todo lo tocado.
//
// El componente se auto-oculta para cuentas reales (devuelve null si
// !user.isAnonymous) · seguro de montar en cualquier sitio sin
// condicional en el caller.
//
// Props:
//   - dismissible: true en tabs (default) → muestra × y permite al
//     user ocultarlo permanentemente (localStorage). false en
//     ProfileSheet → siempre visible como red de seguridad: el user
//     puede haber ocultado el banner de las tabs pero al abrir su
//     perfil siempre verá el aviso de caducidad.
//   - inSheet: true cuando vive dentro de ProfileSheet · quita los
//     márgenes horizontales del banner para encajar en el padding
//     del sheet.

interface Props {
  dismissible?: boolean;
  inSheet?: boolean;
}

const DISMISS_KEY = 'btal_guest_banner_dismissed_at';

function isDismissed(): boolean {
  try {
    return !!localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode · best effort */
  }
}

export function GuestBanner({ dismissible = true, inSheet = false }: Props = {}) {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [linkOpen, setLinkOpen] = useState(false);
  // Estado de "ocultado por el user" · solo aplica si dismissible.
  // ProfileSheet pasa dismissible=false y este state queda inerte.
  const [hidden, setHidden] = useState(() => dismissible && isDismissed());
  // Estado de expansión · default colapsado en tabs · expandido en
  // ProfileSheet (no hay espacio para colapsar dentro del sheet y
  // queremos que el mensaje se lea de un vistazo cuando el user va
  // explícitamente a su perfil).
  const [expanded, setExpanded] = useState(inSheet);

  // Días restantes · re-evaluado cada 60s. Para cuentas reales
  // (!user.isAnonymous) devuelve null y el banner no se renderiza.
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

  if (!user?.isAnonymous) return null;
  if (hidden) return null;

  const isUrgent = guestDaysLeft !== null && guestDaysLeft <= 1;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    markDismissed();
    setHidden(true);
  };

  return (
    <>
      <div
        className={
          'guest-banner'
          + (isUrgent ? ' guest-banner--urgent' : '')
          + (expanded ? ' guest-banner--expanded' : '')
          + (inSheet ? ' guest-banner--in-sheet' : '')
        }
      >
        {/* Fila superior · siempre visible. Click expande/contrae.
            Si dismissible, hay un × a la derecha del chevron que
            oculta el banner permanentemente. */}
        <div className="guest-banner-toprow">
          <button
            type="button"
            className="guest-banner-toggle"
            onClick={blurAndRun(() => setExpanded((e) => !e))}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? 'Ocultar detalles del modo prueba'
                : 'Ver detalles del modo prueba'
            }
          >
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
            <MealIcon
              value={expanded ? 'tb:chevron-up' : 'tb:chevron-down'}
              size={16}
            />
          </button>
          {dismissible && (
            <button
              type="button"
              className="guest-banner-dismiss"
              onClick={handleDismiss}
              aria-label="Ocultar aviso (sigue accesible desde el perfil)"
              title="Ocultar (sigue accesible desde el perfil)"
            >
              <MealIcon value="tb:x" size={14} />
            </button>
          )}
        </div>

        {/* Detalle expandible · mensaje completo + CTA hacia el modal
            de vinculación. Solo se renderiza cuando expanded=true. */}
        {expanded && (
          <div className="guest-banner-detail">
            <p className="guest-banner-text">
              Esta sesión de invitado caduca en{' '}
              {guestDaysLeft === null
                ? '3 días'
                : guestDaysLeft === 0
                ? 'menos de un día'
                : guestDaysLeft === 1
                ? '1 día'
                : `${guestDaysLeft} días`}
              . Si no creas una cuenta antes,{' '}
              <strong>todos tus datos se borrarán permanentemente</strong>{' '}
              (perfil, menú, entrenos, compra, suplementos y registro de
              pesos). Al vincular cuenta mantendrás todo lo que has tocado
              en el plan demo.
            </p>
            <button
              type="button"
              className="guest-banner-cta"
              onClick={blurAndRun(() => setLinkOpen(true))}
            >
              Vincular cuenta
              <MealIcon value="tb:arrow-right" size={14} />
            </button>
          </div>
        )}
      </div>

      {linkOpen && (
        <LinkGuestAccountModal
          isOpen={linkOpen}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </>
  );
}
