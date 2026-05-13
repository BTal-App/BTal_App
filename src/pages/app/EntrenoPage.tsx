import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonContent,
  IonPage,
  IonToast,
} from '@ionic/react';
import { MealIcon } from '../../components/MealIcon';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { TabHeader } from '../../components/TabHeader';
import { GuestBanner } from '../../components/GuestBanner';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { TrainSheet } from '../../components/TrainSheet';
import { DiaEditorModal } from '../../components/DiaEditorModal';
import { PlanEditorModal } from '../../components/PlanEditorModal';
import { DeleteStatusToast } from '../../components/DeleteStatusToast';
import { useSaveStatus, SAVE_FAILED } from '../../hooks/useSaveStatus';
import {
  BUILTIN_PLAN_IDS,
  defaultEntrenos,
  getRecommendedPlanId,
  type DiaEntreno,
  type PlanEntreno,
} from '../../templates/defaultUser';
import { badgeLabel, BADGE_BY_VAL } from '../../templates/exerciseCatalog';
import { formatDiaSemana } from '../../utils/diaSemana';
import { formatTiempoEstimado } from '../../utils/timeParser';
import { blurAndRun } from '../../utils/focus';
import { useScrollTopOnEnter } from '../../utils/useScrollTopOnEnter';
import './EntrenoPage.css';

// Tab Entreno · Sub-fase 2D · render completo del plan de entreno:
// - Plan switcher horizontal (1..7 builtIn + custom + "+" para nuevo).
// - Banner verde con recomendación según `profile.diasEntreno`.
// - Lista de días del plan activo · cada uno con título, día semana,
//   tags de badges y lista preview de ejercicios.
// - Bottom sheet (TrainSheet) al pulsar un día · detalle completo +
//   "Editar día" que abre DiaEditorModal.
// - Modal "Editar plan" para nombre y orden de días + crear/borrar
//   planes custom (PlanEditorModal).

const EntrenoPage: React.FC = () => {
  const { user } = useAuth();
  const {
    profile: userDoc,
    setActivePlan,
    setPlanEntreno,
    removePlanEntreno,
    restorePlanEntreno,
    updateDiaEntreno,
  } = useProfile();
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [planEditorMode, setPlanEditorMode] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; plan: PlanEntreno }
    | null
  >(null);
  const [trainSheetIdx, setTrainSheetIdx] = useState<number | null>(null);
  const [diaEditor, setDiaEditor] = useState<{
    dia: DiaEntreno;
    diaIdx: number;
  } | null>(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(false);
  const [undoToast, setUndoToast] = useState<{ plan: PlanEntreno } | null>(
    null,
  );
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Feedback "Eliminando… / Eliminado correctamente" para delete inline
  // (eliminar plan custom). Reusable via DeleteStatusToast en la propia
  // página · misma semántica que el DeleteIndicator de los modales.
  const deletePlanStatus = useSaveStatus();

  const contentRef = useRef<HTMLIonContentElement>(null);
  useScrollTopOnEnter(contentRef);

  // Refs para el switcher horizontal · al recomendar un plan que cae
  // fuera del viewport inicial (ej. plan recomendado = 5dias en una
  // pantalla móvil de 360px de ancho), auto-scroll para que el chip
  // "★ Recomendado" siempre sea visible al entrar en la tab. El scroll
  // se hace en el contenedor `.plan-cards` (overflow-x: auto), no en
  // la página entera (eso reventaría el contentRef).
  const planCardsRef = useRef<HTMLDivElement>(null);
  const recommendedBtnRef = useRef<HTMLButtonElement>(null);

  const entrenos = userDoc?.entrenos ?? defaultEntrenos();
  const activePlanId = entrenos.activePlan;
  const activePlan: PlanEntreno | undefined = entrenos.planes[activePlanId];
  const diasEntreno = userDoc?.profile?.diasEntreno ?? null;

  // Sub-fase 2D.1 · Si el user tiene algún plan custom marcado como
  // predeterminado, ese es SIEMPRE el "recomendado" e IGNORA el cálculo
  // basado en `profile.diasEntreno`. Solo cuando se borra ese plan
  // (o se desmarca el flag), vuelve la lógica del perfil.
  // Iteración corta · `entrenos.planes` es máx ~10-15 entries.
  const customPredeterminado: PlanEntreno | null = useMemo(() => {
    for (const p of Object.values(entrenos.planes)) {
      if (p && !p.builtIn && p.esPredeterminado) return p;
    }
    return null;
  }, [entrenos.planes]);

  // recommendedId · prioridad al custom predeterminado, fallback al
  // builtIn según diasEntreno (lógica histórica preservada).
  const recommendedId = customPredeterminado
    ? customPredeterminado.id
    : getRecommendedPlanId(diasEntreno);
  // Color dinámico de la recomendación · escala 0 (peor, coral) → 7
  // (mejor, verde) según `profile.diasEntreno`. Se inyecta como
  // CSS custom prop `--rec-color` en el banner y en el plan-mini
  // recomendado. Si hay customPredeterminado usamos lima sólida (la
  // referencia ya no es el perfil sino la decisión del user).
  const recColor = customPredeterminado
    ? 'var(--btal-lime)'
    : colorForRecommendedDays(diasEntreno);

  // Lista ordenada de planes para el switcher:
  //   1. builtIn (1..7 días) por orden de número
  //   2. custom marcados como predeterminados (Sub-fase 2D.1) ·
  //      ganan prominencia al ir justo después de los builtIn
  //   3. custom no predeterminados · al final por orden de creación
  // El id de los custom contiene timestamp en base 36 → comparación
  // lexicográfica equivale a orden cronológico.
  const planList = useMemo(() => {
    const builtIn: PlanEntreno[] = [];
    const custom: PlanEntreno[] = [];
    for (const id of BUILTIN_PLAN_IDS) {
      const p = entrenos.planes[id];
      if (p) builtIn.push(p);
    }
    for (const [id, p] of Object.entries(entrenos.planes)) {
      if (p && !p.builtIn && !BUILTIN_PLAN_IDS.includes(id as never)) {
        custom.push(p);
      }
    }
    custom.sort((a, b) => {
      // Predeterminados primero · luego cronológico por id.
      const aP = a.esPredeterminado ? 0 : 1;
      const bP = b.esPredeterminado ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return a.id.localeCompare(b.id);
    });
    return [...builtIn, ...custom];
  }, [entrenos.planes]);

  const showAiButton =
    !!user && !user.isAnonymous && userDoc?.profile?.modo === 'ai';

  // Asegura que el chip "★ Recomendado" siempre quede visible en el
  // viewport inicial del switcher · si el recomendado es 5dias o
  // superior, en pantallas estrechas el card cae fuera de la zona
  // visible al entrar en la tab. Lo centramos suavemente. Se ejecuta
  // al montar y cada vez que cambia el recommendedId (ej. el user
  // edita `profile.diasEntreno`).
  useEffect(() => {
    const btn = recommendedBtnRef.current;
    const container = planCardsRef.current;
    if (!btn || !container) return;
    // requestAnimationFrame para que el scroll ocurra DESPUÉS de que
    // la lista esté pintada · sin esto, en algunas vueltas el scroll
    // se aplica antes y se pierde.
    const raf = requestAnimationFrame(() => {
      const btnLeft = btn.offsetLeft;
      const btnRight = btnLeft + btn.offsetWidth;
      const visibleStart = container.scrollLeft;
      const visibleEnd = visibleStart + container.clientWidth;
      // Solo scroll si el botón cae fuera del área visible · respeta
      // el scroll manual del user si ya lo movió.
      if (btnLeft < visibleStart || btnRight > visibleEnd) {
        // Centramos el card recomendado · margin de 16px para que el
        // siguiente card también asome y dé pista de "hay más".
        const target = Math.max(
          0,
          btnLeft - (container.clientWidth - btn.offsetWidth) / 2,
        );
        container.scrollTo({ left: target, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [recommendedId, planList.length]);

  const handleSelectPlan = async (planId: string) => {
    if (planId === activePlanId) return;
    try {
      await setActivePlan(planId);
    } catch (err) {
      console.error('[BTal] setActivePlan error:', err);
      setErrorToast('Error al cambiar de plan');
    }
  };

  // Callback `onSave` que el PlanEditorModal invoca dentro de su
  // `runSave`. NO cerramos el modal aquí — el modal tiene su propio
  // closeTimer que dispara `onClose` tras SAVED_INDICATOR_MS para que
  // el chip "Guardado ✓" sea visible. Si lo cerráramos aquí, el modal
  // se desmontaría antes de que el chip aparezca.
  // Re-throw del error para que `runSave` capture el SAVE_FAILED y
  // el modal muestre el chip "Error" en vez de cerrarse silencioso.
  const handleSavePlanFromEditor = async (plan: PlanEntreno) => {
    await setPlanEntreno(plan);
    // Si era nuevo, lo activamos automáticamente.
    if (
      planEditorMode?.mode === 'create'
      && entrenos.planes[plan.id] === undefined
    ) {
      await setActivePlan(plan.id);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan || activePlan.builtIn) return;
    setConfirmDeletePlan(false);
    const result = await deletePlanStatus.runSave(() =>
      removePlanEntreno(activePlan.id),
    );
    if (result === SAVE_FAILED) {
      setErrorToast('Error al borrar el plan');
      return;
    }
    if (!result) return;
    // Toast undo aparece tras el chip "Eliminado correctamente" del DeleteStatusToast.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ plan: result });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  };

  const handleUndoDeletePlan = async () => {
    if (!undoToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const snap = undoToast;
    setUndoToast(null);
    try {
      await restorePlanEntreno(snap.plan);
      await setActivePlan(snap.plan.id);
    } catch (err) {
      console.error('[BTal] restorePlanEntreno error:', err);
      setErrorToast('Error al restaurar el plan');
    }
  };

  // Callback `onSave` que el DiaEditorModal invoca dentro de su
  // `runSave`. NO cerramos el modal aquí · el modal tiene su propio
  // closeTimer que dispara onClose tras SAVED_INDICATOR_MS para que
  // el chip "Guardado ✓" sea visible. Re-lanzamos el error para que
  // runSave capture SAVE_FAILED y muestre el chip "Error".
  const handleSaveDia = async (dia: DiaEntreno) => {
    if (!diaEditor || !activePlan) return;
    await updateDiaEntreno(activePlan.id, diaEditor.diaIdx, dia);
  };

  // Borra un día completo · re-construye el plan sin ese día y lo
  // persiste vía setPlanEntreno (path full porque cambia el array).
  // Usado desde el botón "Eliminar día" del DiaEditorModal · el cierre
  // sí lo hacemos aquí porque no hay flujo de "Guardado ✓" tras delete
  // (es destructivo, no editorial).
  const handleDeleteDia = async () => {
    if (!diaEditor || !activePlan) return;
    if (activePlan.dias.length <= 1) {
      setErrorToast('Un plan debe tener al menos 1 día');
      return;
    }
    const updatedPlan: PlanEntreno = {
      ...activePlan,
      dias: activePlan.dias.filter((_, i) => i !== diaEditor.diaIdx),
    };
    try {
      await setPlanEntreno(updatedPlan);
      setDiaEditor(null);
    } catch (err) {
      console.error('[BTal] handleDeleteDia error:', err);
      setErrorToast('Error al borrar el día');
    }
  };

  return (
    <IonPage className="app-tab-page">
      <IonContent ref={contentRef} fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Plan de "
            accent="entreno"
            right={
              <>
                {showAiButton && (
                  <>
                    <AiGeneratedBadge userDoc={userDoc} scope="entrenos" />
                    <button
                      type="button"
                      className="tab-header-ia-btn"
                      onClick={blurAndRun(() => setAiGenOpen(true))}
                      aria-label="Generar con IA"
                    >
                      <MealIcon value="tb:sparkles" size={18} />
                      <span>Generar con IA</span>
                    </button>
                  </>
                )}
                <AppAvatarButton />
              </>
            }
          />

          <GuestBanner />

          {/* Plan switcher · scroll horizontal */}
          <div className="plan-cards" ref={planCardsRef}>
            {planList.map((p) => {
              const numDias = p.dias.length;
              // Sub-fase 2D.1 · Lógica del marcador "★ Recomendado":
              //   - Si hay customPredeterminado · ese plan se marca,
              //     IGNORANDO `diasEntreno` (incluso si es 0).
              //   - Si NO hay · fallback a la lógica del perfil (que
              //     no marca nada cuando diasEntreno === 0).
              const isRecommended = customPredeterminado
                ? p.id === customPredeterminado.id
                : diasEntreno !== 0 && p.id === recommendedId;
              const isCustomPredeterminado = !p.builtIn && !!p.esPredeterminado;
              return (
                <button
                  type="button"
                  key={p.id}
                  ref={isRecommended ? recommendedBtnRef : undefined}
                  className={
                    'plan-mini'
                    + (p.id === activePlanId ? ' plan-mini--active' : '')
                    + (isRecommended ? ' plan-mini--recommended' : '')
                    + (!p.builtIn ? ' plan-mini--custom' : '')
                    + (isCustomPredeterminado ? ' plan-mini--custom-pred' : '')
                  }
                  // Inyectamos --rec-color para el ::after "★ ..." que
                  // usa este token. Los builtIn-recomendados usan la
                  // escala dinámica de diasEntreno · los custom-pred
                  // siempre lima sólida (decisión del user, no perfil).
                  style={
                    isRecommended
                      ? ({ '--rec-color': recColor } as React.CSSProperties)
                      : undefined
                  }
                  onClick={blurAndRun(() => handleSelectPlan(p.id))}
                  aria-label={`Activar ${p.nombre}`}
                  aria-pressed={p.id === activePlanId}
                >
                  {p.builtIn ? (
                    // Plan builtIn · número grande + DÍA(S) (look v2).
                    <>
                      <div className="plan-num">{numDias}</div>
                      <div className="plan-lbl">
                        {numDias === 1 ? 'día' : 'días'}
                      </div>
                    </>
                  ) : (
                    // Plan custom · nombre del plan en lugar del número
                    // (limitado a NOMBRE_MAX=40 chars en el editor para
                    // que el chip no se haga absurdo). Para el caso
                    // predeterminado, el ::after "★ Predeterminado" se
                    // añade vía CSS · NO requiere markup extra.
                    <div className="plan-mini-name" title={p.nombre}>
                      {p.nombre}
                    </div>
                  )}
                </button>
              );
            })}
            {/* Slot "+ Nuevo" · crear plan custom */}
            <button
              type="button"
              className="plan-mini plan-mini--new"
              onClick={blurAndRun(() => setPlanEditorMode({ mode: 'create' }))}
              aria-label="Crear plan nuevo"
            >
              <div className="plan-num">+</div>
              <div className="plan-lbl">Nuevo</div>
            </button>
          </div>

          {/* Banner siempre visible si hay activePlan y diasEntreno
              definido. Cuatro variantes:
                · diasEntreno === 0 → aviso "selecciona al menos un día" con icono X
                · Plan custom seleccionado → "Has seleccionado tu plan creado: X"
                · Plan builtIn coincide con el recomendado → "Plan recomendado: X"
                · Plan builtIn distinto al recomendado → sugerencia link al recomendado
              Y al final, recordatorio común con link a "Editar datos del perfil"
              para que sepan dónde cambiar `profile.diasEntreno`. */}
          {diasEntreno !== null && activePlan && (
            <div
              className="entreno-banner"
              // Variable CSS dinámica · todos los acentos del banner
              // (gradient, borde, icono, link, hint) leen `--rec-color`.
              style={{ '--rec-color': recColor } as React.CSSProperties}
            >
              <div className="entreno-banner-icon">
                {/* Caso 0 días · X simple (closeOutline Ionic) para
                    señalizar que el user no ha seleccionado ninguno.
                    Resto de casos · pesa Tabler coherente con el resto
                    de identidades de entreno (HoyPage, StatsGrid). */}
                {diasEntreno === 0 ? (
                  <MealIcon value="tb:x" size={26} />
                ) : (
                  <MealIcon value="tb:barbell" size={26} />
                )}
              </div>
              <div className="entreno-banner-text">
                {customPredeterminado && activePlanId === customPredeterminado.id ? (
                  // Caso PRIORITARIO · custom predeterminado activo.
                  // Sustituye a TODAS las variantes basadas en
                  // diasEntreno · el predeterminado ignora el perfil.
                  <>
                    Tu plan predeterminado:{' '}
                    <b className="entreno-banner-rec">
                      {customPredeterminado.nombre}
                    </b>.{' '}
                    {customPredeterminado.dias.length}{' '}
                    {customPredeterminado.dias.length === 1 ? 'día' : 'días'}{' '}
                    de entreno.
                  </>
                ) : customPredeterminado ? (
                  // Hay un predeterminado pero el user está mirando otro.
                  // Sugerir volver al predeterminado.
                  <>
                    Estás viendo <b>{activePlan.nombre}</b>. Tu plan
                    predeterminado es{' '}
                    <button
                      type="button"
                      className="entreno-banner-link"
                      onClick={blurAndRun(() => handleSelectPlan(customPredeterminado.id))}
                    >
                      {customPredeterminado.nombre}
                    </button>.
                  </>
                ) : diasEntreno === 0 ? (
                  // Caso 0 · user declaró 0 días · pídele que seleccione.
                  <>
                    No has seleccionado ningún día de entrenamiento.{' '}
                    <b className="entreno-banner-rec">
                      Selecciona al menos un día.
                    </b>
                  </>
                ) : !activePlan.builtIn ? (
                  // Caso 1 · plan custom creado por el user (sin pred).
                  <>
                    Vas a entrenar{' '}
                    <b>
                      {diasEntreno} {diasEntreno === 1 ? 'día' : 'días'}
                    </b>{' '}
                    esta semana. Has seleccionado tu plan creado:{' '}
                    <b className="entreno-banner-rec">{activePlan.nombre}</b>.
                  </>
                ) : activePlanId === recommendedId ? (
                  // Caso 2 · plan builtIn que coincide con el recomendado.
                  <>
                    Vas a entrenar{' '}
                    <b>
                      {diasEntreno} {diasEntreno === 1 ? 'día' : 'días'}
                    </b>{' '}
                    esta semana. Plan recomendado:{' '}
                    <b className="entreno-banner-rec">
                      {entrenos.planes[recommendedId]?.nombre ?? 'Plan recomendado'}
                    </b>.
                  </>
                ) : (
                  // Caso 3 · plan builtIn distinto al recomendado.
                  <>
                    Estás viendo <b>{activePlan.nombre}</b>. Para{' '}
                    {diasEntreno === 1 ? 'tu' : 'tus'}{' '}
                    <b>
                      {diasEntreno} {diasEntreno === 1 ? 'día' : 'días'}
                    </b>{' '}
                    {diasEntreno === 1 ? 'declarado' : 'declarados'}, el
                    recomendado es{' '}
                    <button
                      type="button"
                      className="entreno-banner-link"
                      onClick={blurAndRun(() => handleSelectPlan(recommendedId))}
                    >
                      {entrenos.planes[recommendedId]?.nombre ?? 'Plan recomendado'}
                    </button>.
                  </>
                )}
                {/* Recordatorio · solo aplica cuando la recomendación
                    se basa en `profile.diasEntreno`. Si el user tiene
                    un plan custom marcado como predeterminado, ese
                    plan IGNORA el perfil y el hint no tiene sentido.
                    Mostrarlo solo en las variantes basadas en perfil. */}
                {!customPredeterminado && (
                  <div className="entreno-banner-hint">
                    Puedes cambiar los días declarados en{' '}
                    <b>Editar datos del perfil</b>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Header con acciones del plan activo */}
          {activePlan && (
            <div className="entreno-section-head">
              <h2>{activePlan.nombre}</h2>
              <div className="entreno-section-actions">
                <button
                  type="button"
                  className="entreno-action-btn"
                  onClick={blurAndRun(() =>
                    setPlanEditorMode({ mode: 'edit', plan: activePlan }),
                  )}
                  aria-label="Editar plan"
                  title="Editar plan"
                >
                  <MealIcon value="tb:edit" size={18} />
                </button>
                {!activePlan.builtIn && (
                  <button
                    type="button"
                    className="entreno-action-btn entreno-action-btn--danger"
                    onClick={blurAndRun(() => setConfirmDeletePlan(true))}
                    aria-label="Eliminar plan"
                    title="Eliminar plan"
                  >
                    <MealIcon value="tb:trash" size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Días del plan activo */}
          {activePlan && activePlan.dias.length === 0 && (
            <div className="entreno-empty">
              <MealIcon value="tb:barbell" size={20} />
              <p>Este plan no tiene días aún. Pulsa ✏ para añadir.</p>
            </div>
          )}

          {activePlan?.dias.map((dia, idx) => (
            <DiaCard
              key={`${activePlan.id}-${idx}`}
              dia={dia}
              onClick={() => setTrainSheetIdx(idx)}
              onEditQuick={() => setDiaEditor({ dia, diaIdx: idx })}
            />
          ))}

          <div className="app-tab-pad-bottom" />
        </div>

        {/* Bottom sheet · detalle del día clicado */}
        {activePlan && trainSheetIdx !== null && (
          <TrainSheet
            isOpen={trainSheetIdx !== null}
            onClose={() => setTrainSheetIdx(null)}
            plan={activePlan}
            diaIdx={trainSheetIdx}
            onEdit={() => {
              const dia = activePlan.dias[trainSheetIdx];
              if (!dia) return;
              setTrainSheetIdx(null);
              setDiaEditor({ dia, diaIdx: trainSheetIdx });
            }}
          />
        )}

        {/* Modal · editar un día concreto */}
        {diaEditor && activePlan && (
          <DiaEditorModal
            isOpen={diaEditor !== null}
            onClose={() => setDiaEditor(null)}
            dia={diaEditor.dia}
            diaIdx={diaEditor.diaIdx}
            onSave={handleSaveDia}
            // Solo permitimos borrar el día si el plan tiene >1 día
            // · evita dejar planes vacíos (que no tendrían sentido y
            // romperían el render). Si solo queda 1 día, el botón
            // "Eliminar día" no se renderiza.
            onDelete={
              activePlan.dias.length > 1 ? handleDeleteDia : undefined
            }
          />
        )}

        {/* Modal · crear/editar plan completo */}
        {planEditorMode && (
          <PlanEditorModal
            isOpen={planEditorMode !== null}
            onClose={() => setPlanEditorMode(null)}
            plan={
              planEditorMode.mode === 'edit' ? planEditorMode.plan : undefined
            }
            existingPlanIds={Object.keys(entrenos.planes)}
            onSave={handleSavePlanFromEditor}
          />
        )}

        {/* Confirm borrar plan custom */}
        <IonAlert
          isOpen={confirmDeletePlan}
          onDidDismiss={() => setConfirmDeletePlan(false)}
          header="¿Eliminar plan?"
          message={
            `Se eliminará "${activePlan?.nombre ?? ''}" y todos sus días. `
            + `Tendrás 5 segundos para deshacer.`
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Eliminar',
              role: 'destructive',
              handler: () => {
                handleDeletePlan();
              },
            },
          ]}
        />

        {showAiButton && aiGenOpen && (
          <AiGenerateModal
            isOpen={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            title="Generar el plan de entreno con IA"
            description="Crearemos un plan adaptado a tus días disponibles, equipamiento y objetivo."
            availableScopes={['entrenos_only']}
          />
        )}

        <DeleteStatusToast status={deletePlanStatus.status} />

        <IonToast
          isOpen={undoToast !== null}
          onDidDismiss={() => setUndoToast(null)}
          message={undoToast ? `Plan "${undoToast.plan.nombre}" eliminado` : ''}
          duration={5000}
          position="bottom"
          color="medium"
          buttons={[
            {
              text: 'Deshacer',
              role: 'cancel',
              handler: () => {
                handleUndoDeletePlan().catch((err) =>
                  console.error('[BTal] handleUndoDeletePlan:', err),
                );
              },
            },
          ]}
        />

        <IonToast
          isOpen={errorToast !== null}
          onDidDismiss={() => setErrorToast(null)}
          message={errorToast ?? ''}
          duration={2200}
          position="bottom"
          color="danger"
        />
      </IonContent>
    </IonPage>
  );
};

export default EntrenoPage;

// Color del plan recomendado según `profile.diasEntreno` · escala de
// 0 (peor, coral) a 7 (mejor, verde). Si el user no ha declarado días
// (null) usamos el gold neutro (legacy). Los valores se inyectan como
// CSS custom prop `--rec-color` en el banner y en la card recomendada.
function colorForRecommendedDays(days: number | null): string {
  if (days === null) return 'var(--btal-gold)';
  const d = Math.max(0, Math.min(7, days));
  // Rampa coral → naranja → ámbar → amarillo → lima → verde. El índice
  // 5 coincide con el `--btal-lime` de la app (#b5f037) para mantener
  // continuidad cromática con el resto de acentos verdes.
  const ramp = [
    '#ff6b6b', // 0 · sin entrenamiento (peor)
    '#ff8c42', // 1
    '#ffa726', // 2
    '#ffd54f', // 3
    '#dde356', // 4
    '#b5f037', // 5 · btal-lime
    '#7ed03a', // 6
    '#4caf50', // 7 · verde puro (mejor)
  ];
  return ramp[d];
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componente local · Card de un día del plan (render preview)
// ──────────────────────────────────────────────────────────────────────────

interface DiaCardProps {
  dia: DiaEntreno;
  onClick: () => void;
  onEditQuick: () => void;
}

// Una card por día · header con título + día semana, badges de tags,
// preview de los primeros ejercicios. Click abre TrainSheet.
function DiaCard({ dia, onClick, onEditQuick }: DiaCardProps) {
  const tags = [
    { val: dia.badge, custom: dia.badgeCustom },
    { val: dia.badge2, custom: dia.badgeCustom2 },
    { val: dia.badge3, custom: dia.badgeCustom3 },
  ]
    .map((b) => ({
      label: b.val ? badgeLabel(b.val, b.custom) : null,
      cls: b.val ? BADGE_BY_VAL[b.val]?.cls ?? '' : '',
    }))
    .filter((b) => b.label !== null) as { label: string; cls: string }[];

  return (
    <div
      className="train-day"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="train-day-head">
        <div className="train-day-id">
          <div className="train-day-title">
            {dia.titulo || 'Día sin título'}
          </div>
          {dia.descripcion && (
            <div className="train-day-sub">{dia.descripcion}</div>
          )}
        </div>
        <div className="train-day-actions">
          {/* Badge "tiempo estimado" en azul · a la izquierda del badge
              día semana. Solo aparece si el day tiene `tiempoEstimadoMin`
              definido (valor opcional). Réplica del v1 que mostraba
              "~65 min" en la card del día. */}
          {dia.tiempoEstimadoMin && dia.tiempoEstimadoMin > 0 && (
            <span className="train-day-time">
              {formatTiempoEstimado(dia.tiempoEstimadoMin)}
            </span>
          )}
          {dia.diaSemana && (
            <span className="train-day-week">
              {formatDiaSemana(dia.diaSemana).toUpperCase()}
            </span>
          )}
          <button
            type="button"
            className="train-day-edit"
            onClick={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).blur();
              onEditQuick();
            }}
            aria-label="Editar día"
            title="Editar día"
          >
            <MealIcon value="tb:pencil" size={16} />
          </button>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="train-tags">
          {tags.map((t, i) => (
            <span key={i} className={`tag ${t.cls}`}>
              {t.label}
            </span>
          ))}
        </div>
      )}
      {dia.ejercicios.length === 0 ? (
        <button
          type="button"
          className="train-day-empty-cta"
          onClick={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).blur();
            onEditQuick();
          }}
        >
          <MealIcon value="tb:plus" size={18} />
          Añadir ejercicios
        </button>
      ) : (
        <div className="train-day-exercises">
          {dia.ejercicios.slice(0, 6).map((ex, i) => (
            <div key={i} className="exercise-row">
              <div className="exercise-name">
                {ex.nombre}
                {ex.desc && <span>{ex.desc}</span>}
              </div>
              <div className="exercise-sets">{ex.series}</div>
            </div>
          ))}
          {dia.ejercicios.length > 6 && (
            <div className="train-day-more">
              + {dia.ejercicios.length - 6} ejercicio
              {dia.ejercicios.length - 6 === 1 ? '' : 's'} más
            </div>
          )}
        </div>
      )}
      {dia.comentario && (
        <div className="train-day-note">{dia.comentario}</div>
      )}
    </div>
  );
}
