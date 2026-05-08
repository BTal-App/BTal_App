import { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  arrowBackOutline,
  arrowForwardOutline,
  closeOutline,
  lockClosedOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { canGenerateAi } from '../utils/ia';
import { blurAndRun } from '../utils/focus';
import {
  affectedStats,
  getAffectedItems,
  initialExcludedIds,
} from '../utils/aiAffectedItems';
import { AiAffectedItemsStep } from './AiAffectedItemsStep';
import { AiPromptSummaryModal } from './AiPromptSummaryModal';
import { GeneratingScreen } from './GeneratingScreen';
import {
  AI_SCOPE_OPTIONS,
  type AiScopeChoice,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './AiGenerateModal.css';

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
  const { profile: userDoc } = useProfile();
  const isAnonymous = user?.isAnonymous ?? false;
  const history = useHistory();

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
  const [pendingToast, setPendingToast] = useState(false);
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

  // Reset al abrir · evita arrastrar selección de la sesión anterior si
  // el user cierra y reabre el mismo modal.
  const resetState = () => {
    setStep('scope');
    setSelected(pickInitialScope());
    setShowSummary(false);
    setAllowUserItems(false);
    // excludedIds lo recalculará el useEffect de selected.
  };

  const eligibility = canGenerateAi(userDoc, isAnonymous);
  const visibleOptions = AI_SCOPE_OPTIONS.filter((o) =>
    availableScopes.includes(o.value),
  );
  const stats = affectedStats(items, excludedIds, allowUserItems);

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
  // espera a que termine la generación REAL. Sin simulaciones · el
  // spinner solo se ve el tiempo que la Cloud Function tarde de verdad
  // (en Fase 6 serán 5-30s con Gemini · ahora la fake-function resuelve
  // de inmediato y el spinner casi no se aprecia, lo cual es correcto).
  const handleConfirmGenerate = async () => {
    console.info('[BTal] generatePlan request (Fase 6 pendiente)', {
      scope: selected,
      excludedIds: Array.from(excludedIds),
      allowUserItems,
      willOverwrite: stats.willOverwrite,
      willKeep: stats.willKeep,
    });
    setShowSummary(false);
    setGenerating(true);
    try {
      await callGenerateAiPlaceholder({
        scope: selected,
        excludedIds: Array.from(excludedIds),
        allowUserItems,
      });
    } catch (err) {
      console.error('[BTal] generatePlan error:', err);
      // En Fase 6 mostraremos un toast de error · por ahora no hay
      // forma de fallar (placeholder resuelve siempre OK).
    } finally {
      setGenerating(false);
      setPendingToast(true);
      onClose();
    }
  };

  // "Modificar" desde el summary · cierra todo el wizard y lleva al user
  // a Settings → Editar datos del perfil para que pueda cambiar lo que
  // necesite antes de relanzar el flujo.
  const handleModify = () => {
    setShowSummary(false);
    onClose();
    history.push('/settings');
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        {/* Botón cerrar FUERA del IonContent · queda fijo arriba a la
            derecha y NO scrollea con el contenido (importante en wizard
            de 3 pasos donde el contenido puede ser largo). */}
        <button
          type="button"
          className="settings-modal-close settings-modal-close--fixed"
          onClick={blurAndRun(onClose)}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card ai-gen-card">
              {/* Header · icono + título + paso actual del wizard */}
              <div className="ai-gen-head">
                <div className="ai-gen-icon">
                  <IonIcon icon={sparklesOutline} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="settings-modal-title">{title}</h2>
                  {description && step === 'scope' && (
                    <p className="settings-modal-text" style={{ margin: '6px 0 0' }}>
                      {description}
                    </p>
                  )}
                </div>
                <span
                  className="ai-gen-step-pill"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  Paso {step === 'scope' ? '1' : '2'} de 3
                </span>
              </div>

              {/* Estado del plan / contador (lo lee canGenerateAi) */}
              {eligibility.hint && (
                <div
                  className={
                    'ai-gen-hint'
                    + (eligibility.allowed ? ' ai-gen-hint--ok' : ' ai-gen-hint--blocked')
                  }
                >
                  {!eligibility.allowed && <IonIcon icon={lockClosedOutline} />}
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
                              <span className="ai-gen-scope-emoji">{opt.emoji}</span>
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
                      <span className="ai-gen-scope-emoji">{visibleOptions[0].emoji}</span>
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
                    <IonIcon icon={arrowForwardOutline} slot="end" />
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
                      <IonIcon icon={arrowBackOutline} slot="start" />
                      Atrás
                    </IonButton>
                    <IonButton
                      type="button"
                      className="settings-modal-primary ai-gen-nav-next"
                      onClick={blurAndRun(handleItemsContinue)}
                      disabled={!eligibility.allowed || items.length === 0}
                    >
                      Continuar
                      <IonIcon icon={arrowForwardOutline} slot="end" />
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
          onConfirm={handleConfirmGenerate}
          onModify={handleModify}
          confirmLabel="Generar con IA"
        />
      )}

      {/* GeneratingScreen full-screen · se muestra mientras "trabaja" la IA.
          En Fase 6 lo controlará el await de la Cloud Function. Por ahora
          es un setTimeout de 2s que simula el feedback visual. */}
      <GeneratingScreen
        isOpen={generating}
        title="Generando con IA"
        subtitle={summaryToSubtitle(selected)}
      />

      {/* Toast informativo Fase 6 · se elimina cuando llegue la Cloud Function. */}
      <IonToast
        isOpen={pendingToast}
        onDidDismiss={() => setPendingToast(false)}
        message="La IA estará disponible cuando activemos Gemini · Fase 6 del roadmap."
        duration={3500}
        position="bottom"
        color="warning"
      />
    </>
  );
}

// Placeholder para la Cloud Function `generatePlan` que vendrá en Fase 6.
// Por ahora resuelve inmediatamente (operación de duración 0) · cuando
// llegue Fase 6, este `Promise.resolve()` se reemplazará por:
//
//   import { httpsCallable } from 'firebase/functions';
//   const generate = httpsCallable(functions, 'generatePlan');
//   const result = await generate({ scope, excludedIds, allowUserItems });
//   await refreshProfile();
//   return result.data;
//
// ⚠ CONTRATO de la respuesta de `generatePlan` (Fase 6):
//   Cada Comida generada (4 fijas + extras) DEBE incluir `nombrePlato`
//   con un texto descriptivo (3-7 palabras, ej. "Pollo con arroz y
//   brócoli"). Detalles en `defaultUser.ts:Comida.nombrePlato`. Sin
//   esto, la card del menú quedará con placeholder "Pulsa para añadir
//   nombre" tras la generación y rompe el flujo "IA me hace todo".
//
// El spinner del GeneratingScreen se mostrará automáticamente durante
// el tiempo REAL que tarde Gemini (5-30s típicos). Sin simulaciones.
async function callGenerateAiPlaceholder(payload: {
  scope: AiScopeChoice;
  excludedIds: string[];
  allowUserItems: boolean;
}): Promise<void> {
  // No-op intencional · la generación real vive en Fase 6.
  // El payload se loguea por si quieres ver desde DevTools qué se mandaría.
  console.debug('[BTal] generatePlan payload (Fase 6 will use this):', payload);
  return Promise.resolve();
}

// Texto del subtitulo de la GeneratingScreen según el scope · "Estamos
// creando tu menú semanal y la lista de la compra…" etc.
function summaryToSubtitle(scope: AiScopeChoice): string {
  switch (scope) {
    case 'all':
      return 'Estamos creando tu menú semanal, tu plan de entreno y tu lista de la compra. No cierres la app — esto puede tardar unos segundos.';
    case 'menu_compra':
      return 'Estamos creando tu menú semanal y la lista de la compra. No cierres la app — esto puede tardar unos segundos.';
    case 'menu_only':
      return 'Estamos creando tu menú semanal. No cierres la app — esto puede tardar unos segundos.';
    case 'entrenos_only':
      return 'Estamos creando tu plan de entreno. No cierres la app — esto puede tardar unos segundos.';
  }
}
