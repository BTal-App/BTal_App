import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import {
  closeOutline,
  lockClosedOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { canGenerateAi } from '../utils/ia';
import { blurAndRun } from '../utils/focus';
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

// Modal genérico para los botones "Generar con IA" de cada tab. Pregunta
// el scope (cuando hay >1), comprueba el límite del plan con
// `canGenerateAi` y dispara la generación. Mientras no exista la Cloud
// Function `generatePlan` (Fase 6), esto solo muestra un toast informativo
// — la UX completa ya está · solo falta cablear el backend.
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

  const [selected, setSelected] = useState<AiScopeChoice>(pickInitialScope);
  const [submitting, setSubmitting] = useState(false);
  const [pendingToast, setPendingToast] = useState(false);

  // Reset al abrir · evita arrastrar selección de la sesión anterior si
  // el user cierra y reabre el mismo modal. Re-validamos porque
  // availableScopes/defaultScope pueden haber cambiado entre aperturas.
  const resetState = () => {
    setSelected(pickInitialScope());
  };

  // El límite Free aplica al plan completo del mes — el scope concreto
  // no afecta la elegibilidad. `selected` queda en estado para resaltar
  // la card activa y pasárselo a la Cloud Function en handleConfirm.
  const eligibility = canGenerateAi(userDoc, isAnonymous);
  const visibleOptions = AI_SCOPE_OPTIONS.filter((o) =>
    availableScopes.includes(o.value),
  );

  const handleConfirm = async () => {
    if (!eligibility.allowed || submitting) return;
    setSubmitting(true);
    try {
      // FASE 6 PENDIENTE · aquí llamaremos a la Cloud Function `generatePlan`
      // pasando el scope seleccionado. Por ahora mostramos un toast
      // explicativo para que la UX completa sea visible y el usuario sepa
      // qué pasaría al pulsar.
      //
      // const result = await callGenerateAi({ scope: selected });
      // await refreshProfile();
      // setSavedToast(true);

      setPendingToast(true);
      onClose();
    } catch (err) {
      console.error('[BTal] generateAi error:', err);
    } finally {
      setSubmitting(false);
    }
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
            <button
              type="button"
              className="settings-modal-close"
              onClick={blurAndRun(onClose)}
              aria-label="Cerrar"
            >
              <IonIcon icon={closeOutline} />
            </button>

            <div className="settings-modal-card">
              <div className="ai-gen-head">
                <div className="ai-gen-icon">
                  <IonIcon icon={sparklesOutline} />
                </div>
                <div>
                  <h2 className="settings-modal-title">{title}</h2>
                  {description && (
                    <p className="settings-modal-text" style={{ margin: '6px 0 0' }}>
                      {description}
                    </p>
                  )}
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
                  {!eligibility.allowed && <IonIcon icon={lockClosedOutline} />}
                  <span>{eligibility.hint}</span>
                </div>
              )}

              {/* Grid de scopes solo si hay más de uno · si solo hay 1 va directo. */}
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

              {/* Si solo hay un scope, mostramos un resumen plano de qué va a pasar. */}
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
                onClick={blurAndRun(handleConfirm)}
                disabled={!eligibility.allowed || submitting}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={sparklesOutline} slot="start" />
                    Generar con IA
                  </>
                )}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

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
