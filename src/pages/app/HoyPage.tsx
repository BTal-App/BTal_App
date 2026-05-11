import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  IonAlert,
  IonContent,
  IonPage,
  IonSpinner,
  useIonRouter,
} from '@ionic/react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import {
  EXTRA_ICON_DEFAULT,
  HORA_DEFECTO,
  MEAL_ICON_DEFAULT,
  MEAL_KEYS,
  calcBatidoStats,
  calcCreatinaStats,
  type ComidaExtra,
  type DiaEntreno,
  type MealKey,
  type PlanEntreno,
} from '../../templates/defaultUser';
import { MealIcon } from '../../components/MealIcon';
import { badgeLabel, BADGE_BY_VAL } from '../../templates/exerciseCatalog';
import { formatTiempoEstimado, horaToMinutes } from '../../utils/timeParser';
import { computeSupAlerts } from '../../utils/supAlerts';
import { SupAlertBox } from '../../components/SupAlertBox';
import { todayDateStr, todayKey } from '../../utils/dateKeys';
import { TabHeader } from '../../components/TabHeader';
import { VerifyEmailBanner } from '../../components/VerifyEmailBanner';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { MealSheet } from '../../components/MealSheet';
import { TrainSheet } from '../../components/TrainSheet';
import { LinkGuestAccountModal } from '../../components/LinkGuestAccountModal';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { blurAndRun } from '../../utils/focus';
import { greetingName } from '../../utils/userDisplay';
import { useScrollTopOnEnter } from '../../utils/useScrollTopOnEnter';
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

// Etiquetas locales de las 4 comidas fijas (label). Los iconos de
// fallback viven en `MEAL_ICON_DEFAULT` (templates/defaultUser.ts) ·
// se aplican vía `<MealIcon>` cuando `comida.emoji` es null.
const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};


const HoyPage: React.FC = () => {
  const { user, loading } = useAuth();
  const { profile: userDoc, loading: profileLoading } = useProfile();
  const [linkGuestOpen, setLinkGuestOpen] = useState(false);
  const [aiGenOpen, setAiGenOpen] = useState(false);
  // MealSheet · null = cerrado · al pulsar una comida del día se
  // abre con el detalle (mismo modal que en MenuPage). Las acciones
  // de Editar / Duplicar viven en MenuPage; aquí solo lectura.
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  // Sheet para las comidas extras (custom · añadidas desde "Añadir
  // comida" en MenuPage). En HOY se renderizan después de las 4 fijas
  // y al pulsarlas se abre el mismo sheet · "Editar" redirige al tab
  // Menú igual que con las fijas.
  const [openExtra, setOpenExtra] = useState<ComidaExtra | null>(null);
  // Reset del scroll al top al volver a la tab Hoy.
  const contentRef = useRef<HTMLIonContentElement>(null);
  useScrollTopOnEnter(contentRef);

  // Router para navegar al tab Menú desde el botón "Ver menú →".
  const router = useIonRouter();
  const goToMenu = () => router.push('/app/menu', 'forward');

  // Comidas del día de hoy · si el doc aún no se cargó, undefined.
  const todayDay = todayKey();
  const comidasHoy = userDoc?.menu?.[todayDay];

  // Lista unificada de filas (4 fijas + extras visibles) ordenadas por
  // hora · misma UX que MenuPage's `orderedRows`. Sin esto, los extras
  // siempre quedaban al final aunque tuvieran una hora intermedia.
  // Filtramos los `deshabilitada` · no aparecen ni cuentan en totales.
  // `useMemo` evita re-construir la lista en cada render (cambia solo
  // cuando `comidasHoy` cambia · referencia distinta tras escritura).
  type HoyRow =
    | { kind: 'meal'; meal: MealKey; sortMin: number }
    | { kind: 'extra'; extra: ComidaExtra; sortMin: number };
  const orderedMealRows = useMemo<HoyRow[]>(() => {
    if (!comidasHoy) return [];
    const rows: HoyRow[] = MEAL_KEYS.map((meal) => {
      const comida = comidasHoy[meal];
      const hora = comida.hora ?? HORA_DEFECTO[meal];
      return { kind: 'meal', meal, sortMin: horaToMinutes(hora) };
    });
    for (const extra of comidasHoy.extras) {
      if (extra.deshabilitada) continue;
      rows.push({
        kind: 'extra',
        extra,
        sortMin: horaToMinutes(extra.hora),
      });
    }
    rows.sort((a, b) => a.sortMin - b.sortMin);
    return rows;
  }, [comidasHoy]);

  // Entreno de hoy · busca el día del plan activo cuyo `diaSemana`
  // coincide con la clave de hoy. Si no hay match, hoy es día de
  // descanso · la card mostrará el estado vacío. Réplica del v1.
  const activePlanHoy: PlanEntreno | undefined = userDoc?.entrenos?.activePlan
    ? userDoc.entrenos.planes[userDoc.entrenos.activePlan]
    : undefined;
  const diaEntrenoHoy: DiaEntreno | null
    = activePlanHoy?.dias.find((d) => d.diaSemana === todayDay) ?? null;
  const diaEntrenoHoyIdx = diaEntrenoHoy
    ? activePlanHoy!.dias.indexOf(diaEntrenoHoy)
    : -1;
  // Estado del bottom sheet · cuando el user pulsa la card del día,
  // abrimos el TrainSheet (mismo componente que usa la tab Entreno)
  // con el detalle completo de ejercicios + series + reps.
  const [trainSheetOpen, setTrainSheetOpen] = useState(false);

  // Días restantes antes de que la TTL de Firestore borre el doc del
  // invitado. Sincronización con un sistema externo (el reloj) · el
  // patrón canónico de React 19 para este tipo de valor es
  // `useSyncExternalStore`: getSnapshot computa el valor actual y la
  // función subscribe nos da la oportunidad de re-renderizar cuando
  // pase el tiempo (cada 60s · suficiente para una cuenta atrás en
  // días). Diseñado a propósito para evitar la regla
  // `react-hooks/purity` (Date.now() es impura) sin disable.
  //
  // IMPORTANTE: declarado ANTES del early-return de loading para no
  // violar las rules-of-hooks (orden estable entre renders).
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
    // Server snapshot · SSR no aplica aquí pero la firma de
    // useSyncExternalStore lo pide para evitar el warning.
    () => null,
  );

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
      <IonContent ref={contentRef} fullscreen>
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
                    <MealIcon value="tb:bolt" size={14} />
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
              className={
                'hoy-guest-banner'
                + (guestDaysLeft !== null && guestDaysLeft <= 1
                  ? ' hoy-guest-banner--urgent'
                  : '')
              }
              onClick={blurAndRun(() => setLinkGuestOpen(true))}
            >
              <div className="hoy-guest-banner-info">
                <span className="hoy-guest-banner-tag">
                  Modo prueba
                  {guestDaysLeft !== null && (
                    <span className="hoy-guest-banner-countdown">
                      {guestDaysLeft === 0
                        ? '· caduca hoy'
                        : guestDaysLeft === 1
                        ? '· 1 día restante'
                        : `· ${guestDaysLeft} días restantes`}
                    </span>
                  )}
                </span>
                <span className="hoy-guest-banner-text">
                  Crea una cuenta para <strong>guardar tus cambios</strong>{' '}
                  antes de que esta sesión expire. Mantendrás todo lo que has
                  tocado en el plan demo.
                </span>
              </div>
              <MealIcon value="tb:arrow-right" size={20} />
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
                  <MealIcon value="tb:sparkles" size={18} />
                  Generar mi plan con IA
                </button>
              ) : (
                <div className="hoy-hero-tag">
                  <MealIcon value="tb:sparkles" size={16} />
                  {user.isAnonymous
                    ? 'Datos de ejemplo · regístrate para personalizar'
                    : 'Cambia a modo IA en Ajustes para generar tu plan'}
                </div>
              )}
            </div>
          ) : null}

          {/* ─────────────── ENTRENO DE HOY ───────────────
               Conectado con la tab Entreno · busca en el plan activo
               el día cuyo `diaSemana` coincide con HOY. Si lo encuentra,
               renderiza la card con título + tags + preview de
               ejercicios. Si no (descanso o sin asignar), muestra
               estado vacío. Click en la card → navega al tab Entreno. */}
          <div className="app-section-title">
            <h2>Entreno de hoy</h2>
            <button
              type="button"
              className="app-section-more"
              onClick={blurAndRun(() => router.push('/app/entreno', 'forward'))}
              aria-label="Abrir plan de entreno completo"
            >
              Ver plan
              <MealIcon value="tb:chevron-right" size={16} />
            </button>
          </div>
          <EntrenoHoyCard
            activePlan={activePlanHoy}
            diaHoy={diaEntrenoHoy}
            // Solo abre el TrainSheet si HAY día de entreno asignado.
            // Para descanso/sin plan la card es informativa (no clickable):
            // el "Ver plan →" del header ya redirige a la tab Entreno
            // si el user quiere configurar · evita doble redirección al
            // mismo sitio desde la misma sección.
            onClick={() => {
              if (diaEntrenoHoy) {
                setTrainSheetOpen(true);
              }
            }}
          />
          {/* Bottom sheet con el detalle del día · mismo componente
              que usa EntrenoPage. Al pulsar "Editar día" navega al
              tab Entreno. Sin el botón "Empezar entrenamiento" del
              preview · solo lectura del detalle. */}
          {activePlanHoy && diaEntrenoHoy && diaEntrenoHoyIdx >= 0 && (
            <TrainSheet
              isOpen={trainSheetOpen}
              onClose={() => setTrainSheetOpen(false)}
              plan={activePlanHoy}
              diaIdx={diaEntrenoHoyIdx}
              onEdit={() => {
                setTrainSheetOpen(false);
                router.push('/app/entreno', 'forward');
              }}
            />
          )}

          {/* ─────────────── COMIDAS DE HOY ───────────────
               Renderiza directamente las 4 comidas del día (con sus
               extras si los hay). Cada card abre `MealSheet` (mismo
               sheet que en MenuPage) para ver el detalle completo.
               Para ediciones más profundas, el botón "Ver menú →" del
               header lleva al tab Menú con todas las herramientas. */}
          <div className="app-section-title">
            <h2>Comidas de hoy</h2>
            <button
              type="button"
              className="app-section-more"
              onClick={blurAndRun(goToMenu)}
              aria-label="Abrir menú completo"
            >
              Ver menú
              <MealIcon value="tb:chevron-right" size={16} />
            </button>
          </div>
          {comidasHoy ? (
            <div className="hoy-meal-list">
              {/* Lista única ordenada por hora · las 4 fijas y los
                  extras visibles se intercalan según `sortMin`. Sin
                  esto los extras siempre quedaban detrás de cena (21:00)
                  aunque tuvieran una hora intermedia como 17:00. */}
              {orderedMealRows.map((row) => {
                if (row.kind === 'meal') {
                  const meal = row.meal;
                  const comida = comidasHoy[meal];
                  const isEmpty = comida.alimentos.length === 0;
                  const plato = (comida.nombrePlato ?? '').trim();
                  const hora = comida.hora ?? HORA_DEFECTO[meal];
                  return (
                    <button
                      key={meal}
                      type="button"
                      className={
                        'hoy-meal-card'
                        + (isEmpty ? ' hoy-meal-card--empty' : '')
                      }
                      onClick={blurAndRun(() => setOpenMeal(meal))}
                      aria-label={`Ver detalle de ${MEAL_LABEL[meal]}`}
                    >
                      <div className="hoy-meal-emoji" aria-hidden="true">
                        <MealIcon
                          value={comida.emoji}
                          fallback={MEAL_ICON_DEFAULT[meal]}
                          size={32}
                        />
                      </div>
                      <div className="hoy-meal-body">
                        <div className="hoy-meal-row">
                          <span className="hoy-meal-name">
                            {MEAL_LABEL[meal]}
                          </span>
                          <span className="hoy-meal-time">{hora}</span>
                        </div>
                        {!isEmpty && plato && (
                          <p className="hoy-meal-plato">{plato}</p>
                        )}
                        {!isEmpty ? (
                          <div className="hoy-meal-macros">
                            {comida.kcal > 0 && (
                              <span className="hoy-meal-macro hoy-meal-macro--kcal">
                                {comida.kcal} kcal
                              </span>
                            )}
                            {comida.prot > 0 && (
                              <span className="hoy-meal-macro hoy-meal-macro--prot">
                                {comida.prot}g P
                              </span>
                            )}
                            {comida.carb > 0 && (
                              <span className="hoy-meal-macro hoy-meal-macro--carb">
                                {comida.carb}g C
                              </span>
                            )}
                            {comida.fat > 0 && (
                              <span className="hoy-meal-macro hoy-meal-macro--fat">
                                {comida.fat}g G
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="hoy-meal-empty-text">
                            Aún sin definir · pulsa para añadir
                          </p>
                        )}
                      </div>
                      <MealIcon
                        value="tb:chevron-right"
                        size={20}
                        className="hoy-meal-arrow"
                      />
                    </button>
                  );
                }
                // row.kind === 'extra'
                const extra = row.extra;
                const isEmpty = extra.alimentos.length === 0;
                const isExtra = extra.esExtra ?? true;
                const plato = (extra.nombrePlato ?? '').trim();
                const titulo = extra.nombre.trim() || 'Comida';
                return (
                  <button
                    key={`extra-${extra.id}`}
                    type="button"
                    className={
                      'hoy-meal-card'
                      + (isEmpty ? ' hoy-meal-card--empty' : '')
                    }
                    onClick={blurAndRun(() => setOpenExtra(extra))}
                    aria-label={`Ver detalle de ${titulo}${isExtra ? ' (extra)' : ''}`}
                  >
                    <div className="hoy-meal-emoji" aria-hidden="true">
                      <MealIcon
                        value={extra.emoji}
                        fallback={EXTRA_ICON_DEFAULT}
                        size={32}
                      />
                    </div>
                    <div className="hoy-meal-body">
                      <div className="hoy-meal-row">
                        <span className="hoy-meal-name">
                          {titulo}
                          {isExtra && (
                            <span
                              className="hoy-meal-extra-tag"
                              aria-hidden="true"
                            >
                              extra
                            </span>
                          )}
                        </span>
                        <span className="hoy-meal-time">
                          {extra.hora ?? '--:--'}
                        </span>
                      </div>
                      {!isEmpty && plato && (
                        <p className="hoy-meal-plato">{plato}</p>
                      )}
                      {!isEmpty ? (
                        <div className="hoy-meal-macros">
                          {extra.kcal > 0 && (
                            <span className="hoy-meal-macro hoy-meal-macro--kcal">
                              {extra.kcal} kcal
                            </span>
                          )}
                          {extra.prot > 0 && (
                            <span className="hoy-meal-macro hoy-meal-macro--prot">
                              {extra.prot}g P
                            </span>
                          )}
                          {extra.carb > 0 && (
                            <span className="hoy-meal-macro hoy-meal-macro--carb">
                              {extra.carb}g C
                            </span>
                          )}
                          {extra.fat > 0 && (
                            <span className="hoy-meal-macro hoy-meal-macro--fat">
                              {extra.fat}g G
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="hoy-meal-empty-text">
                          Aún sin definir · pulsa para añadir
                        </p>
                      )}
                    </div>
                    <MealIcon
                      value="tb:chevron-right"
                      size={20}
                      className="hoy-meal-arrow"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="hoy-empty-card">
              <div className="hoy-empty-icon">
                <MealIcon value="tb:coffee" size={24} />
              </div>
              <div className="hoy-empty-info">
                <span className="hoy-empty-title">Cargando menú…</span>
                <span className="hoy-empty-sub">
                  Estamos sincronizando tus comidas con la base de datos.
                </span>
              </div>
            </div>
          )}

          {/* ─────────────── SUPLEMENTACIÓN · Sub-fase 2C ─────────────────
               El section-title general "Suplementación" se ha quitado:
               cada card del bloque trae su propio section-title con
               botón "Ver batido →" / "Ver creatina →" en lima. Más
               coherente con la UI del preview NewVersion. */}
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

        {/* MealSheet · al pulsar una comida del listado de hoy se
            abre el detalle (mismo sheet que en MenuPage). En esta
            tab solo hay lectura · si el user pulsa "Editar" desde el
            sheet, lo redirigimos al tab Menú con el día activo. */}
        {openMeal && comidasHoy && (
          <MealSheet
            isOpen={openMeal !== null}
            onClose={() => setOpenMeal(null)}
            day={todayDay}
            meal={openMeal}
            comida={comidasHoy[openMeal]}
            onEdit={() => {
              setOpenMeal(null);
              goToMenu();
            }}
          />
        )}

        {/* Mismo sheet pero para extras del día · sin botón duplicar/
            deshabilitar/eliminar (esas acciones viven en Menú). Al
            pulsar "Editar" redirigimos a la tab Menú igual que con
            las 4 fijas. */}
        {openExtra && (
          <MealSheet
            isOpen={openExtra !== null}
            onClose={() => setOpenExtra(null)}
            day={todayDay}
            comida={openExtra}
            title={openExtra.nombre.trim() || 'Comida'}
            iconFallback={EXTRA_ICON_DEFAULT}
            isExtra={openExtra.esExtra ?? true}
            onEdit={() => {
              setOpenExtra(null);
              goToMenu();
            }}
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
  // Router local · los botones "Ver batido" / "Ver creatina" navegan
  // a la tab Menú con `?openSup=...` para abrir el modal allí (con
  // animación de transición de tabs en vez de modal inline en Hoy).
  const router = useIonRouter();

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
      // `--section-start` añade margin-top:28px para separar la card
      // del bloque de comidas que tiene encima. Sin ese modifier la
      // card queda pegada a "Cena" porque arranca una sección sin
      // section-title propio.
      <div className="hoy-empty-card hoy-empty-card--section-start">
        <div className="hoy-empty-icon">
          <MealIcon value="tb:flask" size={24} />
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
    <>
      {showBatido && (
        <>
          {/* Section-title individual del batido · igual estilo que
              "Comidas de hoy · Ver menú →" pero por-card. Permite al
              user pulsar "Ver batido →" para abrir el modal de
              info/configuración (BatidoInfoModal · receta + macros +
              counters · mismo modal que abre Menú → toolbar 🥤). */}
          <div className="app-section-title hoy-sup-section-title">
            <h2>Batido protéico</h2>
            <button
              type="button"
              className="app-section-more"
              onClick={blurAndRun(() =>
                router.push('/app/menu?openSup=batido', 'forward'),
              )}
              aria-label="Ver detalles del batido"
            >
              Ver batido
              <MealIcon value="tb:chevron-right" size={16} />
            </button>
          </div>
          <SupCardHoy
            kind="batido"
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
        </>
      )}

      {showCreatina && (
        <>
          <div className="app-section-title hoy-sup-section-title">
            <h2>Creatina</h2>
            <button
              type="button"
              className="app-section-more"
              onClick={blurAndRun(() =>
                router.push('/app/menu?openSup=creatina', 'forward'),
              )}
              aria-label="Ver detalles de la creatina"
            >
              Ver creatina
              <MealIcon value="tb:chevron-right" size={16} />
            </button>
          </div>
          <SupCardHoy
            kind="creatina"
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
        </>
      )}

      {/* Los botones "Ver batido →" / "Ver creatina →" navegan ahora
          a la tab Menú con `?openSup=batido|creatina` y MenuPage
          abre el modal correspondiente (animación de transición de
          tabs). Antes el modal se abría inline en Hoy · sustituido
          para coherencia: la configuración vive en Menú, Hoy solo
          muestra el resumen. */}
    </>
  );
}

interface SupCardHoyProps {
  kind: 'batido' | 'creatina';
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

  // Subtítulo · solo la receta corta · el contador de "restantes" vive
  // ahora abajo en el bloque de stats (no duplicamos info).
  const ctaLabel = kind === 'batido' ? 'Tomado' : 'Tomada';

  // Confirmación al pulsar el ⟳ "cancelar tomado hoy" · evita decrementar
  // el contador por error (un click sin querer descuenta una dosis del
  // stock total). El alert solo se muestra antes de la acción
  // destructiva; el "Tomar" inicial sigue siendo directo (no tiene
  // sentido pedir confirmación para añadir).
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  return (
    <div className={`hoy-sup-card hoy-sup-card--${kind}`}>
      {/* Head compacto · estilo preview NewVersion: emoji + info +
          CTA inline a la derecha. Cuando ya está tomado hoy, el CTA
          cambia a un badge "✓ Tomado/a" + un mini-botón ⟳ cancelar
          al lado. Mantenemos las animaciones (halo dorado/violeta al
          pulsar, glow al pasar a estado tomado, fade-up del cancel). */}
      <div className="hoy-sup-head">
        <div className="hoy-sup-emoji" aria-hidden="true">
          <MealIcon
            value={kind === 'batido' ? 'tb:cup' : 'tb:ladle'}
            size={32}
            className="hoy-sup-emoji-icon"
          />
        </div>
        <div className="hoy-sup-id">
          <h3>{titulo}</h3>
          <p>{sub}</p>
        </div>
        {stockState === 'none' ? null : tomadoHoy ? (
          <div className="hoy-sup-cta-group">
            <span
              className={
                `hoy-sup-cta hoy-sup-cta--taken hoy-sup-cta--${kind} `
                + 'hoy-sup-cta--enter'
              }
            >
              <MealIcon
                value="tb:circle-check"
                size={16}
                className="hoy-sup-taken-check"
              />
              {ctaLabel}
            </span>
            <button
              type="button"
              className="hoy-sup-cancel-mini hoy-sup-cancel-mini--enter"
              onClick={blurAndRun(() => setConfirmCancelOpen(true))}
              aria-label={`Cancelar ${palabraSing} tomado hoy`}
              title={`Cancelar (descontar ${palabraSing})`}
            >
              <MealIcon value="tb:refresh" size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`hoy-sup-cta hoy-sup-cta--${kind}`}
            onClick={blurAndRun(onMarcar)}
            disabled={marcarDisabled}
          >
            <MealIcon value="tb:plus" size={18} />
            Tomar
          </button>
        )}
      </div>

      {/* Stats inferiores · 2 ó 3 cells horizontales (TOMADOS / RESTANTES
          / ESTA SEMANA si aplica). Cada número con `btal-anim-bump` para
          que rebote al cambiar (key={value} en cada span). */}
      <div
        className={
          'hoy-sup-stats-row'
          + (showWeekMonth ? '' : ' hoy-sup-stats-row--two')
        }
      >
        <div className="hoy-sup-stat-cell">
          <span
            key={`tom-${tomados}`}
            className="hoy-sup-stat-num btal-anim-bump"
          >
            {tomados}
          </span>
          <span className="hoy-sup-stat-label">{tomadosLabel}</span>
        </div>
        <div className="hoy-sup-stat-cell">
          <span
            key={`rest-${restantesNum}`}
            className={
              'hoy-sup-stat-num btal-anim-bump'
              + ' hoy-sup-stat-num--' + stockState
            }
          >
            {restantesNum}
          </span>
          <span className="hoy-sup-stat-label">
            {kind === 'batido' ? 'BATIDOS RESTANTES' : 'DOSIS RESTANTES'}
          </span>
        </div>
        {showWeekMonth && (
          <div className="hoy-sup-stat-cell">
            <span
              key={`sem-${semana}`}
              className="hoy-sup-stat-num btal-anim-bump"
            >
              {semana}
            </span>
            <span className="hoy-sup-stat-label">total esta semana</span>
          </div>
        )}
      </div>

      {/* Empty state cuando no hay stock definido · invita a configurar
          desde Menú (los ajustes de stock viven allí, no aquí). */}
      {stockState === 'none' && (
        <div className="hoy-sup-stock-empty-info">
          Define el stock desde{' '}
          <strong>
            Menú →{' '}
            <MealIcon
              value={kind === 'batido' ? 'tb:cup' : 'tb:ladle'}
              size={14}
              className="hoy-sup-inline-icon"
            />
            {kind === 'batido' ? 'BATIDO' : 'CREATINA'}
          </strong>
        </div>
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

      {/* Confirmación destructiva · pedimos OK antes de descontar la
          dosis del stock para evitar clicks accidentales en el ⟳. El
          handler ejecuta el `onCancelar` real (que llama al provider).
          El botón "Cancelar" del alert solo cierra sin tocar nada. */}
      <IonAlert
        isOpen={confirmCancelOpen}
        onDidDismiss={() => setConfirmCancelOpen(false)}
        header={`¿Cancelar ${palabraSing} tomado hoy?`}
        message={
          kind === 'batido'
            ? 'Se descontará 1 batido del contador y volverá a aparecer el botón "Tomar".'
            : 'Se descontará 1 dosis del contador y volverá a aparecer el botón "Tomar".'
        }
        buttons={[
          { text: 'Atrás', role: 'cancel' },
          {
            text: 'Sí, cancelar',
            role: 'destructive',
            handler: () => {
              onCancelar();
            },
          },
        ]}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Card de "Entreno de hoy" · réplica visual del preview BTal.
// Si hay día asignado en el plan activo, muestra título + tags + preview
// de los 3 primeros ejercicios. Si no, muestra estado vacío "descanso".
// Click en la card → navega al tab Entreno (mismo destino que el botón
// "Ver plan →" del header). Mantiene la consistencia con el patrón
// visual del v1 + preview.
// ──────────────────────────────────────────────────────────────────────────

interface EntrenoHoyCardProps {
  activePlan: PlanEntreno | undefined;
  diaHoy: DiaEntreno | null;
  onClick: () => void;
}

function EntrenoHoyCard({ activePlan, diaHoy, onClick }: EntrenoHoyCardProps) {
  // Sin plan activo o sin día asignado a HOY · estado vacío "descanso".
  // Card NO clickable · sin chevron · sin redirect (el "Ver plan →" del
  // header ya cubre la navegación a Entreno · evita doble redirección
  // desde la misma sección).
  if (!activePlan || !diaHoy) {
    // 2 sub-casos:
    //   · activePlan presente pero hoy no es día de entreno · cama azul.
    //   · activePlan ausente (corrupción/edge case) · alerta naranja.
    const isAlert = !activePlan;
    return (
      <div
        className={
          'hoy-train-card hoy-train-card--rest hoy-train-card--static'
          + (isAlert ? ' hoy-train-card--alert' : '')
        }
        aria-label={
          isAlert ? 'Sin plan asignado' : 'Día de descanso'
        }
      >
        <div
          className={
            'hoy-train-icon ' +
            (isAlert ? 'hoy-train-icon--alert' : 'hoy-train-icon--rest')
          }
        >
          {/* Cama azul para descanso · alerta naranja si no hay plan
              asignado (caso defensivo, prácticamente nunca pasa). */}
          <MealIcon value={isAlert ? 'tb:alert-circle' : 'tb:bed'} size={26} />
        </div>
        <div className="hoy-train-info">
          <div className="hoy-train-label">
            {isAlert ? 'Atención' : 'Día de descanso'}
          </div>
          <h3 className="hoy-train-title">
            {isAlert ? 'Sin plan asignado' : 'No hay entrenamiento programado para hoy'}
          </h3>
        </div>
        {/* Sin chevron · la card es informativa, no clickable. */}
      </div>
    );
  }

  // Día asignado · render con título del día + tags de tipos
  // (sin preview de ejercicios · esos se ven al abrir el bottom
  // sheet TrainSheet pulsando la card).
  const tags = [
    { val: diaHoy.badge, custom: diaHoy.badgeCustom },
    { val: diaHoy.badge2, custom: diaHoy.badgeCustom2 },
    { val: diaHoy.badge3, custom: diaHoy.badgeCustom3 },
  ]
    .map((b) => ({
      label: b.val ? badgeLabel(b.val, b.custom) : null,
      cls: b.val ? BADGE_BY_VAL[b.val]?.cls ?? '' : '',
    }))
    .filter((b) => b.label !== null) as { label: string; cls: string }[];

  return (
    <button
      type="button"
      className="hoy-train-card"
      onClick={blurAndRun(onClick)}
      aria-label={`Entreno de hoy · ${diaHoy.titulo} · ver detalle`}
    >
      <div className="hoy-train-icon">
        <MealIcon value="tb:barbell" size={26} />
      </div>
      <div className="hoy-train-info">
        <div className="hoy-train-label">
          <span className="hoy-train-label-tag">HOY</span>
          {/* Duración a la derecha del tag HOY · mantiene el azul
              original (no se mezcla visualmente con el lima del HOY,
              pero comparte la fila por jerarquía "esto es hoy y dura X"). */}
          {diaHoy.tiempoEstimadoMin && diaHoy.tiempoEstimadoMin > 0 && (
            <span className="hoy-train-time-tag">
              <MealIcon value="tb:clock" size={12} className="hoy-train-time-icon" />
              {formatTiempoEstimado(diaHoy.tiempoEstimadoMin)}
            </span>
          )}
        </div>
        <h3 className="hoy-train-title">
          {diaHoy.titulo || 'Entreno'}
        </h3>
        {tags.length > 0 && (
          <div className="hoy-train-tags">
            {tags.map((t, i) => (
              <span key={i} className={`tag ${t.cls}`}>
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <MealIcon
        value="tb:chevron-right"
        size={20}
        className="hoy-train-chevron"
      />
    </button>
  );
}
