import { useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { canGenerateAi } from '../utils/ia';
import { generatePlan, type GenerateError } from '../services/functions';
import { blurAndRun } from '../utils/focus';
import {
  getAffectedItems,
  initialExcludedIds,
  isProtected,
  type AffectedItem,
} from '../utils/aiAffectedItems';
import { AiAffectedItemsStep } from './AiAffectedItemsStep';
import { AiPromptSummaryModal } from './AiPromptSummaryModal';
import { EditFitnessProfileModal } from './EditFitnessProfileModal';
import { GeneratingScreen } from './GeneratingScreen';
import {
  AI_SCOPE_OPTIONS,
  type AiScopeChoice,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './AiGenerateModal.css';

// Mapping de scope → Ionicon outline · sustituye los emojis (✨ 🍽️ 📋 🏋️)
// del schema por iconos coherentes con la UI. El campo `emoji` del
// schema se mantiene para Onboarding (StepMode) que prioriza render
// rápido del primer paint; el modal completo usa Ionicons.
const SCOPE_ICON: Record<AiScopeChoice, string> = {
  all: 'tb:sparkles',
  menu_compra: 'tb:tools-kitchen-2',
  menu_only: 'tb:list',
  entrenos_only: 'tb:barbell',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Texto del header — depende del contexto que abre el modal:
  //   - HoyPage: "Generar mi plan con IA"
  //   - MenuPage: "Generar el menú con IA"
  //   - EntrenoPage: "Generar el plan de entreno con IA"
  title: string;
  // Texto descriptivo bajo el título.
  description?: string;
  // Qué scopes están disponibles para elegir en este contexto.
  // - Hoy: ['all', 'menu_compra', 'menu_only', 'entrenos_only']
  // - Menú: ['menu_compra', 'menu_only']
  // - Entreno: ['entrenos_only']  → si solo hay uno, va directo sin mostrar grid
  availableScopes: AiScopeChoice[];
  // Pre-selección · si no se pasa, usa el primer scope disponible.
  defaultScope?: AiScopeChoice;
}

// Paso interno del wizard.
type WizardStep = 'scope' | 'items';

// Modal del botón "Generar con IA". Wizard de 3 pasos:
//   1. Elegir scope (qué generar)
//   2. Items afectados (lista con checkboxes para excluir + toggle
//      "permitir tocar lo mío") + stats X reemplazará / Y mantendrá
//   3. Resumen del perfil que se enviará a la IA + Confirmar / Modificar
//      (este paso vive en AiPromptSummaryModal en cascada)
//
// Si no hay items previos relevantes (todo está vacío default), el step 2
// muestra todos los items vacíos como 'default' — no hay nada que proteger,
// pero el user ve qué áreas se van a poblar.
export function AiGenerateModal({
  isOpen,
  onClose,
  title,
  description,
  availableScopes,
  defaultScope,
}: Props) {
  const { user } = useAuth();
  const { profile: userDoc, refresh } = useProfile();
  const isAnonymous = user?.isAnonymous ?? false;

  // Calcula el scope inicial defensivamente:
  //   - si defaultScope viene y está disponible → úsalo
  //   - en otro caso → primer scope disponible
  //   - fallback paranoico → 'all' (no debería llegarse nunca)
  const pickInitialScope = (): AiScopeChoice => {
    if (defaultScope && availableScopes.includes(defaultScope)) {
      return defaultScope;
    }
    return availableScopes[0] ?? 'all';
  };

  const [step, setStep] = useState<WizardStep>('scope');
  const [selected, setSelected] = useState<AiScopeChoice>(pickInitialScope);
  const [showSummary, setShowSummary] = useState(false);
  // "Editar perfil" desde el resumen abre el MISMO modal que el avatar
  // (EditFitnessProfileModal · "Editar datos del perfil"), en cascada
  // sobre el wizard. Al cerrarlo se vuelve al resumen con los datos ya
  // actualizados, sin salir del flujo.
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  // Toasts post-generación · éxito (verde) o error tipado (rojo).
  const [successToast, setSuccessToast] = useState(false);
  const [errorToast, setErrorToast] = useState('');
  // GeneratingScreen overlay · activo mientras la IA está "trabajando".
  // Por ahora simulamos 2s con setTimeout (Fase 6 reemplazará con el
  // await de la Cloud Function `generatePlan`). Bloquea interacción para
  // que el user no dispare doble generación.
  const [generating, setGenerating] = useState(false);

  // Items afectados por el scope seleccionado · se recalcula cuando cambia.
  const items = useMemo(
    () => getAffectedItems(userDoc, selected),
    [userDoc, selected],
  );

  // Exclusiones manuales · arrancan auto-incluyendo los items 'user' para
  // que estén marcados como protegidos en la UI desde el primer render.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(
    () => initialExcludedIds(items),
  );
  // Toggle "permitir que la IA toque mis items" · default OFF (estricto).
  const [allowUserItems, setAllowUserItems] = useState(false);

  // ── Resets state-from-prop (React 19 evita setState en effects) ──
  // Track del scope · cuando cambia, recalculamos exclusiones por defecto
  // y reseteamos el toggle (no asumimos que el user quiere el mismo
  // permiso de "tocar lo mío" en distintos scopes).
  const [trackedScope, setTrackedScope] = useState<AiScopeChoice>(selected);
  if (trackedScope !== selected) {
    setTrackedScope(selected);
    setExcludedIds(initialExcludedIds(items));
    setAllowUserItems(false);
  }
  // Track del toggle · cuando cambia, ajustamos las exclusiones automáticas
  // de items 'user' (ON limpia, OFF las vuelve a marcar).
  const [trackedAllow, setTrackedAllow] = useState(allowUserItems);
  if (trackedAllow !== allowUserItems) {
    setTrackedAllow(allowUserItems);
    setExcludedIds(allowUserItems ? new Set() : initialExcludedIds(items));
  }

  // Items que la IA NO va a reemplazar (protegidos): los excluidos a mano +
  // los del usuario auto-protegidos cuando el toggle está OFF. Se muestran en
  // el resumen final para que el user confirme qué se mantiene intacto.
  const protectedItems: AffectedItem[] = useMemo(
    () => items.filter((it) => isProtected(it, excludedIds, allowUserItems)),
    [items, excludedIds, allowUserItems],
  );

  // Reset al abrir · evita arrastrar selección de la sesión anterior si
  // el user cierra y reabre el mismo modal.
  const resetState = () => {
    setStep('scope');
    setSelected(pickInitialScope());
    setShowSummary(false);
    setEditProfileOpen(false);
    setAllowUserItems(false);
    // excludedIds lo recalculará el useEffect de selected.
  };

  const eligibility = canGenerateAi(userDoc, isAnonymous);
  const visibleOptions = AI_SCOPE_OPTIONS.filter((o) =>
    availableScopes.includes(o.value),
  );

  // Handlers de navegación entre pasos
  const handleScopeContinue = () => {
    if (!eligibility.allowed) return;
    setStep('items');
  };
  const handleItemsBack = () => setStep('scope');
  const handleItemsContinue = () => {
    if (!eligibility.allowed) return;
    setShowSummary(true);
  };

  const handleToggleExclude = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Confirmar generación: cierra el wizard, abre la GeneratingScreen, y
  // espera a la Cloud Function `generatePlan` (Gemini · 5-30s típicos).
  // Tras éxito refresca el doc para que las tabs muestren lo generado.
  // En error muestra un toast con el mensaje tipado de la función.
  const handleConfirmGenerate = async () => {
    setShowSummary(false);
    setGenerating(true);
    try {
      await generatePlan({
        scope: selected,
        excludedIds: Array.from(excludedIds),
        allowUserItems,
      });
      // Recargamos el UserDocument · el menú/entrenos/compra recién
      // generados aparecen en cuanto el provider re-emite.
      await refresh();
      // Cierre ESCALONADO de modales · GeneratingScreen y el wizard son
      // dos IonModal. Cerrarlos en el mismo tick deja un backdrop negro
      // pegado en iOS WebKit (modales solapados). Cerramos primero la
      // GeneratingScreen, esperamos su animación de salida (~300ms) y
      // después cerramos el wizard.
      setGenerating(false);
      setSuccessToast(true);
      window.setTimeout(() => onClose(), 450);
    } catch (err) {
      setGenerating(false);
      const ge = err as GenerateError;
      setErrorToast(ge?.message || 'No se ha podido generar. Inténtalo de nuevo.');
      window.setTimeout(() => onClose(), 450);
    }
  };

  // "Editar perfil" desde el summary · abre EditFitnessProfileModal (la
  // misma pantalla "Editar datos del perfil" del avatar) SIN salir del
  // wizard. Al cerrarla volvemos al resumen con los datos ya guardados,
  // para que el user pueda revisar y Generar directamente.
  const handleModify = () => {
    setShowSummary(false);
    setEditProfileOpen(true);
  };
  const handleEditProfileClose = () => {
    setEditProfileOpen(false);
    setShowSummary(true);
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card ai-gen-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={blurAndRun(onClose)}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
              {/* Header · icono + título + paso actual del wizard
                  El pill "Paso X de 3" vive AHORA dentro de la columna
                  de texto (debajo de título/descripción) para no quitar
                  ancho horizontal al título (provocaba wrap a 2-3 líneas)
                  y para no chocar con la X absolute top-right del card.
                  El head tiene padding-right que reserva espacio para la X. */}
              <div className="ai-gen-head">
                <div className="ai-gen-icon">
                  <MealIcon value="tb:sparkles" size={28} />
                </div>
                <div className="ai-gen-head-text">
                  <h2 className="settings-modal-title">{title}</h2>
                  {description && step === 'scope' && (
                    <p className="settings-modal-text ai-gen-head-desc">
                      {description}
                    </p>
                  )}
                  <span
                    className="ai-gen-step-pill"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    Paso {step === 'scope' ? '1' : '2'} de 3
                  </span>
                </div>
              </div>

              {/* Estado del plan / contador (lo lee canGenerateAi) */}
              {eligibility.hint && (
                <div
                  className={
                    'ai-gen-hint'
                    + (eligibility.allowed ? ' ai-gen-hint--ok' : ' ai-gen-hint--blocked')
                  }
                >
                  {!eligibility.allowed && <MealIcon value="tb:lock" size={16} />}
                  <span>{eligibility.hint}</span>
                </div>
              )}

              {/* ─── PASO 1 · ELEGIR SCOPE ─── */}
              {step === 'scope' && (
                <>
                  {visibleOptions.length > 1 && (
                    <>
                      <span className="ai-gen-scope-label">¿Qué quieres generar?</span>
                      <div className="ai-gen-scope-grid">
                        {visibleOptions.map((opt) => {
                          const active = selected === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={'ai-gen-scope-card' + (active ? ' active' : '')}
                              onClick={() => setSelected(opt.value)}
                              aria-pressed={active}
                            >
                              <span className="ai-gen-scope-emoji" aria-hidden>
                                <MealIcon value={SCOPE_ICON[opt.value]} size={20} />
                              </span>
                              <span className="ai-gen-scope-info">
                                <span className="ai-gen-scope-title">{opt.label}</span>
                                <span className="ai-gen-scope-sub">{opt.sub}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {visibleOptions.length === 1 && (
                    <div className="ai-gen-single">
                      <span className="ai-gen-scope-emoji" aria-hidden>
                        <MealIcon value={SCOPE_ICON[visibleOptions[0].value]} size={20} />
                      </span>
                      <div>
                        <div className="ai-gen-scope-title">{visibleOptions[0].label}</div>
                        <div className="ai-gen-scope-sub">{visibleOptions[0].sub}</div>
                      </div>
                    </div>
                  )}

                  <IonButton
                    type="button"
                    expand="block"
                    className="settings-modal-primary"
                    onClick={blurAndRun(handleScopeContinue)}
                    disabled={!eligibility.allowed}
                  >
                    Continuar
                    <MealIcon value="tb:arrow-right" size={18} slot="end" />
                  </IonButton>
                </>
              )}

              {/* ─── PASO 2 · ITEMS AFECTADOS + PROTECCIÓN ─── */}
              {step === 'items' && (
                <>
                  <AiAffectedItemsStep
                    items={items}
                    excludedIds={excludedIds}
                    onToggleExclude={handleToggleExclude}
                    allowUserItems={allowUserItems}
                    onToggleAllowUserItems={setAllowUserItems}
                  />
                  <div className="ai-gen-nav">
                    <IonButton
                      type="button"
                      fill="outline"
                      className="ai-gen-nav-back"
                      onClick={blurAndRun(handleItemsBack)}
                    >
                      <MealIcon value="tb:arrow-left" size={18} slot="start" />
                      Atrás
                    </IonButton>
                    <IonButton
                      type="button"
                      className="settings-modal-primary ai-gen-nav-next"
                      onClick={blurAndRun(handleItemsContinue)}
                      disabled={!eligibility.allowed || items.length === 0}
                    >
                      Continuar
                      <MealIcon value="tb:arrow-right" size={18} slot="end" />
                    </IonButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Paso 3 del wizard · resumen del perfil + confirmar/modificar */}
      {showSummary && (
        <AiPromptSummaryModal
          isOpen={showSummary}
          onClose={() => setShowSummary(false)}
          scope={selected}
          protectedItems={protectedItems}
          onConfirm={handleConfirmGenerate}
          onModify={handleModify}
          // "Atrás" · cierra solo el resumen y deja al user en el paso 2
          // (items) del wizard, que sigue montado debajo · puede ajustar
          // exclusiones/scope y volver a Continuar sin salir del flujo.
          onBack={() => setShowSummary(false)}
          confirmLabel="Generar con IA"
        />
      )}

      {/* "Editar perfil" del resumen · mismo modal que abre el avatar
          (ProfileSheet → "Editar datos del perfil"). En cascada sobre el
          wizard · al cerrar vuelve al resumen con los datos guardados. */}
      <EditFitnessProfileModal
        isOpen={editProfileOpen}
        onClose={handleEditProfileClose}
      />

      {/* GeneratingScreen full-screen · se muestra mientras "trabaja" la IA.
          En Fase 6 lo controlará el await de la Cloud Function. Por ahora
          es un setTimeout de 2s que simula el feedback visual. */}
      <GeneratingScreen
        isOpen={generating}
        title="Generando con IA…"
        subtitle={summaryToSubtitle(selected)}
      />

      {/* Toast de éxito tras generar · verde. */}
      <IonToast
        isOpen={successToast}
        onDidDismiss={() => setSuccessToast(false)}
        message="¡Listo! Tu plan se ha generado con IA."
        duration={3000}
        position="bottom"
        color="success"
      />

      {/* Toast de error · rojo · mensaje tipado de la Cloud Function. */}
      <IonToast
        isOpen={!!errorToast}
        onDidDismiss={() => setErrorToast('')}
        message={errorToast}
        duration={5000}
        position="bottom"
        color="danger"
      />
    </>
  );
}

// La generación real vive en la Cloud Function `generatePlan`
// (functions/src/generatePlan.ts), invocada vía services/functions.ts.
// Los contratos que la función respeta (nombrePlato en cada Comida IA +
// plan de entreno marcado activo con la invariante "solo uno activo")
// están implementados y documentados en functions/src/persist.ts.

// Texto del subtitulo de la GeneratingScreen según el scope · "Estamos
// creando tu menú semanal y la lista de la compra…" etc.
function summaryToSubtitle(scope: AiScopeChoice): string {
  switch (scope) {
    case 'all':
      return 'Generando tu menú semanal, tu lista de la compra y tu plan de entreno. No cierres la app — esto puede tardar unos segundos.';
    case 'menu_compra':
      return 'Generando tu menú semanal y la lista de la compra. No cierres la app — esto puede tardar unos segundos.';
    case 'menu_only':
      return 'Generando tu menú semanal. No cierres la app — esto puede tardar unos segundos.';
    case 'entrenos_only':
      return 'Generando tu plan de entreno. No cierres la app — esto puede tardar unos segundos.';
  }
}
