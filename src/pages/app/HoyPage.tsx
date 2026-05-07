import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  arrowForwardOutline,
  barbellOutline,
  cafeOutline,
  flashOutline,
  flaskOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { TabHeader } from '../../components/TabHeader';
import { VerifyEmailBanner } from '../../components/VerifyEmailBanner';
import { ProfileSheet } from '../../components/ProfileSheet';
import { LinkGuestAccountModal } from '../../components/LinkGuestAccountModal';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { blurAndRun } from '../../utils/focus';
import { greetingName, initialsOf } from '../../utils/userDisplay';
import './HoyPage.css';

// Capitaliza la primera letra de cada palabra (excepto preposiciones cortas).
// Para mostrar la fecha tipo "Viernes · 6 Mayo 2026".
function formatToday(date: Date): string {
  const dow = date.toLocaleDateString('es-ES', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('es-ES', { month: 'long' });
  const year = date.getFullYear();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(dow)} · ${day} ${cap(month)} ${year}`;
}

const HoyPage: React.FC = () => {
  const { user, loading } = useAuth();
  const { profile: userDoc, loading: profileLoading } = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [linkGuestOpen, setLinkGuestOpen] = useState(false);
  const [aiGenOpen, setAiGenOpen] = useState(false);

  if (loading || !user) {
    return (
      <IonPage className="app-tab-page">
        <IonContent fullscreen>
          <div className="app-shell-loading">
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Saludo: preferimos el displayName de Auth (cuenta real con nombre o
  // foto de Google), pero caemos al `profile.nombre` de Firestore para
  // cubrir el caso del invitado (Auth anónimo, sin displayName) y para
  // cuentas que no rellenaron displayName en Auth pero sí en onboarding.
  const profileFirstName = userDoc?.profile?.nombre?.trim().split(/\s+/)[0] || null;
  const displayName = greetingName(user) ?? profileFirstName;
  // Mismas reglas para las iniciales del avatar — si el invitado se
  // llama "Invitado" en su perfil queremos ver "I", no "?".
  const initials =
    user.displayName?.trim() || user.email
      ? initialsOf(user.displayName, user.email)
      : initialsOf(profileFirstName ?? null, null);
  const today = formatToday(new Date());

  // Streak (racha de días consecutivos): aún no implementado en Firestore.
  // Se calculará en una iteración futura a partir de los logs de entreno.
  // Mientras tanto el pill no se muestra para no inventar datos.
  const streak: number | null = null;

  // El plan generado por IA aún no existe (Cloud Functions / Gemini en
  // Fase 6). Para todas las cuentas reales actuales, hasPlan = false.
  const hasPlan = false;

  // ¿Mostramos el botón "Generar con IA"? Solo si:
  //   - el user no es invitado (los anónimos no pueden usar IA)
  //   - el user eligió modo='ai' en el onboarding o desde Settings
  // En modo='manual' los botones IA quedan ocultos por completo.
  const showAiButton =
    !user.isAnonymous && userDoc?.profile?.modo === 'ai';

  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title={displayName ? 'Hola, ' : '¡Hola!'}
            accent={displayName ?? undefined}
            subtitle={today}
            uppercase={false}
            right={
              <>
                {streak !== null && (
                  <div className="app-streak-pill">
                    <IonIcon icon={flashOutline} />
                    {streak} días
                  </div>
                )}
                <button
                  type="button"
                  className="app-avatar-btn"
                  onClick={blurAndRun(() => setProfileOpen(true))}
                  aria-label="Abrir perfil"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </button>
              </>
            }
          />

          {/* Banner verificación de email — solo si el user tiene email
              y aún no lo ha verificado y no es invitado. */}
          {user.email && !user.emailVerified && !user.isAnonymous && (
            <VerifyEmailBanner user={user} place="dashboard" />
          )}

          {/* Banner del invitado · CTA para registrarse conservando el uid.
              `linkAnonymousAccount` mantiene el doc /users/{uid} intacto,
              así que el menú/entrenos demo se transfieren a la cuenta real. */}
          {user.isAnonymous && (
            <button
              type="button"
              className="hoy-guest-banner"
              onClick={blurAndRun(() => setLinkGuestOpen(true))}
            >
              <div className="hoy-guest-banner-info">
                <span className="hoy-guest-banner-tag">Modo prueba</span>
                <span className="hoy-guest-banner-text">
                  Crea una cuenta para <strong>guardar tus cambios</strong>.
                  Mantendrás todo lo que has tocado en el plan demo.
                </span>
              </div>
              <IonIcon icon={arrowForwardOutline} />
            </button>
          )}

          {/* ─────────────── HERO CARD ─────────────── */}
          {/* Mientras no haya plan, mostramos un hero "vacío" claro:
              estructura igual al v2 pero sin números falsos. */}
          {!hasPlan ? (
            <div className="hoy-hero hoy-hero--empty">
              <div className="hoy-hero-label">
                <span className="hoy-hero-dot" />
                Tu plan diario
                <AiGeneratedBadge userDoc={userDoc} scope="any" />
              </div>
              <h2 className="hoy-hero-title">Aún sin plan generado</h2>
              <p className="hoy-hero-sub">
                {userDoc?.profile?.completed
                  ? 'En cuanto activemos el generador de IA crearemos tu plan diario con macros, comidas y entreno a partir de tu perfil.'
                  : user.isAnonymous
                  ? 'Crea una cuenta y completa el onboarding para que podamos generar tu plan personalizado.'
                  : 'Completa tu perfil para que podamos generar tu plan personalizado.'}
              </p>
              {showAiButton ? (
                <button
                  type="button"
                  className="hoy-hero-cta"
                  onClick={blurAndRun(() => setAiGenOpen(true))}
                >
                  <IonIcon icon={sparklesOutline} />
                  Generar mi plan con IA
                </button>
              ) : (
                <div className="hoy-hero-tag">
                  <IonIcon icon={sparklesOutline} />
                  {user.isAnonymous
                    ? 'Datos de ejemplo · regístrate para personalizar'
                    : 'Cambia a modo IA en Ajustes para generar tu plan'}
                </div>
              )}
            </div>
          ) : null}

          {/* ─────────────── ENTRENO DE HOY ─────────────── */}
          <div className="app-section-title">
            <h2>Entreno de hoy</h2>
          </div>
          <div className="hoy-empty-card">
            <div className="hoy-empty-icon">
              <IonIcon icon={barbellOutline} />
            </div>
            <div className="hoy-empty-info">
              <span className="hoy-empty-title">Sin entreno asignado</span>
              <span className="hoy-empty-sub">
                Aquí aparecerá tu sesión del día (ejercicios, series, tiempo
                estimado) cuando definamos tu plan.
              </span>
            </div>
          </div>

          {/* ─────────────── COMIDAS DE HOY ─────────────── */}
          <div className="app-section-title">
            <h2>Comidas de hoy</h2>
          </div>
          <div className="hoy-empty-card">
            <div className="hoy-empty-icon">
              <IonIcon icon={cafeOutline} />
            </div>
            <div className="hoy-empty-info">
              <span className="hoy-empty-title">Sin menú generado</span>
              <span className="hoy-empty-sub">
                Desayuno, comida, merienda y cena con sus macros aparecerán
                aquí al generar tu plan.
              </span>
            </div>
          </div>

          {/* ─────────────── SUPLEMENTACIÓN ─────────────── */}
          <div className="app-section-title">
            <h2>Suplementación</h2>
          </div>
          <div className="hoy-empty-card">
            <div className="hoy-empty-icon">
              <IonIcon icon={flaskOutline} />
            </div>
            <div className="hoy-empty-info">
              <span className="hoy-empty-title">Sin suplementos definidos</span>
              <span className="hoy-empty-sub">
                Recordatorios de batido proteico, creatina y otros suplementos
                que vayas a tomar saldrán en este bloque.
              </span>
            </div>
          </div>

          <div className="app-tab-pad-bottom" />
        </div>

        {/* Cargamos lazy: solo se monta cuando el user lo abre */}
        {profileOpen && (
          <ProfileSheet
            isOpen={profileOpen}
            user={user}
            onClose={() => setProfileOpen(false)}
          />
        )}

        {/* Modal de conversión invitado → cuenta real. Solo se monta para
            invitados (no tiene sentido para users con cuenta). */}
        {user.isAnonymous && linkGuestOpen && (
          <LinkGuestAccountModal
            isOpen={linkGuestOpen}
            onClose={() => setLinkGuestOpen(false)}
          />
        )}

        {/* Modal "Generar con IA" maestro · pregunta el scope completo
            (las 4 opciones). Solo se monta cuando se va a abrir.
            defaultScope se pasa "tal cual" del perfil — el modal lo
            valida internamente contra availableScopes. */}
        {showAiButton && aiGenOpen && (
          <AiGenerateModal
            isOpen={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            title="Generar mi plan con IA"
            description="Elige qué quieres que genere la IA esta vez."
            availableScopes={['all', 'menu_compra', 'menu_only', 'entrenos_only']}
            defaultScope={userDoc?.profile?.aiScope ?? undefined}
          />
        )}

        {/* Reservamos referencia al profileLoading para silenciar el lint
            (todavía no la usamos pero la queremos disponible para skeletons
            cuando cableemos los datos reales en Fase 2). */}
        {profileLoading ? null : null}
      </IonContent>
    </IonPage>
  );
};

export default HoyPage;
