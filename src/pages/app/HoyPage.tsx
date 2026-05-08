import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  addOutline,
  arrowForwardOutline,
  barbellOutline,
  cafeOutline,
  checkmarkCircleOutline,
  flashOutline,
  flaskOutline,
  refreshOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import {
  calcBatidoStats,
  calcCreatinaStats,
} from '../../templates/defaultUser';
import { computeSupAlerts } from '../../utils/supAlerts';
import { SupAlertBox } from '../../components/SupAlertBox';
import { todayDateStr, todayKey } from '../../utils/dateKeys';
import { TabHeader } from '../../components/TabHeader';
import { VerifyEmailBanner } from '../../components/VerifyEmailBanner';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { LinkGuestAccountModal } from '../../components/LinkGuestAccountModal';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { blurAndRun } from '../../utils/focus';
import { greetingName } from '../../utils/userDisplay';
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
  // (las iniciales del avatar las gestiona <AppAvatarButton /> internamente.)
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
                <AppAvatarButton />
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

          {/* ─────────────── SUPLEMENTACIÓN · Sub-fase 2B.5.b ─────────────── */}
          <div className="app-section-title">
            <h2>Suplementación</h2>
          </div>
          <SuplementacionBlock />

          <div className="app-tab-pad-bottom" />
        </div>

        {/* El avatar/profile-sheet se monta dentro de <AppAvatarButton />
            (header). No hace falta repetirlo aquí. */}

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

// ──────────────────────────────────────────────────────────────────────────
// SuplementacionBlock · Sub-fase 2B.5.b · bloque de cards en HoyPage que
// muestra el stock + contadores de batido y creatina, con botones para
// "Tomar" (decrementa stock + incrementa contador), ⚙ Configurar stock
// (abre EditSupStockModal con resets), y +/- manual del contador.
// ──────────────────────────────────────────────────────────────────────────

// Umbrales de alerta · cuando quedan ≤5 dosis avisamos en naranja, cuando
// llega a 0 en rojo. Si el user no tiene stock definido (null) no mostramos
// alerta · simplemente "stock no definido · pulsa para configurar".
const STOCK_WARN_THRESHOLD = 5;

function SuplementacionBlock() {
  const {
    profile: userDoc,
    marcarBatidoTomadoHoy,
    cancelarBatidoTomadoHoy,
    marcarCreatinaTomadaHoy,
    cancelarCreatinaTomadaHoy,
  } = useProfile();

  const sup = userDoc?.suplementos;

  // Si el doc aún no se cargó, no pintamos · evita parpadeos al primer
  // render. El skeleton-pinta de HoyPage ya cubre el caso "loading".
  if (!sup) return null;

  // Sólo mostramos las cards si el batido / creatina está añadido al
  // día de HOY desde Menú. El user activa cada uno desde la toolbar
  // de MenuPage; aquí solo reflejamos esa decisión. Si no hay nada
  // para hoy, mostramos un empty state que invita a configurarlo.
  const hoy = todayKey();
  const showBatido = sup.daysWithBatido.includes(hoy);
  const showCreatina = sup.daysWithCreatina.includes(hoy);

  if (!showBatido && !showCreatina) {
    return (
      <div className="hoy-empty-card">
        <div className="hoy-empty-icon">
          <IonIcon icon={flaskOutline} />
        </div>
        <div className="hoy-empty-info">
          <span className="hoy-empty-title">Sin suplementos para hoy</span>
          <span className="hoy-empty-sub">
            Activa el batido proteico o la creatina en la pestaña{' '}
            <strong>Menú</strong> y aparecerán aquí los días que los tomes.
          </span>
        </div>
      </div>
    );
  }

  // Stats calculadas al vuelo desde el stock en gramos · igual que el v1.
  // Las cards reciben "restantes" (= posibles − tomados) en lugar del
  // valor crudo del stock.
  const batidoStats = calcBatidoStats(sup);
  const creatinaStats = calcCreatinaStats(sup);

  // Comparamos las marcas de "tomado hoy" contra la fecha real · igual
  // que el v1 (lastBatidoDate === todayKey()). El botón cambia de
  // "Marcar tomado hoy" → "✓ Tomado · Cancelar".
  const today = todayDateStr();
  const batidoTakenHoy = sup.last_batido_date === today;
  const creatinaTakenHoy = sup.last_creatina_date === today;

  return (
    <div className="hoy-sup-grid">
      {showBatido && (
        <SupCardHoy
          kind="batido"
          emoji="🥤"
          titulo="BATIDO PROTÉICO"
          sub={
            sup.batidoConfig.includeCreatina
              ? `${sup.batidoConfig.gr_prot}g proteína + ${sup.creatinaConfig.gr_dose}g creatina`
              : `${sup.batidoConfig.gr_prot}g proteína por dosis`
          }
          tomados={sup.batidos_tomados_total}
          restantes={batidoStats.restantes}
          tomadoHoy={batidoTakenHoy}
          onMarcar={() => {
            marcarBatidoTomadoHoy().catch((err) =>
              console.error('[BTal] marcarBatido error:', err),
            );
          }}
          onCancelar={() => {
            cancelarBatidoTomadoHoy().catch((err) =>
              console.error('[BTal] cancelarBatido error:', err),
            );
          }}
          // Sub-fase 2B.5.b extension · solo semana en HoyPage (el mes
          // está dentro del modal de stock al que se accede desde Menú).
          showWeekMonth={true}
          semana={sup.batidos_tomados_semana}
          sup={sup}
        />
      )}

      {showCreatina && (
        <SupCardHoy
          kind="creatina"
          emoji="🥄"
          titulo="CREATINA"
          sub={`${sup.creatinaConfig.gr_dose}g por dosis`}
          tomados={sup.creatinas_tomadas_total}
          restantes={creatinaStats.restantes}
          tomadoHoy={creatinaTakenHoy}
          onMarcar={() => {
            marcarCreatinaTomadaHoy().catch((err) =>
              console.error('[BTal] marcarCreatina error:', err),
            );
          }}
          onCancelar={() => {
            cancelarCreatinaTomadaHoy().catch((err) =>
              console.error('[BTal] cancelarCreatina error:', err),
            );
          }}
          showWeekMonth={true}
          semana={sup.creatinas_tomadas_semana}
          sup={sup}
        />
      )}
    </div>
  );
}

interface SupCardHoyProps {
  kind: 'batido' | 'creatina';
  emoji: string;
  titulo: string;
  sub: string;
  tomados: number;
  restantes: number | null;
  // Solo "esta semana" en HoyPage · el mes vive en el modal de stock
  // (al que se accede desde Menú · botón 🥤 BATIDO / 🥄 CREATINA).
  semana: number;
  showWeekMonth: boolean;
  // Igual que v1: marcar/cancelar 1 vez al día. HoyPage SOLO permite
  // estas dos acciones · todos los ajustes (stock, contadores, resets,
  // edición de receta) viven en MenuPage.
  tomadoHoy: boolean;
  onMarcar: () => void;
  onCancelar: () => void;
  // Suplementos completo · necesario para computeSupAlerts (avisos
  // de stock bajo / vacío replicando el v1).
  sup: import('../../templates/defaultUser').Suplementos;
}

function SupCardHoy({
  kind,
  emoji,
  titulo,
  sub,
  tomados,
  restantes,
  semana,
  showWeekMonth,
  tomadoHoy,
  onMarcar,
  onCancelar,
  sup,
}: SupCardHoyProps) {
  // Estado del stock · null = no definido · 0 = sin stock (rojo)
  // ≤ STOCK_WARN_THRESHOLD = warning (naranja) · resto = OK
  const stockState: 'none' | 'empty' | 'warn' | 'ok' =
    restantes === null
      ? 'none'
      : restantes === 0
      ? 'empty'
      : restantes <= STOCK_WARN_THRESHOLD
      ? 'warn'
      : 'ok';

  // No se puede marcar si: sin stock definido (none) · 0 dosis (empty)
  // · ya marcado para hoy (entonces vemos el botón cancelar).
  const marcarDisabled = stockState === 'none' || stockState === 'empty';

  const tomadosLabel = kind === 'batido' ? 'TOMADOS' : 'TOMADAS';
  const restantesNum = restantes ?? '—';
  // Singular para el botón "Cancelar (descontar batido / dosis)".
  const palabraSing = kind === 'batido' ? 'batido' : 'dosis';

  return (
    <div className={`hoy-sup-card hoy-sup-card--${kind}`}>
      <div className="hoy-sup-head">
        <div className="hoy-sup-emoji" aria-hidden="true">
          {emoji}
        </div>
        <div className="hoy-sup-id">
          <h3>{titulo}</h3>
          <p>{sub}</p>
        </div>
        {/* HoyPage solo permite marcar / cancelar tomado · los ajustes
            (stock, contadores, edición de receta) viven en Menú →
            botón 🥤 BATIDO / 🥄 CREATINA. Sin botón ⚙ aquí. */}
      </div>

      {/* Tomados / Restantes · números grandes · igual layout que el v1.
          `key={value}` en cada span para retriggear `btal-anim-bump` al
          marcar/cancelar y dar feedback visual inmediato. */}
      <div className="hoy-sup-stats-main">
        <div className="hoy-sup-stat-main hoy-sup-stat-main--tomados">
          <span className="hoy-sup-stat-main-label">{tomadosLabel}</span>
          <span
            key={`tom-${tomados}`}
            className="hoy-sup-stat-main-num btal-anim-bump"
          >
            {tomados}
          </span>
        </div>
        <div className="hoy-sup-stat-main hoy-sup-stat-main--restantes">
          <span className="hoy-sup-stat-main-label">
            {kind === 'batido' ? 'BATIDOS RESTANTES' : 'DOSIS RESTANTES'}
          </span>
          <span
            key={`rest-${restantesNum}`}
            className={
              'hoy-sup-stat-main-num btal-anim-bump'
              + ' hoy-sup-stat-main-num--' + stockState
            }
          >
            {restantesNum}
          </span>
        </div>
      </div>

      {/* Solo mostramos "esta semana" en HoyPage · el mensual se ve en
          el modal de stock (más detallado). El semanal se auto-resetea
          cada lunes (`maybeResetSupCounters` en ProfileProvider). */}
      {showWeekMonth && (
        <div className="hoy-sup-stats hoy-sup-stats--single">
          <div className="hoy-sup-stat">
            <span
              key={`sem-${semana}`}
              className="hoy-sup-stat-num btal-anim-bump"
            >
              {semana}
            </span>
            <span className="hoy-sup-stat-label">total esta semana</span>
          </div>
        </div>
      )}

      {/* Botón principal · marcar / cancelar tomado hoy.
          - Si no hay stock definido (none) → muestra "Define el stock".
          - Si está marcado para hoy → badge ✓ + botón Cancelar (dashed rojo).
          - Si no está marcado → botón "Marcar tomado hoy" (lima/violeta). */}
      {stockState === 'none' ? (
        <div className="hoy-sup-stock-empty-info">
          Define el stock desde{' '}
          <strong>Menú → {kind === 'batido' ? '🥤 BATIDO' : '🥄 CREATINA'}</strong>
        </div>
      ) : tomadoHoy ? (
        <>
          {/* Badge "✓ Tomado hoy": entra con pop-in (clase global)
              y el ✓ rebota con check-pop tipo v1. El cancel-btn entra
              con un fade-up suave al aparecer. */}
          <div
            className={
              `hoy-sup-taken-badge hoy-sup-taken-badge--${kind} `
              + 'hoy-sup-taken-badge--enter'
            }
          >
            <IonIcon
              icon={checkmarkCircleOutline}
              className="hoy-sup-taken-check"
            />
            <span>
              {kind === 'batido' ? 'Batido tomado hoy' : 'Creatina tomada hoy'}
            </span>
          </div>
          <button
            type="button"
            className="hoy-sup-cancel-btn hoy-sup-cancel-btn--enter"
            onClick={blurAndRun(onCancelar)}
          >
            <IonIcon icon={refreshOutline} />
            Cancelar (descontar {palabraSing})
          </button>
        </>
      ) : (
        <button
          type="button"
          className={`hoy-sup-mark-btn hoy-sup-mark-btn--${kind}`}
          onClick={blurAndRun(onMarcar)}
          disabled={marcarDisabled}
        >
          <IonIcon icon={addOutline} />
          {kind === 'batido'
            ? 'Marcar batido tomado hoy'
            : 'Marcar creatina tomada hoy'}
        </button>
      )}

      {/* Avisos de stock · réplica v1. Si el batido lleva creatina,
          pueden salir DOS avisos (proteína + creatina). Para creatina
          standalone solo uno. Mismo texto exacto que en MenuPage para
          que el user vea coherencia entre tabs. */}
      {(() => {
        const alerts = computeSupAlerts(sup);
        if (kind === 'batido') {
          return (
            <>
              {alerts.batidoProt && <SupAlertBox alert={alerts.batidoProt} />}
              {alerts.batidoCreat && (
                <SupAlertBox alert={alerts.batidoCreat} />
              )}
            </>
          );
        }
        return alerts.creatina && <SupAlertBox alert={alerts.creatina} />;
      })()}
    </div>
  );
}
